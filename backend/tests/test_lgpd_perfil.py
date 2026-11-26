"""RF001/RNF10/RF002: quem alterou, cópia dos dados direto no app e reaceite do termo pelo servidor."""
import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from consent.models import ConsentDocument

from .conftest import auth

pytestmark = pytest.mark.django_db


def test_history_says_who_changed(donor):
    client = auth(APIClient(), donor['access'])
    client.patch('/api/v1/me/', {'weight': '70'}, format='json')
    history = client.get('/api/v1/me/history/').data
    assert history and all(item['by'] == 'Você' for item in history)


def test_export_downloads_without_email(api, seeded):
    body = {'profile': 'doador', 'name': 'Só Telefone', 'phone': '(82) 99999-1234', 'password': 'Medula2026',
            'weight': '70', 'height': '1,70', 'sex': 'outro', 'comorbidities': ['Nenhuma'],
            'tcleAccepted': True, 'tcleVersion': '1.0', 'channel': 'ios'}
    created = api.post('/api/v1/auth/register/', body, format='json')
    assert created.status_code == 201, created.data
    client = auth(APIClient(), created.data['access'])
    response = client.get('/api/v1/me/export/')
    assert response.status_code == 200
    assert 'attachment' in response['Content-Disposition']
    assert response.data['phone'] == '82999991234'
    assert response.data['history'][0]['by'] == 'Você'


def test_new_terms_version_is_accepted_through_the_server(donor):
    client = auth(APIClient(), donor['access'])
    ConsentDocument.objects.filter(kind='tcle', is_current=True).update(is_current=False)
    ConsentDocument.objects.create(kind='tcle', version='2.0', title='TCLE', sections=[], published_at=timezone.localdate(), is_current=True)
    assert client.get('/api/v1/me/').data['tcleAccepted'] is False

    refused = client.post('/api/v1/me/consent/', {'tcleAccepted': True, 'tcleVersion': '1.0'}, format='json')
    assert refused.status_code == 400
    accepted = client.post('/api/v1/me/consent/', {'tcleAccepted': True, 'tcleVersion': '2.0', 'channel': 'android'}, format='json')
    assert accepted.status_code == 200, accepted.data
    assert accepted.data['tcleAccepted'] is True and accepted.data['tcleVersion'] == '2.0'
    assert accepted.data['tcleChannel'] == 'android'


def test_birth_date_is_saved_shown_and_anonymized(api, seeded):
    from .conftest import DONOR
    created = api.post('/api/v1/auth/register/', {**DONOR, 'birthDate': '15/03/1995'}, format='json')
    assert created.status_code == 201, created.data
    client = auth(APIClient(), created.data['access'])
    assert client.get('/api/v1/me/').data['birthDate'] == '1995-03-15'
    assert client.patch('/api/v1/me/', {'birthDate': '01/01/2999'}, format='json').status_code == 400
    client.post('/api/v1/me/deactivate/', {'password': DONOR['password']}, format='json')
    from participants.models import Participant
    assert Participant.objects.get().birth_date is None


def test_guest_never_gives_birth_date(api, seeded):
    body = {'profile': 'convidado', 'email': 'conv@example.com', 'birthDate': '15/03/1995',
            'tcleAccepted': True, 'tcleVersion': '1.0'}
    response = api.post('/api/v1/auth/register/', body, format='json')
    assert response.status_code == 400 and 'data de nascimento' in str(response.data)
