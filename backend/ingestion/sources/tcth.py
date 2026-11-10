"""Aplica a carga de estatísticas de transplante de medula (DataSUS/Tabnet e REDOME) nos indicadores públicos.

Cada carga grava uma extração datada (data_extracao = dia da coleta) e a API pública lê sempre a mais recente:
revisões do SIH entram sem apagar o que já foi exibido. Brasil e regiões saem da soma das UFs, para os três
recortes baterem entre si. Os números de exemplo do seed saem assim que o indicador passa a ter dado coletado.
"""

import re
from datetime import date, datetime
from decimal import Decimal

from django.db.models import Q
from django.utils import timezone

from catalog.models import Statistic
from catalog.public import REGION_OF
from catalog.seed_data import STATS_DATE, STATS_SOURCE

Indicator = Statistic.Indicator
SIH_SOURCE = 'DataSUS/Tabnet (SIH/SUS, por residência)'
REDOME_SOURCE = 'REDOME/INCA (painel de doadores)'
REGIONS = ('Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul')


def placeholders() -> Q:
    """Linhas de exemplo criadas pelo seed_mvp, que não vêm de nenhuma fonte real."""
    return Q(fonte=STATS_SOURCE, data_extracao=date.fromisoformat(STATS_DATE))


def _extracted_on(canonical: dict) -> date:
    raw = canonical.get('collected_at')
    if raw:
        try:
            return datetime.fromisoformat(raw).date()
        except ValueError:
            pass
    return timezone.localdate()


def _count(value) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f'contagem inválida na carga: {value!r}')
    return value


def _thousands(number: int) -> str:
    return f'{number:,}'.replace(',', '.')


def _row(indicator: str, recorte: str, periodo: str, value: int, fonte: str, rotulo: str, underreporting: bool) -> dict:
    return {
        'indicador': indicator,
        'recorte': recorte,
        'periodo': periodo,
        'valor': Decimal(value),
        'rotulo': rotulo,
        'fonte': fonte,
        'aviso_subnotificacao': underreporting,
    }


def _check_ufs(by_uf: dict, what: str) -> None:
    unknown, missing = sorted(by_uf.keys() - REGION_OF.keys()), sorted(REGION_OF.keys() - by_uf.keys())
    if unknown or missing:
        raise ValueError(f'carga de {what} precisa das 27 UFs (desconhecidas: {unknown}, ausentes: {missing})')


def _transplant_rows(data: dict) -> list[dict]:
    """Transplantes por UF de residência do paciente, por região e no Brasil, em cada ano.

    O Brasil inclui quem está sem UF de residência válida (ignorada ou exterior), como nos doadores.
    """
    years = [str(year) for year in data.get('anos') or []]
    if not years or not all(re.fullmatch(r'\d{4}', year) for year in years):
        raise ValueError('carga de transplantes sem anos válidos')
    by_uf = data.get('por_uf') or {}
    _check_ufs(by_uf, 'transplantes')
    without_uf = data.get('sem_uf') or {}

    rows = []
    for year in years:
        counts = {uf: _count(by_uf[uf].get(year)) for uf in sorted(by_uf)}
        brasil = sum(counts.values()) + _count(without_uf.get(year, 0))
        # SIH conta só o que o SUS pagou: o aviso de subnotificação vale para todo o recorte.
        rows.append(_row(Indicator.TRANSPLANTES, 'BR', year, brasil, SIH_SOURCE, _thousands(brasil), True))
        for uf, number in counts.items():
            rows.append(_row(Indicator.TRANSPLANTES, uf, year, number, SIH_SOURCE, _thousands(number), True))
        for region in REGIONS:
            number = sum(value for uf, value in counts.items() if REGION_OF[uf] == region)
            rows.append(_row(Indicator.TRANSPLANTES_REGIAO, region, year, number, SIH_SOURCE, _thousands(number), True))
    return rows


def _donor_rows(redome: dict) -> list[dict]:
    """Doadores cadastrados no REDOME em cada ano, como o painel mostra com o filtro "Ano", no Brasil, por UF
    e por região. O Brasil inclui quem está sem UF informada, então pode ser maior que a soma das UFs."""
    years = [str(year) for year in redome.get('anos') or []]
    if not years or not all(re.fullmatch(r'\d{4}', year) for year in years):
        raise ValueError('carga de doadores sem anos válidos')
    totals = redome.get('doadores') or {}
    by_uf = redome.get('por_uf') or {}
    _check_ufs(by_uf, 'doadores')

    rows = []
    for year in years:
        total = _count(totals.get(year))
        counts = {uf: _count(by_uf[uf].get(year)) for uf in sorted(by_uf)}
        if sum(counts.values()) > total:
            raise ValueError(f'carga de doadores de {year} com soma das UFs maior que o total do Brasil')
        # Número completo, como no painel: o app compara direto com o Power BI.
        rows.append(_row(Indicator.DOADORES, 'BR', year, total, REDOME_SOURCE, _thousands(total), False))
        for uf, number in counts.items():
            rows.append(_row(Indicator.DOADORES, uf, year, number, REDOME_SOURCE, _thousands(number), False))
        for region in REGIONS:
            number = sum(value for uf, value in counts.items() if REGION_OF[uf] == region)
            rows.append(_row(Indicator.DOADORES, region, year, number, REDOME_SOURCE, _thousands(number), False))
    return rows


def _save(row: dict, extracted: date, stats: dict) -> None:
    key = {name: row[name] for name in ('indicador', 'recorte', 'periodo')}
    previous = Statistic.objects.filter(**key).exclude(placeholders()).order_by('-data_extracao').first()
    Statistic.objects.update_or_create(
        **key, data_extracao=extracted, defaults={name: row[name] for name in ('valor', 'rotulo', 'fonte', 'aviso_subnotificacao')}
    )
    if previous is None:
        stats['novos'] += 1
    elif previous.valor != row['valor']:
        stats['alterados'] += 1
    else:
        stats['inalterados'] += 1


def apply(canonical: dict) -> dict:
    extracted = _extracted_on(canonical)
    rows = _transplant_rows(canonical.get('transplantes') or {})
    warnings = []

    redome = canonical.get('redome')
    if redome:
        rows += _donor_rows(redome)
    else:
        warnings.append('REDOME: doadores não vieram nesta carga; a API segue com a última extração disponível.')

    stats = {'recebidos': len(rows), 'novos': 0, 'alterados': 0, 'inalterados': 0}
    stats['exemplos_removidos'] = Statistic.objects.filter(placeholders(), indicador__in={row['indicador'] for row in rows}).delete()[0]
    for row in rows:
        _save(row, extracted, stats)
    stats['anos'] = sorted({row['periodo'] for row in rows if row['indicador'] == Indicator.TRANSPLANTES})
    return {'stats': stats, 'warnings': warnings}
