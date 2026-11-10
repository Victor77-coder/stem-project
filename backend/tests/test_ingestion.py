import pytest

from catalog.models import CatalogHistory, Center, PublishStatus
from ingestion import tasks
from ingestion.models import CollectionRun

URL = '/api/internal/ingest/'
TOKEN = {'HTTP_AUTHORIZATION': 'Bearer test-ingest-token'}

HEMOAL = {
    'cnes': '2003899', 'uf': 'AL', 'codigo_ibge': '2704302', 'cidade': 'Maceió', 'tipo': 'hemocentro', 'regra': 'tipo-69',
    'habilitacoes': [], 'servicos': ['Doação de sangue'], 'nome': 'Hemocentro de Alagoas HEMOAL',
    'endereco': 'Avenida Menino Marcelo, 9974 · Cidade Universitaria', 'telefone': '', 'cep': '57073417',
    'lat': -9.5304, 'lng': -35.6178,
}
IMIP = {
    'cnes': '0000434', 'uf': 'PE', 'codigo_ibge': '2611606', 'cidade': 'Recife', 'tipo': 'transplante', 'regra': 'habilitacao-tcth',
    'habilitacoes': ['1204', '2401', '2402', '2403'], 'servicos': ['Transplante de medula alogênico não aparentado'],
    'nome': 'IMIP', 'endereco': 'Rua dos Coelhos, 300 · Boa Vista', 'telefone': '(81) 2122-4100', 'cep': '50070902',
    'lat': -8.0668, 'lng': -34.8908,
}


def body(*items, ufs=('AL', 'PE'), run_id=None, competencia='2609'):
    return {
        'source': 'cnes',
        'run_id': run_id,
        'filters': {'ufs': list(ufs)},
        'canonical': {
            'source': 'cnes', 'competencia': competencia, 'ufs': list(ufs), 'collected_at': '2026-10-23T12:00:00+00:00',
            'raw_files': [{'name': 'STAL2609.dbc', 'url': 'ftp://x', 'sha256': 'abc', 'size': 1, 'status': 'downloaded'}],
            'establishments': list(items), 'warnings': [],
        },
    }


def post(api, payload, headers=TOKEN):
    return api.post(URL, payload, format='json', **headers)


def test_rejects_missing_or_wrong_token(api, db):
    assert post(api, body(IMIP), headers={}).status_code == 401
    assert post(api, body(IMIP), headers={'HTTP_AUTHORIZATION': 'Bearer errado'}).status_code == 401
    assert not CollectionRun.objects.exists()


def test_rejects_unknown_source(api, db):
    assert post(api, {**body(IMIP), 'source': 'sinan'}).status_code == 400


def test_new_establishment_is_published_and_run_is_recorded(api, seeded):
    response = post(api, body(IMIP, HEMOAL))
    assert response.status_code == 200, response.json()
    assert response.json()['stats']['novos'] == 1

    imip = Center.objects.get(cnes='0000434')
    assert imip.status == PublishStatus.PUBLICADO
    recife = api.get('/api/v1/centros/', {'lat': -8.0476, 'lng': -34.877, 'kind': 'transplante'}).data['results']
    assert [item['cnes'] for item in recife] == ['0000434']
    assert imip.origem == Center.Origin.CNES
    assert imip.tipo == 'transplante'
    assert imip.fonte == 'CNES/DataSUS · competência 09/2026'
    assert str(imip.fonte_data) == '2026-10-23'
    assert CatalogHistory.objects.filter(entidade='centro', objeto_id=str(imip.pk), autor_nome='Coleta CNES').exists()

    run = CollectionRun.objects.get()
    assert run.status == CollectionRun.Status.SUCESSO
    assert run.competencia == '2609'
    assert run.raw_files[0]['sha256'] == 'abc'


def test_without_auto_publish_new_establishment_waits_as_draft(api, seeded, settings):
    settings.CNES_AUTO_PUBLISH = False
    post(api, body(IMIP, HEMOAL))
    assert Center.objects.get(cnes='0000434').status == PublishStatus.RASCUNHO
    recife = api.get('/api/v1/centros/', {'lat': -8.0476, 'lng': -34.877, 'kind': 'transplante'}).data['results']
    assert recife == []


def test_auto_publish_releases_drafts_from_previous_loads(api, seeded, settings):
    settings.CNES_AUTO_PUBLISH = False
    post(api, body(IMIP, HEMOAL))
    settings.CNES_AUTO_PUBLISH = True
    response = post(api, body(IMIP, HEMOAL))
    assert Center.objects.get(cnes='0000434').status == PublishStatus.PUBLICADO
    assert response.json()['stats']['publicados'] == 2


def test_published_center_far_from_cnes_coordinate_is_flagged_not_moved(api, seeded):
    post(api, body(IMIP, HEMOAL))
    hemoal = Center.objects.get(cnes='2003899')
    assert hemoal.status == PublishStatus.PUBLICADO
    assert (hemoal.lat, hemoal.lng) == (-9.555, -35.77)
    assert hemoal.revisar and 'Coordenada no CNES fica a' in hemoal.motivo_revisao
    assert hemoal.fonte.startswith('CNES/DataSUS · competência')

    hemoal.revisar, hemoal.motivo_revisao = False, ''
    hemoal.save()
    post(api, body(IMIP, HEMOAL))
    hemoal.refresh_from_db()
    assert not hemoal.revisar, 'mesma coordenada do CNES não deve reabrir a revisão já feita pela equipe'


