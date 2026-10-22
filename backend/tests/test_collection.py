import pytest
from django.core import mail
from rest_framework.test import APIClient

from consent.models import ConsentAcceptance, ConsentDocument
from participants.models import ChangeEvent, Participant

from .conftest import DONOR, auth, participants

pytestmark = pytest.mark.django_db


def test_register_without_tcle_saves_nothing(api, seeded):
    response = api.post('/api/v1/auth/register/', {**DONOR, 'tcleAccepted': False}, format='json')
    assert response.status_code == 400
    assert 'tcleAccepted' in response.data
    assert not participants().exists()
    assert not Participant.objects.exists()


def test_register_with_outdated_term_is_refused(api, seeded):
    response = api.post('/api/v1/auth/register/', {**DONOR, 'tcleVersion': '0.9'}, format='json')
    assert response.status_code == 400
    assert not participants().exists()


def test_register_records_consent_version_and_channel(donor):
    acceptance = ConsentAcceptance.objects.get()
    assert acceptance.document.kind == ConsentDocument.Kind.TCLE
    assert acceptance.document.version == '1.0'
    assert acceptance.channel == 'android'
    assert donor['me']['tcleAccepted'] is True
    assert donor['me']['weight'] == '68.5'
    assert donor['me']['cpf'] == '52998224725'


def test_clinical_profile_requires_minimum_data(api, seeded):
    response = api.post('/api/v1/auth/register/', {**DONOR, 'weight': '', 'comorbidities': []}, format='json')
    assert response.status_code == 400
    assert {'weight', 'comorbidities'} <= set(response.data)


def test_invalid_cpf_is_refused(api, seeded):
    response = api.post('/api/v1/auth/register/', {**DONOR, 'cpf': '111.111.111-11'}, format='json')
    assert response.status_code == 400
    assert 'cpf' in response.data


def test_leigo_never_stores_clinical_data(api, seeded):
    response = api.post(
        '/api/v1/auth/register/',
        {'profile': 'leigo', 'email': 'curioso@example.com', 'weight': '70', 'tcleAccepted': True},
        format='json',
    )
    assert response.status_code == 400
    assert not participants().exists()

    response = api.post('/api/v1/auth/register/', {'profile': 'leigo', 'email': 'curioso@example.com', 'tcleAccepted': True}, format='json')
    assert response.status_code == 201
    participant = Participant.objects.get()
    assert participant.weight is None and participant.height is None and participant.comorbidities == []
    assert ConsentAcceptance.objects.get().document.kind == ConsentDocument.Kind.TERMOS
    assert response.data['me']['hasPassword'] is False


def test_leigo_without_contact_has_nothing_to_store(api, seeded):
    response = api.post('/api/v1/auth/register/', {'profile': 'leigo', 'tcleAccepted': True}, format='json')
    assert response.status_code == 400
    assert not participants().exists()


def test_leigo_upgrade_requires_tcle_and_clinical_data(api, seeded):
    created = api.post('/api/v1/auth/register/', {'profile': 'leigo', 'email': 'ana@example.com', 'tcleAccepted': True}, format='json')
    client = auth(APIClient(), created.data['access'])

    response = client.post('/api/v1/me/profile/', {'profile': 'doador'}, format='json')
    assert response.status_code == 400

    upgrade = {k: DONOR[k] for k in ('weight', 'height', 'sex', 'comorbidities')}
    response = client.post('/api/v1/me/profile/', {'profile': 'doador', **upgrade, 'password': 'Medula2026'}, format='json')
    assert response.status_code == 400
    assert 'tcleAccepted' in response.data

    response = client.post(
        '/api/v1/me/profile/',
        {'profile': 'doador', **upgrade, 'password': 'Medula2026', 'tcleAccepted': True, 'tcleVersion': '1.0'},
        format='json',
    )
    assert response.status_code == 200, response.data
    assert response.data['profile'] == 'doador'
    assert response.data['tcleAccepted'] is True
    assert ConsentAcceptance.objects.filter(document__kind='tcle').count() == 1


