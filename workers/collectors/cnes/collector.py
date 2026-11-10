"""Hemocentros e centros de transplante de medula a partir do CNES (FTP DATASUS).

Arquivos por UF e competência (AAMM): ST (estabelecimentos), HB (habilitações) e SR (serviços especializados).
Nome, endereço e coordenadas não estão no FTP; vêm do serviço de consulta do site do CNES.
"""

from __future__ import annotations

import gzip
import json
import logging
import re
import unicodedata
from collections import defaultdict
from collections.abc import Callable, Iterable
from dataclasses import asdict, dataclass, field
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

from workers.collectors.datasus.dbc import read_dbc
from workers.collectors.download import RemoteFile, fetch_remote_file

logger = logging.getLogger(__name__)

FTP_BASE = 'ftp://ftp.datasus.gov.br/dissemin/publicos/CNES/200508_/Dados'
CNES_SERVICE = 'https://cnes.datasus.gov.br/services/estabelecimentos/{codufmun}{cnes}'
IBGE_MUNICIPIOS = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/{uf}/municipios'
SOURCE_LABEL = 'CNES/DataSUS'
# Território nacional. A proximidade (CEP/GPS) é filtro da consulta, não da coleta.
UFS = (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
    'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
)

FIELDS = {
    'ST': ('CNES', 'CODUFMUN', 'COD_CEP', 'TP_UNID', 'NAT_JUR', 'VINC_SUS'),
    'HB': ('CNES', 'SGRUPHAB', 'CMPT_INI', 'CMPT_FIM'),
    'SR': ('CNES', 'SERV_ESP', 'CLASS_SR'),
}

TIPO_HEMOCENTRO = 'hemocentro'
TIPO_TRANSPLANTE = 'transplante'

TP_HEMOTERAPIA = '69'  # Centro de Atenção Hemoterapia e/ou Hematológica
TP_SADT = '39'  # Unidade de apoio diagnose e terapia (SADT isolado)
TP_HOSPITAL_ESPECIALIZADO = '07'
SERVICO_HEMOTERAPIA = '128'
CLASSE_COLETA_SANGUE = '001'  # Procedimentos destinados à obtenção do sangue para fins de assistência
HAB_HEMATOLOGIA = '1710'  # UNACON exclusiva de hematologia

TRANSPLANT_HABILITATIONS = {
    '2401': 'Transplante de medula autogênico',
    '2402': 'Transplante de medula alogênico aparentado',
    '2403': 'Transplante de medula alogênico não aparentado',
}
SERVICE_HABILITATIONS = {
    '1204': 'Hospital-dia pós-transplante de medula',
    '1710': 'Hematologia (UNACON)',
    '2416': 'Banco de sangue de cordão umbilical',
    '2425': 'Laboratório HLA para cadastro de doadores',
}
BLOOD_DONATION = 'Doação de sangue'

LOWER_WORDS = {'a', 'as', 'o', 'os', 'e', 'de', 'da', 'das', 'do', 'dos', 'em', 'na', 'no', 'para'}
UPPER_WORDS = {'imip', 'hupaa', 'sus', 'hemope', 'hemoal', 'hemoar', 'uti', 'hc', 'hu', 'ii', 'iii', 'iv', 'ltda'}


@dataclass(frozen=True)
class Establishment:
    cnes: str
    codufmun: str
    cep: str
    tp_unid: str
    tipo: str
    regra: str
    habilitacoes: list[str] = field(default_factory=list)
    servicos: list[str] = field(default_factory=list)


def to_yyyymm(competencia: str) -> str:
    """'2609' -> '202609'."""
    if not re.fullmatch(r'\d{4}', competencia):
        raise ValueError(f'competência inválida: {competencia!r} (use AAMM, ex.: 2609)')
    return f'20{competencia}'


def competencia_of(day: date) -> str:
    return f'{day.year % 100:02d}{day.month:02d}'


def previous_competencias(start: date, count: int) -> list[str]:
    year, month = start.year, start.month
    result = []
    for _ in range(count):
        result.append(f'{year % 100:02d}{month:02d}')
        year, month = (year, month - 1) if month > 1 else (year - 1, 12)
    return result


def file_url(group: str, uf: str, competencia: str) -> str:
    return f'{FTP_BASE}/{group}/{group}{uf.upper()}{competencia}.dbc'


