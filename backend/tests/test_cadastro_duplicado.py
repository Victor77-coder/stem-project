"""RF01: CPF e e-mail já usados voltam como erro do campo (nunca 500), e o histórico só registra o que mudou."""
import pytest
from rest_framework.test import APIClient

from accounts.models import Role, User

from .conftest import DONOR, auth

pytestmark = pytest.mark.django_db


def client() -> APIClient:
    api = APIClient()
    api.raise_request_exception = False  # um 500 vira resposta, não exceção no teste
    return api


def register(**changes):
    return client().post('/api/v1/auth/register/', {**DONOR, **changes}, format='json')


def test_cpf_already_used_with_the_same_mask_is_a_field_error(seeded):
    assert register().status_code == 201
    again = register(email='outra@example.com')  # o app sempre manda o CPF mascarado
    assert again.status_code == 400 and 'cpf' in again.data


def test_cpf_already_used_without_the_mask_is_a_field_error(seeded):
    assert register().status_code == 201
    again = register(email='outra@example.com', cpf='52998224725')
    assert again.status_code == 400 and 'cpf' in again.data


def test_email_already_used_in_another_case_is_a_field_error(seeded):
    assert register(cpf='').status_code == 201
    again = register(email='MARIA@Example.com', cpf='')
    assert again.status_code == 400 and 'email' in again.data


def test_email_and_cpf_are_stored_normalized(seeded):
    created = register(email='  Maria@Example.COM ')
    assert created.status_code == 201, created.data
    user = User.objects.get(role=Role.PARTICIPANT)
    assert (user.email, user.cpf) == ('maria@example.com', '52998224725')


def test_profile_cannot_take_an_email_in_use_in_another_case(seeded):
    first = register(cpf='').data
    register(email='joao@example.com', cpf='')
    response = auth(client(), first['access']).patch('/api/v1/me/', {'email': 'JOAO@example.com'}, format='json')
    assert response.status_code == 400 and 'email' in response.data


def test_saving_the_same_masked_cpf_and_email_logs_only_what_changed(seeded):
    created = register().data
    api = auth(client(), created['access'])
    saved = api.patch(
        '/api/v1/me/', {'name': 'Maria S. Silva', 'cpf': DONOR['cpf'], 'email': 'Maria@Example.com'}, format='json'
    )
    assert saved.status_code == 200, saved.data
    titles = [item['title'] for item in api.get('/api/v1/me/history/').data]
    assert 'Nome atualizado' in titles
    assert 'CPF atualizado' not in titles and 'E-mail atualizado' not in titles


def test_simultaneous_registrations_are_a_field_error(seeded, monkeypatch):
    """Dois cadastros iguais ao mesmo tempo passam juntos pela checagem: a constraint do banco responde."""
    from participants import services

    assert register().status_code == 201
    monkeypatch.setattr(services, '_check_unique', lambda *args: None)
    again = register(email='outra@example.com')
    assert again.status_code == 400 and 'cpf' in again.data