def test_type_change_on_published_center_is_flagged(api, seeded):
    post(api, body({**HEMOAL, 'tipo': 'transplante', 'lat': -9.555, 'lng': -35.77}))
    hemoal = Center.objects.get(cnes='2003899')
    assert hemoal.tipo == 'hemocentro'
    assert hemoal.revisar and 'transplante' in hemoal.motivo_revisao


def test_center_out_of_scope_is_unpublished_and_leaves_public_list(api, seeded):
    recife = {'lat': -8.0476, 'lng': -34.877, 'kind': 'hemocentro'}
    assert [item['id'] for item in api.get('/api/v1/centros/', recife).data['results']] == ['hemope']

    response = post(api, body(IMIP, HEMOAL))
    assert response.json()['stats']['inativados'] == 1
    hemope = Center.objects.get(slug='hemope')
    assert hemope.status == PublishStatus.INATIVO
    assert 'Saiu do recorte' in hemope.motivo_revisao
    assert api.get('/api/v1/centros/', recife).data['results'] == []


def test_uf_without_data_is_not_unpublished(api, seeded):
    response = post(api, body(HEMOAL, ufs=('AL', 'PE')))
    assert response.json()['stats']['inativados'] == 0
    assert Center.objects.get(slug='hemope').status == PublishStatus.PUBLICADO
    assert any(w.startswith('PE:') for w in CollectionRun.objects.get().warnings)


def test_manual_centers_are_never_touched(api, seeded):
    Center.objects.filter(slug='hemoal-sede').update(origem=Center.Origin.MANUAL)
    before = Center.objects.get(slug='hemoal-sede')
    response = post(api, body(HEMOAL, IMIP))
    assert response.json()['stats']['manuais_ignorados'] == 1
    after = Center.objects.get(slug='hemoal-sede')
    assert (after.fonte, after.revisar, after.dados_cnes) == (before.fonte, before.revisar, before.dados_cnes)
    assert Center.objects.get(slug='hemoal-trapiche').status == PublishStatus.PUBLICADO


@pytest.mark.parametrize('auto,expected', [(True, PublishStatus.PUBLICADO), (False, PublishStatus.RASCUNHO)])
def test_unpublished_center_coming_back(api, seeded, settings, auto, expected):
    settings.CNES_AUTO_PUBLISH = auto
    post(api, body(IMIP, HEMOAL))
    assert Center.objects.get(slug='hemope').status == PublishStatus.INATIVO
    hemope = {**IMIP, 'cnes': '0000809', 'tipo': 'hemocentro', 'nome': 'Fundacao HEMOPE', 'lat': -8.0479, 'lng': -34.8981}
    post(api, body(IMIP, HEMOAL, hemope))
    center = Center.objects.get(slug='hemope')
    assert center.status == expected and center.revisar


def test_collector_error_closes_the_run(api, db):
    run = CollectionRun.objects.create(source='cnes', status=CollectionRun.Status.ENFILEIRADA)
    response = post(api, {'source': 'cnes', 'run_id': run.pk, 'error': 'coletor terminou com status 1'})
    assert response.json()['status'] == 'erro'
    run.refresh_from_db()
    assert run.status == CollectionRun.Status.ERRO and 'status 1' in run.error and run.finished_at


def test_payload_links_to_run_requested_by_panel(api, seeded):
    run = CollectionRun.objects.create(source='cnes', status=CollectionRun.Status.ENFILEIRADA, filters={'ufs': ['PE']})
    post(api, body(IMIP, ufs=('PE',), run_id=run.pk))
    run.refresh_from_db()
    assert run.status == CollectionRun.Status.SUCESSO and run.stats['recebidos'] == 1
    assert CollectionRun.objects.count() == 1


@pytest.fixture
def flow_runs(monkeypatch):
    calls = []

    def fake(deployment, parameters):
        calls.append((deployment, parameters))
        return 'flow-run-123'

    monkeypatch.setattr(tasks, 'start_flow_run', fake)
    return calls


def test_admin_triggers_collection_through_celery_and_prefect(staff_login, flow_runs):
    response = staff_login().post('/api/v1/staff/collections/', {'source': 'cnes', 'ufs': ['al', 'pe'], 'competencia': '2609'}, format='json')
    assert response.status_code == 202, response.data
    assert response.data['flow_run_id'] == 'flow-run-123'
    assert response.data['status'] == 'enfileirada'
    deployment, parameters = flow_runs[0]
    assert deployment == 'stem.collect/cnes-centros'
    assert parameters == {'source': 'cnes', 'ufs': ['AL', 'PE'], 'competencia': '2609', 'run_id': response.data['id']}


def test_only_admins_trigger_but_team_sees_history(staff_login, flow_runs):
    editor = staff_login('silva_js@email.com', 'senha123')
    assert editor.post('/api/v1/staff/collections/', {'source': 'cnes'}, format='json').status_code == 403
    assert editor.get('/api/v1/staff/collections/').status_code == 200
    assert not flow_runs


def test_prefect_down_marks_run_as_error(staff_login, monkeypatch):
    def down(deployment, parameters):
        raise ConnectionError('prefect-server recusou a conexão')

    monkeypatch.setattr(tasks, 'start_flow_run', down)
    response = staff_login().post('/api/v1/staff/collections/', {'source': 'cnes'}, format='json')
    run = CollectionRun.objects.get(pk=response.data['id'])
    assert run.status == CollectionRun.Status.ERRO
    assert 'Prefect indisponível' in run.error
