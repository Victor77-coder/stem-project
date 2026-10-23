import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APIClient

from catalog import geo
from catalog.models import Content

from .conftest import DONOR, auth

pytestmark = pytest.mark.django_db

DRAFT = {
    'titulo': 'Anemia falciforme e transplante',
    'descricao': 'Quando o transplante é indicado.',
    'categoria': 'Doenças',
    'publicoAlvo': ['Receptor'],
    'fonte': '',
    'visibilidade': 'Público',
    'status': 'rascunho',
}


def test_staff_never_sees_participants(staff_login, donor):
    staff = staff_login()
    accounts = staff.get('/api/v1/staff/accounts/').data
    emails = {item['email'] for item in accounts}
    assert DONOR['email'] not in emails
    assert staff.get('/api/v1/staff/accounts/', {'q': DONOR['email']}).data == []
    assert staff.get('/api/v1/staff/accounts/', {'q': 'Maria Silva'}).data == []
    assert staff.get(f'/api/v1/staff/accounts/{donor["me"]["id"]}/').status_code == 404
    assert staff.get('/api/v1/me/').status_code == 403


def test_participant_cannot_use_staff_api(donor):
    client = auth(APIClient(), donor['access'])
    assert client.get('/api/v1/staff/dashboard/').status_code == 403
    assert client.get('/api/v1/staff/contents/').status_code == 403


def test_participant_credentials_do_not_open_the_panel(api, donor):
    response = api.post('/api/v1/staff/auth/login/', {'email': DONOR['email'], 'senha': DONOR['password']}, format='json')
    assert response.status_code == 400


def test_publish_requires_source_and_clinical_validation(staff_login):
    editor = staff_login('silva_js@email.com', 'senha123')
    created = editor.post('/api/v1/staff/contents/', DRAFT, format='json')
    assert created.status_code == 201, created.data
    pk = created.data['id']

    no_source = editor.patch(f'/api/v1/staff/contents/{pk}/', {'status': 'publicado'}, format='json')
    assert no_source.status_code == 400 and 'fonte' in no_source.data

    no_validation = editor.patch(f'/api/v1/staff/contents/{pk}/', {'status': 'publicado', 'fonte': 'INCA'}, format='json')
    assert no_validation.status_code == 400 and 'validacaoClinica' in no_validation.data

    forbidden = editor.patch(f'/api/v1/staff/contents/{pk}/', {'validacaoClinica': True}, format='json')
    assert forbidden.status_code == 400

    admin = staff_login()
    published = admin.patch(
        f'/api/v1/staff/contents/{pk}/', {'status': 'publicado', 'fonte': 'INCA', 'validacaoClinica': True}, format='json'
    )
    assert published.status_code == 200, published.data
    assert published.data['validadoPor'] == 'John Doe'
    assert [entry['acao'] for entry in published.data['historico']][-2:] == ['Editou o conteúdo', 'Validou o conteúdo']

    edited = editor.patch(f'/api/v1/staff/contents/{pk}/', {'descricao': 'Texto novo sem revisão.'}, format='json')
    assert edited.status_code == 400
    assert Content.objects.get(pk=pk).validado_por is not None


def test_public_catalog_only_shows_published_and_refreshes_cache(api, staff_login):
    admin = staff_login()
    first = api.get('/api/v1/conteudos/').data
    slugs = {item['id'] for item in first}
    assert 'o-que-sao' in slugs

    content = Content.objects.get(slug='o-que-sao')
    response = admin.post(f'/api/v1/staff/contents/{content.pk}/despublicar/', {'senha': 'errada'}, format='json')
    assert response.status_code == 400
    response = admin.post(f'/api/v1/staff/contents/{content.pk}/despublicar/', {'senha': 'admin123'}, format='json')
    assert response.status_code == 200

    after = {item['id'] for item in api.get('/api/v1/conteudos/').data}
    assert 'o-que-sao' not in after
    assert api.get('/api/v1/conteudos/o-que-sao/').status_code == 404


