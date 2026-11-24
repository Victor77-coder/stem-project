import pytest
from rest_framework.test import APIClient

from catalog.models import CatalogHistory

from .conftest import auth

pytestmark = pytest.mark.django_db


def test_journey_starts_visible_in_the_app(api):
    """A Jornada é um guia pessoal (RF05/RF06): aparece no app sem precisar ligar no painel."""
    assert api.get('/api/v1/config/').data == {'jornadaAtiva': True}


def test_admin_turns_journey_off_and_on(api, staff_login):
    admin = staff_login()
    assert admin.get('/api/v1/staff/config/').data['jornadaAtiva'] is True

    off = admin.patch('/api/v1/staff/config/', {'jornadaAtiva': False}, format='json')
    assert off.status_code == 200 and off.data['jornadaAtiva'] is False
    assert api.get('/api/v1/config/').data == {'jornadaAtiva': False}

    admin.patch('/api/v1/staff/config/', {'jornadaAtiva': True}, format='json')
    assert api.get('/api/v1/config/').data == {'jornadaAtiva': True}
    actions = list(CatalogHistory.objects.filter(entidade='configuracao').order_by('data').values_list('acao', flat=True))
    assert actions == ['Desativou a Jornada no app', 'Ativou a Jornada no app']


def test_only_admins_change_the_switch(staff_login):
    editor = staff_login('silva_js@email.com', 'senha123')
    assert editor.get('/api/v1/staff/config/').status_code == 200
    assert editor.patch('/api/v1/staff/config/', {'jornadaAtiva': False}, format='json').status_code == 403


def test_switch_rejects_non_boolean(staff_login):
    admin = staff_login()
    response = admin.patch('/api/v1/staff/config/', {'jornadaAtiva': 'sim'}, format='json')
    assert response.status_code == 400


def test_participant_cannot_change_the_switch(donor):
    client = auth(APIClient(), donor['access'])
    assert client.patch('/api/v1/staff/config/', {'jornadaAtiva': False}, format='json').status_code == 403
