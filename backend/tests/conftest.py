import pytest
from django.core.cache import cache
from django.core.management import call_command
from rest_framework.test import APIClient

from accounts.models import Role, User


@pytest.fixture(autouse=True)
def _isolated(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    settings.CACHES = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, 'DEFAULT_THROTTLE_RATES': {k: '1000/min' for k in ('login', 'register', 'password', 'request')}}
    cache.clear()


@pytest.fixture
def seeded(db):
    call_command('seed_mvp', '--dev', verbosity=0)


@pytest.fixture
def api():
    return APIClient()


def auth(client: APIClient, token: str) -> APIClient:
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    return client


@pytest.fixture
def staff_login(api, seeded):
    def login(email='admin@stem.com', senha='admin123'):
        response = api.post('/api/v1/staff/auth/login/', {'email': email, 'senha': senha}, format='json')
        assert response.status_code == 200, response.data
        return auth(APIClient(), response.data['access'])

    return login


DONOR = {
    'profile': 'doador',
    'name': 'Maria Silva',
    'email': 'maria@example.com',
    'password': 'Medula2026',
    'cpf': '529.982.247-25',
    'weight': '68,5',
    'height': '1,65',
    'sex': 'feminino',
    'comorbidities': ['Hipertensão'],
    'cep': '57035-230',
    'city': 'Maceió',
    'uf': 'AL',
    'tcleAccepted': True,
    'tcleVersion': '1.0',
    'channel': 'android',
}


@pytest.fixture
def donor(api, seeded):
    response = api.post('/api/v1/auth/register/', DONOR, format='json')
    assert response.status_code == 201, response.data
    return response.data


def participants():
    return User.objects.filter(role=Role.PARTICIPANT)
