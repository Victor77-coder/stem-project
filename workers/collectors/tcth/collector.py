"""Estatísticas de transplante de medula óssea (TCTH) em todo o Brasil.

DataSUS/Tabnet, SIH/SUS ("Procedimentos hospitalares do SUS - por local de residência"): internações com
procedimento principal de TCTH, por UF de residência do paciente e ano de processamento. Mesmo critério dos
doadores do REDOME: o morador de Alagoas transplantado em Pernambuco conta para Alagoas. Conta só o que o
SUS pagou; transplantes feitos na rede privada ficam de fora.

REDOME/INCA (painel público de doadores, Power BI): doadores cadastrados por UF em cada ano, a mesma
contagem que o painel mostra com o filtro "Ano" (ex.: Alagoas, 2025: 2.454). Conta todos os cadastros do ano,
inclusive de quem depois foi afastado. Os anos são os mesmos dos transplantes.
"""

from __future__ import annotations

import csv
import hashlib
import html
import logging
import re
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import urlencode

from workers.collectors import powerbi
from workers.collectors.download import RemoteFile, fetch_remote_file

logger = logging.getLogger(__name__)

# O Tabnet não responde em HTTPS.
TABNET_CGI = 'http://tabnet.datasus.gov.br/cgi'
TABNET_DEF = 'sih/cnv/qruf.def'
# Prefixo dos arquivos mensais do formulário (qrufAAMM.dbf).
TABNET_FILES = 'qruf'
FORM_URL = f'{TABNET_CGI}/deftohtm.exe?{TABNET_DEF}'
QUERY_URL = f'{TABNET_CGI}/tabcgi.exe?{TABNET_DEF}'
SOURCE_LABEL = 'DataSUS/Tabnet (SIH/SUS) e REDOME/INCA'

# Painel "Acesse os dados de doadores" da página REDOME em números.
REDOME_PBI_KEY = '64e0a059-5dae-4cc2-a610-510d48e74aa7'
REDOME_PBI_TENANT = 'd83284d8-5707-4978-9590-7a1b6bcb84c3'
REDOME_DASHBOARD_URL = powerbi.view_url(REDOME_PBI_KEY, REDOME_PBI_TENANT)
REDOME_ENTITIES = {'r': 'DIM_DADOS_REGIOES', 'c': 'DIM_CALENDARIO', 'm': '_Medidas'}
REDOME_NOT_INFORMED = 'NI'
# Faixa plausível de cadastros no Brasil em um ano (2011, o recorde, teve 724 mil); fora dela o modelo do
# painel mudou e o número não é confiável.
REDOME_YEAR_RANGE = (10_000, 2_000_000)

# TCTH no SIGTAP (forma de organização 05.05.01). Córnea, esclera e membrana amniótica, que estão na
# mesma forma de organização, ficam de fora.
PROCEDURES = {
    '0505010011': 'Alogênico aparentado · medula óssea',
    '0505010020': 'Alogênico não aparentado · medula óssea',
    '0505010038': 'Alogênico aparentado · sangue de cordão umbilical',
    '0505010046': 'Alogênico não aparentado · sangue de cordão umbilical',
    '0505010054': 'Alogênico aparentado · sangue periférico',
    '0505010062': 'Alogênico não aparentado · sangue periférico',
    '0505010070': 'Autogênico · medula óssea',
    '0505010089': 'Autogênico · sangue periférico',
}
ROW = 'Unidade_da_Federação'
COLUMN = 'Ano_processamento'
# "Internações" não conta AIH de continuação (longa permanência): cada transplante entra uma vez.
CONTENT = 'Internações'
ALL_CATEGORIES = 'TODAS_AS_CATEGORIAS__'
# O SIH revisa os últimos meses; recoletar a janela inteira a cada carga pega essas correções.
YEARS_BACK = 5

UF_BY_IBGE = {
    '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
    '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
    '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR', '42': 'SC', '43': 'RS',
    '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
}

@dataclass(frozen=True)
class TabnetForm:
    competencias: tuple[str, ...]  # AAMM publicadas, da mais recente para a mais antiga
    procedures: dict[str, str]  # código SIGTAP -> valor da opção no formulário (índice interno do Tabnet)
    filters: tuple[str, ...]  # nomes dos campos de seleção (SRegião, SProcedimento, ...)