def test_restricted_content_requires_participant_login(api, staff_login, donor):
    Content.objects.filter(slug='redome').update(visibilidade='Restrito')
    from catalog.cache import invalidate

    invalidate()
    assert 'redome' not in {item['id'] for item in api.get('/api/v1/conteudos/').data}
    logged = auth(APIClient(), donor['access'])
    assert 'redome' in {item['id'] for item in logged.get('/api/v1/conteudos/').data}


def test_attachment_upload_and_public_download(api, staff_login):
    admin = staff_login()
    content = Content.objects.get(slug='o-que-sao')
    upload = SimpleUploadedFile('cartilha.pdf', b'%PDF-1.4 teste', content_type='application/pdf')
    response = admin.post(f'/api/v1/staff/contents/{content.pk}/anexos/', {'arquivo': upload}, format='multipart')
    assert response.status_code == 201, response.data
    attachment = api.get('/api/v1/conteudos/o-que-sao/').data['attachments'][0]
    download = api.get(attachment['url'].replace('http://testserver', ''))
    assert download.status_code == 200
    assert b''.join(download.streaming_content) == b'%PDF-1.4 teste'


def test_editor_cannot_manage_accounts(staff_login):
    editor = staff_login('silva_js@email.com', 'senha123')
    assert editor.get('/api/v1/staff/accounts/').status_code == 200
    created = editor.post('/api/v1/staff/accounts/', {'nome': 'Nova', 'email': 'nova@stem.com'}, format='json')
    assert created.status_code == 403


def test_admin_creates_account_with_temporary_password(api, staff_login):
    admin = staff_login()
    created = admin.post('/api/v1/staff/accounts/', {'nome': 'Nova Editora', 'email': 'nova@stem.com', 'tipoConta': 'Editor'}, format='json')
    assert created.status_code == 201, created.data
    assert 'senha' not in created.data
    login = api.post('/api/v1/staff/auth/login/', {'email': 'nova@stem.com', 'senha': created.data['senhaTemporaria']}, format='json')
    assert login.status_code == 200

    pk = created.data['id']
    blocked = admin.post(f'/api/v1/staff/accounts/{pk}/status/', {'status': 'bloqueado'}, format='json')
    assert blocked.status_code == 400
    blocked = admin.post(f'/api/v1/staff/accounts/{pk}/status/', {'status': 'bloqueado', 'senha': 'admin123'}, format='json')
    assert blocked.status_code == 200
    assert auth(APIClient(), login.data['access']).get('/api/v1/staff/me/').status_code == 401


def test_dashboard_is_aggregate_only(staff_login, donor):
    data = staff_login().get('/api/v1/staff/dashboard/').data
    assert data['publicados'] == Content.objects.filter(status='publicado').count()
    assert data['participantesAtivos']['doador'] == 1
    assert DONOR['name'] not in str(data) and DONOR['email'] not in str(data)


def test_centers_sorted_by_distance_within_radius(api, seeded):
    near = api.get('/api/v1/centros/', {'lat': -9.6658, 'lng': -35.735}).data['results']
    assert near and all(item['uf'] == 'AL' for item in near)
    assert [item['km'] for item in near] == sorted(item['km'] for item in near)
    recife = api.get('/api/v1/centros/', {'lat': -8.0476, 'lng': -34.877, 'kind': 'hemocentro'}).data['results']
    assert [item['id'] for item in recife] == ['hemope']


BRASILAPI_HIT = {
    'cep': '57035230',
    'state': 'AL',
    'city': 'Maceió',
    'neighborhood': 'Ponta Verde',
    'street': 'Rua Exemplo',
    'location': {'type': 'Point', 'coordinates': {'latitude': '-9.6658', 'longitude': '-35.7350'}},
}


def fake_remote(responses):
    calls = []

    def get_json(url):
        calls.append(url)
        for prefix, payload in responses.items():
            if url.startswith(prefix):
                if isinstance(payload, Exception):
                    raise payload
                return payload
        raise AssertionError(url)

    return get_json, calls


