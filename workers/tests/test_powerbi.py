import gzip
import json
from pathlib import Path

import pytest

from workers.collectors import powerbi

FIXTURES = Path(__file__).parent / 'fixtures' / 'tcth'
KEY = '64e0a059-5dae-4cc2-a610-510d48e74aa7'
TENANT = 'd83284d8-5707-4978-9590-7a1b6bcb84c3'


def test_view_url_is_the_link_published_by_redome():
    assert powerbi.view_url(KEY, TENANT) == (
        'https://app.powerbi.com/view?r=eyJrIjoiNjRlMGEwNTktNWRhZS00Y2MyLWE2MTAtNTEwZDQ4ZTc0YWE3IiwidCI6ImQ4MzI4NGQ4LTU3MDctNDk3OC05NTkwLTdhMWI2YmNiODRjMyJ9'
    )


def test_api_host_comes_from_the_public_viewer():
    view = (FIXTURES / 'powerbi_view.html').read_text(encoding='utf-8')
    assert powerbi.api_from_view(view) == 'https://wabi-brazil-south-b-primary-api.analysis.windows.net'
    with pytest.raises(RuntimeError, match='resolvedClusterUri'):
        powerbi.api_from_view('<html>manutenção</html>')


def test_report_identifiers_and_gzip_body():
    raw = gzip.compress((FIXTURES / 'powerbi_models.json').read_bytes())
    report = powerbi.report_from(powerbi.load_json(raw), KEY, 'https://api')
    assert (report.model_id, report.dataset_id, report.report_id) == (
        3942715, '8691443b-4e34-48ff-b003-909864b0fc50', 'bbcbe65b-2173-4f50-83ae-c259d3a0153f'
    )
    assert report.headers['X-PowerBI-ResourceKey'] == KEY
    with pytest.raises(RuntimeError, match='formato inesperado'):
        powerbi.report_from({'models': []}, KEY, 'https://api')


def test_filter_literals_are_typed_and_quoted():
    condition = powerbi.is_in(powerbi.column('f', 'NOME'), ["D'ÁVILA", 2025])
    assert condition['Condition']['In']['Values'] == [[{'Literal': {'Value': "'D''ÁVILA'"}}], [{'Literal': {'Value': '2025L'}}]]
    with pytest.raises(TypeError):
        powerbi.is_in(powerbi.column('f', 'X'), [True])


def test_decode_expands_repeated_null_and_dictionary_values():
    response = {'results': [{'result': {'data': {'dsr': {'DS': [{
        'PH': [{'DM0': [
            {'S': [{'N': 'G0', 'T': 1, 'DN': 'D0'}, {'N': 'G1', 'T': 1}, {'N': 'M0', 'T': 4}], 'C': [0, 'AL', 10]},
            {'C': ['PE', 20], 'R': 1},
            {'C': [1, 5], 'Ø': 2},
        ]}],
        'ValueDicts': {'D0': ['Nordeste', 'Sul']},
    }]}}}}]}
    assert powerbi.decode(response) == [['Nordeste', 'AL', 10], ['Nordeste', 'PE', 20], ['Sul', None, 5]]


def test_decode_reads_the_real_redome_response():
    rows = powerbi.decode(json.loads((FIXTURES / 'powerbi_doadores_uf_ano.json').read_text(encoding='utf-8')))
    assert ['AL', 2025, 2_454] in rows and len(rows) == 55


def test_decode_reports_rejected_or_truncated_queries():
    error = {'results': [{'result': {'data': {'dsr': {'DataShapes': [{'odata.error': {'code': 'rsQueryError'}}]}}}}]}
    with pytest.raises(RuntimeError, match='recusada'):
        powerbi.decode(error)
    truncated = {'results': [{'result': {'data': {'dsr': {'DS': [{'IC': False, 'PH': [{'DM0': []}]}]}}}}]}
    with pytest.raises(RuntimeError, match='truncada'):
        powerbi.decode(truncated)
    with pytest.raises(RuntimeError, match='sem dados'):
        powerbi.decode({'error': 'x'})