@dataclass(frozen=True)
class TabnetTable:
    years: list[str]
    by_uf: dict[str, dict[str, int]]
    total: dict[str, int]
    # Linhas que não são UF (residência ignorada ou no exterior): entram só no total do Brasil.
    without_uf: dict[str, dict[str, int]]


def _text(fragment: str) -> str:
    without_code = re.sub(r'<(script|style)\b.*?</\1>', ' ', fragment, flags=re.S | re.I)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', without_code))).strip()


def _select(page: str, name: str) -> str:
    match = re.search(rf'<SELECT[^>]*NAME="{re.escape(name)}"[^>]*>(.*?)</SELECT>', page, re.S | re.I)
    return match.group(1) if match else ''


def parse_form(page: str) -> TabnetForm:
    """Períodos publicados e índice de cada procedimento de TCTH no formulário do Tabnet."""
    competencias = sorted(set(re.findall(rf'VALUE="{TABNET_FILES}(\d{{4}})\.dbf"', _select(page, 'Arquivos'), re.I)), reverse=True)
    options = re.findall(r'<OPTION VALUE="(\d+)"\s*>\s*(\d{10})\b', _select(page, 'SProcedimento'), re.I)
    procedures = {code: value for value, code in options if code in PROCEDURES}
    filters = tuple(re.findall(r'<SELECT[^>]*NAME="(S[^"]+)"', page))
    if not competencias or 'SProcedimento' not in filters:
        raise RuntimeError('formulário do Tabnet mudou: períodos ou filtro de procedimento não encontrados')
    return TabnetForm(tuple(competencias), procedures, filters)


def complete_years(competencias: Iterable[str], until: str | None, count: int) -> list[str]:
    """Últimos ``count`` anos com os 12 meses publicados até ``until`` (AAMM). Ano parcial fica de fora."""
    available = {c for c in competencias if until is None or c <= until}
    full = sorted({c[:2] for c in available if all(f'{c[:2]}{month:02d}' in available for month in range(1, 13))})
    return [f'20{yy}' for yy in full[-count:]]


def query_body(form: TabnetForm, years: list[str]) -> bytes:
    """Formulário do Tabnet: TCTH por UF e ano de processamento, saída em colunas separadas por ';'."""
    wanted = {year[2:] for year in years}
    pairs = [('Linha', ROW), ('Coluna', COLUMN), ('Incremento', CONTENT)]
    pairs += [('Arquivos', f'{TABNET_FILES}{c}.dbf') for c in sorted(form.competencias) if c[:2] in wanted]
    for name in form.filters:
        if name == 'SProcedimento':
            pairs += [(name, form.procedures[code]) for code in sorted(form.procedures)]
        else:
            pairs.append((name, ALL_CATEGORIES))
    pairs += [('formato', 'prn'), ('mostre', 'Mostra')]
    # O Tabnet é Latin-1, inclusive nos nomes dos campos (Unidade_da_Federação).
    return urlencode(pairs, encoding='latin-1').encode('ascii')


def _count(cell: str) -> int:
    cell = cell.strip()
    if cell == '-':  # legenda do Tabnet: zero não resultante de arredondamento
        return 0
    if not re.fullmatch(r'\d+', cell):
        raise ValueError(f'valor inesperado na tabela do Tabnet: {cell!r}')
    return int(cell)


def parse_table(raw: bytes) -> TabnetTable:
    text = html.unescape(raw.decode('latin-1'))
    lines = [line.strip() for line in text.splitlines() if line.strip().startswith('"')]
    if len(lines) < 2:
        raise RuntimeError(f'resposta do Tabnet sem tabela: {_text(text)[:200]}')
    header, *rows = csv.reader(lines, delimiter=';')
    year_columns = {index: cell.strip() for index, cell in enumerate(header) if re.fullmatch(r'\d{4}', cell.strip())}
    by_uf: dict[str, dict[str, int]] = {}
    total: dict[str, int] = {}
    without_uf: dict[str, dict[str, int]] = {}
    for row in rows:
        label = row[0].strip()
        values = {year: _count(row[index]) for index, year in year_columns.items()}
        if label == 'Total':
            total = values
            continue
        uf = UF_BY_IBGE.get(label.split(' ', 1)[0])
        if uf is None:
            without_uf[label] = values
        else:
            by_uf[uf] = values
    return TabnetTable(list(year_columns.values()), by_uf, total, without_uf)