def latest_competencia(uf: str, today: date | None = None, timeout: int = 60) -> str:
    """Competência mais recente publicada para a UF, procurando nos últimos meses."""
    with urlopen(f'{FTP_BASE}/ST/', timeout=timeout) as response:
        listing = response.read().decode('latin-1')
    for competencia in previous_competencias(today or date.today(), 6):
        if f'ST{uf.upper()}{competencia}.dbc' in listing:
            return competencia
    raise RuntimeError(f'nenhuma competência recente do CNES encontrada para {uf}')


def _active(row: dict[str, str], yyyymm: str) -> bool:
    start = row.get('CMPT_INI') or '000000'
    end = row.get('CMPT_FIM') or '999999'
    return start <= yyyymm <= end


def classify(
    st_rows: Iterable[dict[str, str]],
    hb_rows: Iterable[dict[str, str]],
    sr_rows: Iterable[dict[str, str]],
    competencia: str,
) -> list[Establishment]:
    """Regras de recorte (todas exigem vínculo SUS).

    Transplante: habilitação 2401, 2402 ou 2403 vigente na competência.
    Hemocentro: tipo 69; ou SADT pública com coleta de sangue (serviço 128/001); ou hospital
    especializado público com coleta de sangue e habilitação de hematologia (1710), caso do Hemope.
    Hospitais gerais e maternidades que coletam sangue para uso próprio ficam de fora.
    """
    yyyymm = to_yyyymm(competencia)
    habilitations: dict[str, set[str]] = defaultdict(set)
    for row in hb_rows:
        if _active(row, yyyymm):
            habilitations[row['CNES']].add(row['SGRUPHAB'])
    blood_collection = {
        row['CNES'] for row in sr_rows if row.get('SERV_ESP') == SERVICO_HEMOTERAPIA and row.get('CLASS_SR') == CLASSE_COLETA_SANGUE
    }

    result = []
    for row in st_rows:
        if row.get('VINC_SUS') != '1':
            continue
        cnes = row['CNES']
        habs = habilitations.get(cnes, set())
        public = (row.get('NAT_JUR') or '').startswith('1')
        collects = cnes in blood_collection
        tp_unid = row.get('TP_UNID', '')

        if habs & TRANSPLANT_HABILITATIONS.keys():
            tipo, regra = TIPO_TRANSPLANTE, 'habilitacao-tcth'
        elif tp_unid == TP_HEMOTERAPIA:
            tipo, regra = TIPO_HEMOCENTRO, 'tipo-69'
        elif tp_unid == TP_SADT and public and collects:
            tipo, regra = TIPO_HEMOCENTRO, 'sadt-publica-coleta'
        elif tp_unid == TP_HOSPITAL_ESPECIALIZADO and public and collects and HAB_HEMATOLOGIA in habs:
            tipo, regra = TIPO_HEMOCENTRO, 'hematologia-publica-coleta'
        else:
            continue

        relevant = sorted(habs & (TRANSPLANT_HABILITATIONS.keys() | SERVICE_HABILITATIONS.keys()))
        services = [BLOOD_DONATION] if collects else []
        services += [TRANSPLANT_HABILITATIONS.get(code) or SERVICE_HABILITATIONS[code] for code in relevant]
        result.append(
            Establishment(
                cnes=cnes,
                codufmun=row.get('CODUFMUN', ''),
                cep=row.get('COD_CEP', ''),
                tp_unid=tp_unid,
                tipo=tipo,
                regra=regra,
                habilitacoes=relevant,
                servicos=services,
            )
        )
    return sorted(result, key=lambda item: item.cnes)


def pretty(text: str | None) -> str:
    """'HEMOCENTRO DE ALAGOAS HEMOAL' -> 'Hemocentro de Alagoas Hemoal'."""
    words = re.sub(r'\s+', ' ', text or '').strip().lower().split(' ')
    out = []
    for index, word in enumerate(words):
        if word in UPPER_WORDS:
            out.append(word.upper())
        elif index > 0 and word in LOWER_WORDS:
            out.append(word)
        else:
            out.append(word[:1].upper() + word[1:])
    return ' '.join(out).strip()


def _ascii_key(text: str) -> str:
    return unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode().upper().strip()


def _get_json(url: str, timeout: int, headers: dict[str, str] | None = None) -> Any:
    with urlopen(Request(url, headers=headers or {}), timeout=timeout) as response:
        body = response.read()
    if body.startswith(b'\x1f\x8b'):
        body = gzip.decompress(body)
    return json.loads(body.decode('utf-8'))


