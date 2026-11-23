import pytest
from rest_framework.test import APIClient

from catalog.models import CatalogHistory

from .conftest import auth

pytestmark = pytest.mark.django_db


def test_journey_starts_disabled_for_the_app(api):
    assert api.get('/api/v1/config/').data == {'jornadaAtiva': False}


def test_admin_turns_journey_on_and_off(api, staff_login):
    admin = staff_login()
    assert admin.get('/api/v1/staff/config/').data['jornadaAtiva'] is False

    on = admin.patch('/api/v1/staff/config/', {'jornadaAtiva': True}, format='json')
    assert on.status_code == 200 and on.data['jornadaAtiva'] is True
    assert api.get('/api/v1/config/').data == {'jornadaAtiva': True}

    admin.patch('/api/v1/staff/config/', {'jornadaAtiva': False}, format='json')
    assert api.get('/api/v1/config/').data == {'jornadaAtiva': False}
    actions = list(CatalogHistory.objects.filter(entidade='configuracao').order_by('data').values_list('acao', flat=True))
    assert actions == ['Ativou a Jornada no app', 'Desativou a Jornada no app']


def test_only_admins_change_the_switch(staff_login):
    editor = staff_login('silva_js@email.com', 'senha123')
    assert editor.get('/api/v1/staff/config/').status_code == 200
    assert editor.patch('/api/v1/staff/config/', {'jornadaAtiva': True}, format='json').status_code == 403


def test_switch_rejects_non_boolean(staff_login):
    admin = staff_login()
    response = admin.patch('/api/v1/staff/config/', {'jornadaAtiva': 'sim'}, format='json')
    assert response.status_code == 400


def test_participant_cannot_change_the_switch(donor):
    client = auth(APIClient(), donor['access'])
    assert client.patch('/api/v1/staff/config/', {'jornadaAtiva': True}, format='json').status_code == 403
