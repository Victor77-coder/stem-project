import json
from pathlib import Path
from urllib.parse import parse_qs

import pytest

from workers.collectors import powerbi
from workers.collectors.tcth import collector
from workers.collectors.tcth.collector import (
    PROCEDURES,
    complete_years,
    parse_form,
    parse_redome,
    parse_table,
    query_body,
    redome_query,
)

FIXTURES = Path(__file__).parent / 'fixtures' / 'tcth'
FORM = (FIXTURES / 'tabnet_qruf_form.html').read_text(encoding='latin-1')
# SIH por local de residência do paciente, internações por TCTH em 2024 e 2025.
TABLE = (FIXTURES / 'tabnet_residencia_2024_2025.html').read_bytes()
PBI_VIEW = (FIXTURES / 'powerbi_view.html').read_bytes()
PBI_MODELS = (FIXTURES / 'powerbi_models.json').read_bytes()
# Painel do REDOME: doadores cadastrados por UF em 2024 e 2025 (filtro "Ano").
PBI_DONORS = (FIXTURES / 'powerbi_doadores_uf_ano.json').read_bytes()
YEARS = ['2024', '2025']
PBI_API = 'https://wabi-brazil-south-b-primary-api.analysis.windows.net'
PBI_REPORT = powerbi.report_from(json.loads(PBI_MODELS), collector.REDOME_PBI_KEY, PBI_API)
DONOR_ROWS = powerbi.decode(json.loads(PBI_DONORS))


def test_form_maps_sigtap_codes_to_tabnet_option_values():
    form = parse_form(FORM)
    assert form.competencias[0] == '2608' and form.competencias[-1] == '0801'
    assert form.procedures == {code: str(4246 + index) for index, code in enumerate(sorted(PROCEDURES))}
    assert '0505010097' not in form.procedures, 'transplante de córnea não é TCTH'
    assert '0501010050' not in form.procedures, 'cadastro de doador no REDOME não é transplante'
    assert {'SProcedimento', 'SUnidade_da_Federação', 'SRegião'} <= set(form.filters)


def test_only_complete_years_are_collected():
    competencias = parse_form(FORM).competencias
    assert complete_years(competencias, None, 5) == ['2021', '2022', '2023', '2024', '2025']
    assert complete_years(competencias, '2511', 2) == ['2023', '2024']
    assert complete_years(competencias, '2512', 2) == ['2024', '2025']
    assert complete_years(['2601', '2602'], None, 5) == []


def test_query_asks_hospitalizations_by_residence_uf_for_tcth_only():
    form = parse_form(FORM)
    fields = parse_qs(query_body(form, ['2024', '2025']).decode('ascii'), encoding='latin-1')
    assert fields['Linha'] == ['Unidade_da_Federação']
    assert fields['Coluna'] == ['Ano_processamento']
    assert fields['Incremento'] == ['Internações']
    assert fields['formato'] == ['prn']
    assert sorted(fields['SProcedimento']) == sorted(form.procedures.values())
    assert len(fields['Arquivos']) == 24 and 'qruf2401.dbf' in fields['Arquivos'] and 'qruf2512.dbf' in fields['Arquivos']
    assert fields['SUnidade_da_Federação'] == ['TODAS_AS_CATEGORIAS__']


def test_tabnet_table_is_parsed_by_residence_uf_and_year():
    table = parse_table(TABLE)
    assert table.years == ['2024', '2025']
    assert len(table.by_uf) == 27
    assert table.by_uf['SP'] == {'2024': 889, '2025': 909}
    assert table.by_uf['AL'] == {'2024': 49, '2025': 51}, 'alagoanos transplantados, mesmo fora de AL'
    assert table.total == {'2024': 3178, '2025': 3258}
    assert sum(values['2025'] for values in table.by_uf.values()) == 3258
    assert table.without_uf == {}


def test_tabnet_dash_is_zero():
    table = parse_table(TABLE.replace(b'"27 Alagoas";49;51;100', b'"27 Alagoas";-;51;51'))
    assert table.by_uf['AL'] == {'2024': 0, '2025': 51}


