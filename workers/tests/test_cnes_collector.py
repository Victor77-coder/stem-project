import json
from pathlib import Path

import pytest

from workers.collectors.cnes import collector
from workers.collectors.cnes.collector import classify, pretty, previous_competencias, to_canonical, to_yyyymm

ROWS = json.loads((Path(__file__).parent / 'fixtures' / 'cnes' / 'rows_2609.json').read_text(encoding='utf-8'))


def by_cnes(competencia='2609', hb=None):
    return {item.cnes: item for item in classify(ROWS['ST'], ROWS['HB'] if hb is None else hb, ROWS['SR'], competencia)}


def test_transplant_centers_need_tcth_habilitation():
    imip = by_cnes()['0000434']
    assert imip.tipo == 'transplante'
    assert imip.regra == 'habilitacao-tcth'
    assert {'2401', '2402', '2403'} <= set(imip.habilitacoes)


def test_hemocentros_by_type_by_public_sadt_and_by_hematology_hospital():
    selected = by_cnes()
    assert selected['2003899'].regra == 'tipo-69'
    assert selected['5390095'].regra == 'sadt-publica-coleta'
    assert selected['0000809'].regra == 'hematologia-publica-coleta'
    assert all(selected[c].tipo == 'hemocentro' for c in ('2003899', '5390095', '0000809'))
    assert 'Doação de sangue' in selected['0000809'].servicos


@pytest.mark.parametrize(
    'cnes,why',
    [
        ('2007029', 'HEMOPAC: banco de sangue privado (SADT, natureza privada)'),
        ('4373650', 'Hemato: tipo 69 sem vínculo SUS'),
        ('2006197', 'HUPAA: hospital geral; coleta sangue, mas não é hemocentro nem tem TCTH'),
        ('2009250', 'Maternidade pública que coleta sangue, sem habilitação de hematologia'),
    ],
)
def test_out_of_scope(cnes, why):
    assert cnes not in by_cnes(), why


def test_expired_habilitation_is_ignored():
    expired = [{**row, 'CMPT_FIM': '202512'} if row['CNES'] == '0000434' and row['SGRUPHAB'].startswith('240') else row for row in ROWS['HB']]
    assert '0000434' not in by_cnes(hb=expired)


def test_habilitation_not_started_yet_is_ignored():
    future = [{**row, 'CMPT_INI': '202701'} if row['CNES'] == '0000434' else row for row in ROWS['HB']]
    assert '0000434' not in by_cnes(hb=future)


def test_competencia_helpers():
    assert to_yyyymm('2609') == '202609'
    with pytest.raises(ValueError):
        to_yyyymm('202609')
    from datetime import date

    assert previous_competencias(date(2026, 2, 10), 3) == ['2602', '2601', '2512']


def test_pretty_names():
    assert pretty('HEMOCENTRO DE ALAGOAS HEMOAL') == 'Hemocentro de Alagoas HEMOAL'
    assert pretty('FUNDACAO  HEMOPE') == 'Fundacao HEMOPE'


def test_canonical_uses_ibge_name_and_cnes_details():
    item = by_cnes()['2003899']
    details = {
        'noFantasia': 'HEMOCENTRO DE ALAGOAS HEMOAL',
        'noLogradouro': 'AVENIDA MENINO MARCELO',
        'nuEndereco': '9974',
        'bairro': 'CIDADE UNIVERSITARIA',
        'nuLatitude': '-9.53',
        'nuLongitude': '-35.61',
        'nuTelefone': '(82) 3315-2102',
    }
    canonical = to_canonical(item, 'al', details, {'270430': {'nome': 'Maceió', 'codigo_ibge': '2704302'}})
    assert canonical['uf'] == 'AL'
    assert canonical['cidade'] == 'Maceió'
    assert canonical['codigo_ibge'] == '2704302'
    assert canonical['endereco'] == 'Avenida Menino Marcelo, 9974 · Cidade Universitaria'
    assert (canonical['lat'], canonical['lng']) == (-9.53, -35.61)
    assert canonical['detalhes_ok'] is True


def test_collect_survives_cnes_site_outage(tmp_path, monkeypatch):
    def fake_fetch(path, url, **kwargs):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(b'x')
        return collector.RemoteFile(path=path, url=url, status='downloaded', sha256='abc', size=1)

    group_of = lambda path: path.name[:2]  # noqa: E731
    monkeypatch.setattr(collector, 'fetch_remote_file', fake_fetch)
    monkeypatch.setattr(collector, 'read_dbc', lambda path, fields: ROWS[group_of(path)])

    def down(*args):
        raise OSError('connection reset by peer')

    payload = collector.collect(['AL'], '2609', tmp_path, details_fn=down, municipalities_fn=down)
    assert payload['competencia'] == '2609'
    assert len(payload['raw_files']) == 3
    hemoal = next(item for item in payload['establishments'] if item['cnes'] == '2003899')
    assert hemoal['detalhes_ok'] is False and hemoal['nome'] == 'Estabelecimento CNES 2003899'
    assert any('cadastro indisponível' in warning for warning in payload['warnings'])