def fetch_details(codufmun: str, cnes: str, timeout: int = 30) -> dict[str, Any]:
    """Cadastro público do estabelecimento no site do CNES. Serviço sem documentação oficial."""
    data = _get_json(
        CNES_SERVICE.format(codufmun=codufmun, cnes=cnes),
        timeout,
        {'Referer': 'https://cnes.datasus.gov.br/', 'Accept': 'application/json'},
    )
    return data if isinstance(data, dict) else {}


def fetch_municipalities(uf: str, timeout: int = 30) -> dict[str, dict[str, str]]:
    """Código IBGE de 6 dígitos (como no CNES) -> nome com acentos e código de 7 dígitos."""
    rows = _get_json(IBGE_MUNICIPIOS.format(uf=uf.upper()), timeout)
    return {str(item['id'])[:6]: {'nome': item['nome'], 'codigo_ibge': str(item['id'])} for item in rows}


def _float(value: Any) -> float | None:
    try:
        number = float(str(value).replace(',', '.'))
    except (TypeError, ValueError):
        return None
    return number if number == number and number != 0 else None


def _address(details: dict[str, Any]) -> str:
    street = pretty(details.get('noLogradouro'))
    number = str(details.get('nuEndereco') or '').strip()
    district = pretty(details.get('bairro'))
    line = f'{street}, {number}' if street and number else street
    return ' · '.join(part for part in (line, district) if part)


def to_canonical(
    item: Establishment,
    uf: str,
    details: dict[str, Any],
    municipalities: dict[str, dict[str, str]],
) -> dict[str, Any]:
    municipality = municipalities.get(item.codufmun, {})
    name = pretty(details.get('noFantasia') or details.get('noEmpresarial')) or f'Estabelecimento CNES {item.cnes}'
    return {
        **asdict(item),
        'uf': uf.upper(),
        'codigo_ibge': municipality.get('codigo_ibge') or item.codufmun,
        'cidade': municipality.get('nome') or pretty(details.get('noMunicipio')),
        'nome': name,
        'nome_empresarial': pretty(details.get('noEmpresarial')),
        'endereco': _address(details),
        'telefone': str(details.get('nuTelefone') or '').strip(),
        'lat': _float(details.get('nuLatitude')),
        'lng': _float(details.get('nuLongitude')),
        'detalhes_ok': bool(details),
    }


def collect(
    ufs: Iterable[str],
    competencia: str | None,
    data_dir: Path,
    *,
    enrich: bool = True,
    details_fn: Callable[[str, str], dict[str, Any]] = fetch_details,
    municipalities_fn: Callable[[str], dict[str, dict[str, str]]] = fetch_municipalities,
) -> dict[str, Any]:
    ufs = [uf.strip().upper() for uf in ufs if uf.strip()]
    if not ufs:
        raise ValueError('informe ao menos uma UF')
    competencia = competencia or latest_competencia(ufs[0])
    to_yyyymm(competencia)

    raw_files: list[RemoteFile] = []
    establishments: list[dict[str, Any]] = []
    warnings: list[str] = []
    for uf in ufs:
        rows: dict[str, list[dict[str, str]]] = {}
        for group, fields in FIELDS.items():
            remote = fetch_remote_file(data_dir / 'raw' / 'cnes' / competencia / f'{group}{uf}{competencia}.dbc', file_url(group, uf, competencia))
            raw_files.append(remote)
            rows[group] = read_dbc(remote.path, fields)

        selected = classify(rows['ST'], rows['HB'], rows['SR'], competencia)
        municipalities: dict[str, dict[str, str]] = {}
        if enrich:
            try:
                municipalities = municipalities_fn(uf)
            except Exception as exc:  # noqa: BLE001
                warnings.append(f'{uf}: nomes de municípios indisponíveis no IBGE ({exc})')
        for item in selected:
            details: dict[str, Any] = {}
            if enrich:
                try:
                    details = details_fn(item.codufmun, item.cnes)
                except Exception as exc:  # noqa: BLE001
                    warnings.append(f'{item.cnes}: cadastro indisponível no site do CNES ({exc})')
            establishments.append(to_canonical(item, uf, details, municipalities))
        logger.info('CNES %s %s: %s estabelecimentos no recorte', uf, competencia, len(selected))

    return {
        'source': 'cnes',
        'source_label': SOURCE_LABEL,
        'competencia': competencia,
        'ufs': ufs,
        'collected_at': datetime.now(UTC).isoformat(timespec='seconds'),
        'raw_files': [item.describe() for item in raw_files],
        'establishments': establishments,
        'warnings': warnings,
    }