def test_tabnet_error_page_is_not_mistaken_for_data():
    with pytest.raises(RuntimeError, match='sem tabela'):
        parse_table('<html><body>Erro: nenhum arquivo selecionado</body></html>'.encode('latin-1'))


def test_redome_registrations_by_uf_and_year_match_the_dashboard():
    data = parse_redome(DONOR_ROWS, YEARS)
    assert data['por_uf']['AL'] == {'2024': 3_806, '2025': 2_454}, 'painel: Alagoas, Ano 2025 = 2.454'
    assert data['por_uf']['PE'] == {'2024': 6_347, '2025': 5_651}
    assert len(data['por_uf']) == 27
    assert data['doadores'] == {'2024': 138_701, '2025': 148_618}
    assert data['uf_nao_informada'] == {'2024': 0, '2025': 1}
    for year in YEARS:
        assert data['doadores'][year] == sum(values[year] for values in data['por_uf'].values()) + data['uf_nao_informada'][year]
    assert data['codigos_fora_das_ufs'] == []


def test_redome_query_groups_the_dashboard_count_by_uf_and_year():
    body = json.loads(redome_query(PBI_REPORT, YEARS))
    query = body['queries'][0]['Query']['Commands'][0]['SemanticQueryDataShapeCommand']['Query']
    assert [item.get('Column', item.get('Measure'))['Property'] for item in query['Select']] == ['Sigla', 'Ano', 'Contagem DMR']
    condition = query['Where'][0]['Condition']['In']
    assert condition['Expressions'][0]['Column']['Property'] == 'Ano'
    assert condition['Values'] == [[{'Literal': {'Value': '2024L'}}], [{'Literal': {'Value': '2025L'}}]]
    assert {source['Entity'] for source in query['From']} == {'DIM_DADOS_REGIOES', 'DIM_CALENDARIO', '_Medidas'}
    assert body['modelId'] == 3942715


def test_redome_uf_without_registrations_in_a_year_is_zero():
    rows = [row for row in DONOR_ROWS if row[:2] != ['AC', 2025]]
    assert parse_redome(rows, YEARS)['por_uf']['AC'] == {'2024': 823, '2025': 0}


def test_redome_unknown_uf_code_goes_to_not_informed_and_is_reported():
    data = parse_redome([*DONOR_ROWS, ['XX', 2025, 10]], YEARS)
    assert data['uf_nao_informada']['2025'] == 11 and data['codigos_fora_das_ufs'] == ['XX']


def test_redome_model_change_is_reported_not_guessed():
    with pytest.raises(RuntimeError, match="sem as UFs \\['AC'\\]"):
        parse_redome([row for row in DONOR_ROWS if row[0] != 'AC'], YEARS)
    with pytest.raises(RuntimeError, match="sem os anos \\['2024'\\]"):
        parse_redome([row for row in DONOR_ROWS if row[1] != 2024], YEARS)
    with pytest.raises(RuntimeError, match='fora da consulta'):
        parse_redome([*DONOR_ROWS, ['AL', 2019, 5]], YEARS)
    with pytest.raises(RuntimeError, match='fora da faixa'):
        parse_redome([[uf, year, 1] for uf, year, _ in DONOR_ROWS], YEARS)
    with pytest.raises(RuntimeError, match='contagem inválida'):
        parse_redome([[uf, year, None] for uf, year, _ in DONOR_ROWS], YEARS)


@pytest.fixture
def offline(monkeypatch, tmp_path):
    """Serve as fixtures no lugar da rede; ``pages`` permite trocar ou derrubar uma fonte."""
    pages = {
        collector.FORM_URL: FORM.encode('latin-1'),
        collector.QUERY_URL: TABLE,
        collector.REDOME_DASHBOARD_URL: PBI_VIEW,
        powerbi.models_url(PBI_API, collector.REDOME_PBI_KEY): PBI_MODELS,
        PBI_REPORT.query_url: PBI_DONORS,
    }
    requests = []

    def fake_fetch(path, url, **kwargs):
        requests.append((url, kwargs.get('data')))
        body = pages[url]
        if isinstance(body, Exception):
            raise body
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
        return collector.RemoteFile(path=path, url=url, status='downloaded', sha256='abc', size=len(body))

    monkeypatch.setattr(collector, 'fetch_remote_file', fake_fetch)
    return pages, requests, tmp_path