def test_login_by_email_or_cpf_with_generic_error(api, donor):
    for identifier in ('MARIA@example.com', '529.982.247-25'):
        response = api.post('/api/v1/auth/login/', {'identifier': identifier, 'password': DONOR['password']}, format='json')
        assert response.status_code == 200
    wrong = api.post('/api/v1/auth/login/', {'identifier': 'maria@example.com', 'password': 'errada'}, format='json')
    missing = api.post('/api/v1/auth/login/', {'identifier': 'ninguem@example.com', 'password': 'errada'}, format='json')
    assert wrong.status_code == missing.status_code == 400
    assert wrong.data['detail'] == missing.data['detail']


def test_profile_update_keeps_history(donor):
    client = auth(APIClient(), donor['access'])
    response = client.patch('/api/v1/me/', {'weight': '70', 'comorbidities': ['Nenhuma'], 'city': 'Recife', 'uf': 'PE'}, format='json')
    assert response.status_code == 200, response.data
    titles = list(ChangeEvent.objects.values_list('title', 'detail'))
    assert ('Peso alterado', '68.5 kg → 70 kg') in titles
    assert ('Comorbidade adicionada', 'Nenhuma') in titles
    assert ('Comorbidade removida', 'Hipertensão') in titles
    assert ('Localização atualizada', 'Recife/PE') in titles
    history = client.get('/api/v1/me/history/').data
    assert history[0]['title'] in {title for title, _ in titles}


def test_deactivation_anonymizes_and_ends_session(api, donor):
    client = auth(APIClient(), donor['access'])
    assert client.post('/api/v1/me/deactivate/', {'password': 'errada'}, format='json').status_code == 400
    assert client.post('/api/v1/me/deactivate/', {'password': DONOR['password']}, format='json').status_code == 204

    participant = Participant.objects.select_related('user').get()
    user = participant.user
    assert (user.name, user.email, user.cpf, user.phone) == ('', None, None, None)
    assert participant.weight is None and participant.comorbidities == [] and participant.cep == ''
    assert participant.uf == 'AL'
    assert not participant.history.exclude(detail='').exists()
    assert user.status == 'inativo'

    assert client.get('/api/v1/me/').status_code == 401
    refreshed = api.post('/api/v1/auth/refresh/', {'refresh': donor['refresh']}, format='json')
    assert refreshed.status_code == 401
    login = api.post('/api/v1/auth/login/', {'identifier': DONOR['email'], 'password': DONOR['password']}, format='json')
    assert login.status_code == 400


def test_logout_blacklists_refresh_token(api, donor):
    assert api.post('/api/v1/auth/logout/', {'refresh': donor['refresh']}, format='json').status_code == 204
    assert api.post('/api/v1/auth/refresh/', {'refresh': donor['refresh']}, format='json').status_code == 401


def test_password_reset_with_six_digit_code(api, donor):
    mail.outbox.clear()
    response = api.post('/api/v1/auth/password/forgot/', {'identifier': DONOR['email']}, format='json')
    assert response.status_code == 202
    code = next(word.strip('.') for word in mail.outbox[0].body.split() if word.strip('.').isdigit() and len(word.strip('.')) == 6)

    bad = api.post('/api/v1/auth/password/verify/', {'identifier': DONOR['email'], 'code': '000000' if code != '000000' else '111111'}, format='json')
    assert bad.status_code == 400
    assert api.post('/api/v1/auth/password/verify/', {'identifier': DONOR['email'], 'code': code}, format='json').status_code == 200
    reset = api.post('/api/v1/auth/password/reset/', {'identifier': DONOR['email'], 'code': code, 'password': 'NovaSenha2026'}, format='json')
    assert reset.status_code == 200, reset.data
    again = api.post('/api/v1/auth/password/reset/', {'identifier': DONOR['email'], 'code': code, 'password': 'OutraSenha2026'}, format='json')
    assert again.status_code == 400
    login = api.post('/api/v1/auth/login/', {'identifier': DONOR['email'], 'password': 'NovaSenha2026'}, format='json')
    assert login.status_code == 200


def test_forgot_password_does_not_reveal_accounts(api, seeded):
    mail.outbox.clear()
    response = api.post('/api/v1/auth/password/forgot/', {'identifier': 'ninguem@example.com'}, format='json')
    assert response.status_code == 202
    assert mail.outbox == []


def test_export_sends_own_data_by_email(donor):
    mail.outbox.clear()
    client = auth(APIClient(), donor['access'])
    assert client.post('/api/v1/me/export/').status_code == 202
    assert mail.outbox[0].to == [DONOR['email']]
    assert mail.outbox[0].attachments[0][0] == 'meus-dados-stem.json'