def redome_query(report: powerbi.PublicReport, years: list[str]) -> bytes:
    """Doadores cadastrados por UF e ano: a medida do card "Total de doadores" agrupada pelo mesmo "Ano"
    (DIM_CALENDARIO) do filtro do painel. Nenhum outro filtro: "Liberado S/N" fica sem seleção no painel."""
    return powerbi.query_body(
        report,
        REDOME_ENTITIES,
        [powerbi.column('r', 'Sigla'), powerbi.column('c', 'Ano'), powerbi.measure('m', 'Contagem DMR')],
        [powerbi.is_in(powerbi.column('c', 'Ano'), [int(year) for year in years])],
    )


def parse_redome(rows: list[list[Any]], years: list[str]) -> dict[str, Any]:
    """Linhas [UF, ano, cadastros]. UF sem linha num ano = nenhum cadastro naquele ano."""
    by_uf: dict[str, dict[str, int]] = {uf: {year: 0 for year in years} for uf in UF_BY_IBGE.values()}
    not_informed = {year: 0 for year in years}
    seen_ufs, seen_years, unexpected = set(), set(), set()
    for code, year, count in rows:
        year = str(year)
        if year not in not_informed:
            raise RuntimeError(f'painel do REDOME devolveu ano fora da consulta: {year!r}')
        if not isinstance(count, int) or count < 0:
            raise RuntimeError(f'painel do REDOME: contagem inválida para {code!r} em {year} ({count!r})')
        seen_years.add(year)
        if code in by_uf:
            by_uf[code][year] = count
            seen_ufs.add(code)
        else:
            not_informed[year] += count
            if code != REDOME_NOT_INFORMED:
                unexpected.add(str(code))
    missing_ufs = sorted(by_uf.keys() - seen_ufs)
    missing_years = sorted(set(years) - seen_years)
    if missing_ufs or missing_years:
        raise RuntimeError(f'painel do REDOME sem as UFs {missing_ufs} ou sem os anos {missing_years}')
    totals = {year: sum(values[year] for values in by_uf.values()) + not_informed[year] for year in years}
    low, high = REDOME_YEAR_RANGE
    outside = {year: total for year, total in totals.items() if not low <= total <= high}
    if outside:
        raise RuntimeError(f'painel do REDOME: cadastros no ano fora da faixa esperada ({outside})')
    return {
        'criterio': 'cadastros no ano (filtro "Ano" do painel)',
        'anos': years,
        'doadores': totals,
        'por_uf': by_uf,
        'uf_nao_informada': not_informed,
        'codigos_fora_das_ufs': sorted(unexpected),
        'url': REDOME_DASHBOARD_URL,
    }


def collect_redome(raw_dir: Path, raw_files: list[RemoteFile], years: list[str]) -> dict[str, Any]:
    """Painel público do REDOME no Power BI. Só consulta agregada: o modelo tem registros por doador."""
    view = fetch_remote_file(raw_dir / 'powerbi_view.html', REDOME_DASHBOARD_URL, timeout=60)
    raw_files.append(view)
    api = powerbi.api_from_view(view.path.read_text(encoding='utf-8', errors='replace'))
    models = fetch_remote_file(
        raw_dir / 'powerbi_models.json', powerbi.models_url(api, REDOME_PBI_KEY), timeout=60, headers={'X-PowerBI-ResourceKey': REDOME_PBI_KEY}
    )
    raw_files.append(models)
    report = powerbi.report_from(powerbi.load_json(models.path.read_bytes()), REDOME_PBI_KEY, api)
    body = redome_query(report, years)
    result = fetch_remote_file(
        raw_dir / f'powerbi_doadores_uf_{years[0]}-{years[-1]}.json', report.query_url, timeout=120, headers=report.headers, data=body
    )
    raw_files.append(result)
    return parse_redome(powerbi.decode(powerbi.load_json(result.path.read_bytes())), years)