def test_collect_builds_national_payload(offline):
    pages, requests, tmp_path = offline
    payload = collector.collect('2512', tmp_path, years_back=2)
    assert payload['source'] == 'tcth'
    assert payload['competencia'] == '2512' and payload['publicado_ate'] == '2608'
    transplants = payload['transplantes']
    assert transplants['anos'] == ['2024', '2025']
    assert len(transplants['por_uf']) == 27
    assert transplants['por_uf']['AL'] == {'2024': 49, '2025': 51}
    assert transplants['por_uf']['PE'] == {'2024': 136, '2025': 140}
    assert transplants['sem_uf'] == {'2024': 0, '2025': 0}
    assert transplants['total_tabnet'] == {'2024': 3178, '2025': 3258}
    assert payload['redome']['doadores'] == {'2024': 138_701, '2025': 148_618}
    assert payload['redome']['por_uf']['AL'] == {'2024': 3_806, '2025': 2_454}
    assert payload['warnings'] == []
    names = [item['name'] for item in payload['raw_files']]
    assert names[0] == 'qruf_form.html' and names[1].startswith('tcth_residencia_2024-2025_')
    assert names[2:] == ['powerbi_view.html', 'powerbi_models.json', 'powerbi_doadores_uf_2024-2025.json']
    query = next(data for url, data in requests if url == collector.QUERY_URL)
    assert b'SProcedimento=4246' in query
    redome = next(data for url, data in requests if url == PBI_REPORT.query_url)
    assert b'Contagem DMR' in redome and b'DS_SITUACAO_DOADOR' not in redome


def test_collect_survives_redome_dashboard_outage(offline):
    pages, _, tmp_path = offline
    pages[PBI_REPORT.query_url] = RuntimeError('falha ao baixar: connection reset by peer')
    payload = collector.collect('2512', tmp_path, years_back=2)
    assert payload['redome'] is None
    assert any(warning.startswith('REDOME:') for warning in payload['warnings'])
    assert payload['transplantes']['total_tabnet']['2025'] == 3258


def test_collect_fails_when_tabnet_is_down(offline):
    pages, _, tmp_path = offline
    pages[collector.QUERY_URL] = RuntimeError('falha ao baixar: timed out')
    with pytest.raises(RuntimeError, match='timed out'):
        collector.collect('2512', tmp_path, years_back=2)


def test_collect_fails_when_tabnet_misses_a_requested_year(offline):
    _, _, tmp_path = offline
    with pytest.raises(RuntimeError, match='2023'):
        collector.collect('2512', tmp_path, years_back=3)


def test_collect_warns_when_uf_sum_differs_from_tabnet_total(offline):
    pages, _, tmp_path = offline
    pages[collector.QUERY_URL] = TABLE.replace(b'"Total";3178;3258;6436', b'"Total";3178;3260;6438')
    payload = collector.collect('2512', tmp_path, years_back=2)
    assert any('2025' in warning and 'difere' in warning for warning in payload['warnings'])


def test_patients_without_valid_residence_go_only_to_the_national_total(offline):
    pages, _, tmp_path = offline
    pages[collector.QUERY_URL] = TABLE.replace(
        b'"Total";3178;3258;6436', b'"Ignorado/Exterior";2;3;5\r\n"Total";3180;3261;6441'
    )
    payload = collector.collect('2512', tmp_path, years_back=2)
    assert payload['transplantes']['sem_uf'] == {'2024': 2, '2025': 3}
    assert any('sem UF de residência' in warning for warning in payload['warnings'])
    assert not any('difere' in warning for warning in payload['warnings'])


def test_collect_warns_when_a_tcth_procedure_leaves_the_form(offline):
    pages, _, tmp_path = offline
    pages[collector.FORM_URL] = FORM.replace('0505010038 ', '9999999999 ').encode('latin-1')
    payload = collector.collect('2512', tmp_path, years_back=2)
    assert '0505010038' not in payload['transplantes']['procedimentos']
    assert any('0505010038' in warning for warning in payload['warnings'])