def test_cep_uses_brasilapi_coordinates_and_caches(api, monkeypatch):
    get_json, calls = fake_remote({geo.BRASILAPI_URL[:30]: BRASILAPI_HIT})
    monkeypatch.setattr(geo, '_get_json', get_json)
    data = api.get('/api/v1/geo/cep/57035-230/').data
    assert data == {
        'cep': '57035230', 'address': 'Rua Exemplo', 'district': 'Ponta Verde', 'city': 'Maceió', 'uf': 'AL',
        'lat': -9.6658, 'lng': -35.735, 'precision': 'cep',
    }
    assert api.get('/api/v1/geo/cep/57035230/').status_code == 200
    assert len(calls) == 1


def test_cep_without_coordinates_falls_back_to_city(api, monkeypatch):
    get_json, calls = fake_remote({
        geo.BRASILAPI_URL[:30]: {**BRASILAPI_HIT, 'location': {'type': 'Point', 'coordinates': {}}},
        geo.NOMINATIM_URL: [{'lat': '-9.6498', 'lon': '-35.7089'}],
    })
    monkeypatch.setattr(geo, '_get_json', get_json)
    data = api.get('/api/v1/geo/cep/57035230/').data
    assert (data['lat'], data['lng'], data['precision']) == (-9.6498, -35.7089, 'cidade')
    assert len(calls) == 2


def test_cep_invalid_or_unknown(api, monkeypatch):
    get_json, _ = fake_remote({geo.BRASILAPI_URL[:30]: OSError('404')})
    monkeypatch.setattr(geo, '_get_json', get_json)
    assert api.get('/api/v1/geo/cep/1234/').status_code == 400
    assert api.get('/api/v1/geo/cep/99999999/').status_code == 404


def test_estimate_always_carries_disclaimer(api, seeded):
    data = api.get('/api/v1/estimativa/', {'perfil': 'receptor', 'uf': 'AL'}).data
    assert data['value'] == 'Média regional: 3 a 6 meses'
    assert 'exclusivamente preditiva' in data['disclaimer']
    assert api.get('/api/v1/estimativa/', {'perfil': 'doador'}).data['available'] is False


def test_statistics_have_source_and_underreporting_notice(api, seeded):
    data = api.get('/api/v1/estatisticas/', {'ano': '2024', 'uf': 'PE'}).data
    assert data['headline']['donors'] == '5,4 mi'
    assert data['wait'] == '4,8 meses'
    assert data['underreporting'] is True and data['source']


def test_inbox_follows_preferences_and_region(donor):
    client = auth(APIClient(), donor['access'])
    titles = {item['title'] for item in client.get('/api/v1/me/inbox/').data}
    assert 'Mutirão de cadastro de medula' in titles
    client.patch('/api/v1/me/preferences/', {'campaigns': False}, format='json')
    kinds = {item['kind'] for item in client.get('/api/v1/me/inbox/').data}
    assert 'campanha' not in kinds

    notice = client.get('/api/v1/me/inbox/').data[0]
    assert client.post(f'/api/v1/me/inbox/{notice["id"]}/read/').status_code == 204
    assert client.post('/api/v1/me/inbox/clear-read/').status_code == 204
    assert notice['id'] not in {item['id'] for item in client.get('/api/v1/me/inbox/').data}


def test_journey_progress_is_saved(donor):
    client = auth(APIClient(), donor['access'])
    assert client.get('/api/v1/me/journey/').data == {'kind': 'doador', 'current': 1, 'region': 'maceio'}
    assert client.patch('/api/v1/me/journey/', {'current': 3}, format='json').data['current'] == 3
    assert client.patch('/api/v1/me/journey/', {'current': 9}, format='json').status_code == 400


@override_settings(
    CACHES={
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': 'redis://127.0.0.1:1/0',
            'OPTIONS': {'IGNORE_EXCEPTIONS': True, 'SOCKET_CONNECT_TIMEOUT': 0.1, 'SOCKET_TIMEOUT': 0.1},
        }
    },
    DJANGO_REDIS_IGNORE_EXCEPTIONS=True,
)
def test_api_keeps_working_without_redis(api, seeded):
    response = api.get('/api/v1/conteudos/')
    assert response.status_code == 200 and response.data
    registered = api.post('/api/v1/auth/register/', DONOR, format='json')
    assert registered.status_code == 201