def collect(competencia: str | None, data_dir: Path, *, years_back: int = YEARS_BACK) -> dict[str, Any]:
    if competencia and not re.fullmatch(r'\d{4}', competencia):
        raise ValueError(f'competência inválida: {competencia!r} (use AAMM, ex.: 2512)')
    raw_dir = data_dir / 'raw' / 'tcth'
    raw_files: list[RemoteFile] = []
    warnings: list[str] = []

    form_file = fetch_remote_file(raw_dir / 'tabnet' / f'{TABNET_FILES}_form.html', FORM_URL)
    raw_files.append(form_file)
    form = parse_form(form_file.path.read_text(encoding='latin-1'))
    if not form.procedures:
        raise RuntimeError('nenhum procedimento de TCTH encontrado no formulário do Tabnet')
    missing = sorted(PROCEDURES.keys() - form.procedures.keys())
    if missing:
        warnings.append(f'Tabnet: procedimentos de TCTH fora do formulário e da contagem: {", ".join(missing)}')

    years = complete_years(form.competencias, competencia or None, years_back)
    if not years:
        raise RuntimeError(f'nenhum ano completo publicado no Tabnet até {competencia or "a competência mais recente"}')
    last_month = f'{years[-1][2:]}12'
    body = query_body(form, years)
    query_file = fetch_remote_file(
        raw_dir / 'tabnet' / last_month / f'tcth_residencia_{years[0]}-{years[-1]}_{hashlib.sha256(body).hexdigest()[:8]}.html',
        QUERY_URL,
        timeout=300,
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        data=body,
    )
    raw_files.append(query_file)
    table = parse_table(query_file.path.read_bytes())
    absent = [year for year in years if year not in table.years]
    if absent:
        raise RuntimeError(f'Tabnet não devolveu os anos {", ".join(absent)}')

    # UF ausente na tabela = nenhuma internação por TCTH no ano (o Tabnet omite linhas zeradas).
    by_uf = {uf: {year: table.by_uf.get(uf, {}).get(year, 0) for year in years} for uf in UF_BY_IBGE.values()}
    without_uf = {year: sum(values.get(year, 0) for values in table.without_uf.values()) for year in years}
    if any(without_uf.values()):
        warnings.append(f'Tabnet: pacientes sem UF de residência válida ({", ".join(table.without_uf)}) entram só no total do Brasil')
    for year in years:
        summed = sum(values[year] for values in by_uf.values()) + without_uf[year]
        if table.total.get(year) != summed:
            warnings.append(f'Tabnet {year}: soma das UFs ({summed}) difere do total da tabela ({table.total.get(year)})')
    logger.info('Tabnet TCTH %s-%s: %s', years[0], years[-1], {year: table.total.get(year) for year in years})

    # Sem o painel, a carga segue sem doadores: o contador do site usa outra definição e misturaria séries.
    redome = None
    try:
        redome = collect_redome(raw_dir / 'redome', raw_files, years)
        logger.info('REDOME, cadastros por ano: %s (sem UF: %s)', redome['doadores'], redome['uf_nao_informada'])
        if redome['codigos_fora_das_ufs']:
            warnings.append(f'REDOME: códigos de UF desconhecidos somados a "não informada": {", ".join(redome["codigos_fora_das_ufs"])}')
    except Exception as exc:  # noqa: BLE001
        warnings.append(f'REDOME: doadores por UF indisponíveis no painel ({exc})')

    return {
        'source': 'tcth',
        'source_label': SOURCE_LABEL,
        'competencia': last_month,
        'publicado_ate': form.competencias[0],
        'collected_at': datetime.now(UTC).isoformat(timespec='seconds'),
        'raw_files': [item.describe() for item in raw_files],
        'transplantes': {
            'conteudo': CONTENT,
            'recorte': 'UF de residência do paciente, ano de processamento',
            'procedimentos': sorted(form.procedures),
            'anos': years,
            'por_uf': by_uf,
            'sem_uf': without_uf,
            'total_tabnet': {year: table.total.get(year) for year in years},
        },
        'redome': redome,
        'warnings': warnings,
    }
