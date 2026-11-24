"""RF02: acesso do convidado só com e-mail, volta por código, prazo de 12 meses e aceite por versão."""

from datetime import timedelta

from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Status
from consent.models import ConsentAcceptance, ConsentDocument
from engagement.models import Preferences, PushToken
from participants import services
from participants.models import Participant

from .conftest import DONOR, auth, participants

REGISTER = '/api/v1/auth/register/'
GUEST_CODE = '/api/v1/auth/convidado/codigo/'
GUEST = {'profile': 'convidado', 'email': 'curioso@example.com', 'tcleAccepted': True, 'channel': 'android'}


def code_from(message) -> str:
    return next(word.strip('.') for word in message.body.split() if word.strip('.').isdigit() and len(word.strip('.')) == 6)


def enter(api, **extra):
    return api.post(REGISTER, {**GUEST, **extra}, format='json')


def test_guest_terms_are_version_1_1(api, seeded):
    terms = api.get('/api/v1/termos/termos/').data
    assert terms['version'] == '1.1'
    assert any('12 meses' in section['body'] for section in terms['sections'])
    assert ConsentDocument.current('tcle').version == '1.0', 'o TCLE não muda'


def test_guest_contact_is_email_only(api, seeded):
    response = enter(api, email='', phone='82999990000')
    assert response.status_code == 400 and 'só por e-mail' in response.data['phone'][0]
    assert 'Informe um e-mail' in enter(api, email='').data['email'][0]
    assert not participants().exists()

    guest = enter(api).data
    client = auth(APIClient(), guest['access'])
    response = client.patch('/api/v1/me/', {'phone': '82999990000'}, format='json')
    assert response.status_code == 400 and 'só por e-mail' in response.data['phone'][0]


def test_new_guest_gets_a_session_and_the_current_terms(api, seeded):
    response = enter(api, tcleVersion='1.1')
    assert response.status_code == 201 and response.data['me']['profile'] == 'convidado'
    user = participants().get()
    assert [item.document.version for item in user.consents.all()] == ['1.1']
    assert user.participant.ultimo_acesso is not None
    assert enter(APIClient(), email='outro@example.com', tcleVersion='1.0').data['tcleVersion'] == [
        'O termo foi atualizado. Leia e aceite a versão vigente.'
    ]


def test_returning_guest_gets_a_code_and_the_same_record(api, seeded):
    first = enter(api).data
    Preferences.objects.filter(participant__user_id=first['me']['id']).update(events=True)
    mail.outbox.clear()

    again = enter(APIClient(), email='Curioso@Example.com', notices={'campaigns': True})
    assert again.status_code == 202 and again.data['codeSent'] is True
    assert participants().count() == 1, 'a volta não cria outro registro'
    assert len(mail.outbox) == 1 and mail.outbox[0].to == ['curioso@example.com']
    code = code_from(mail.outbox[0])

    wrong = APIClient().post(GUEST_CODE, {'email': 'curioso@example.com', 'code': '000000' if code != '000000' else '111111'}, format='json')
    assert wrong.status_code == 400 and wrong.data['code'] == ['Código inválido ou expirado.']

    response = APIClient().post(
        GUEST_CODE,
        {'email': 'curioso@example.com', 'code': code, 'tcleAccepted': True, 'notices': {'campaigns': True, 'email': True}},
        format='json',
    )
    assert response.status_code == 200 and response.data['me']['id'] == first['me']['id']
    assert response.data['me']['emailConfirmed'] is True, 'o código chegou no e-mail: o endereço está confirmado'
    prefs = Preferences.objects.get(participant__user_id=first['me']['id'])
    assert (prefs.campaigns, prefs.events, prefs.email) == (True, True, True), 'o que estava ligado continua; o novo liga'
    assert ConsentAcceptance.objects.filter(user_id=first['me']['id']).count() == 1, 'mesma versão: não grava outro aceite'

    reused = APIClient().post(GUEST_CODE, {'email': 'curioso@example.com', 'code': code}, format='json')
    assert reused.status_code == 400, 'o código vale uma vez'


def test_returning_guest_accepts_new_terms_version(api, seeded):
    first = enter(api).data
    ConsentDocument.objects.filter(kind='termos', is_current=True).update(is_current=False)
    ConsentDocument.objects.create(kind='termos', version='1.2', title='Termos de uso', sections=[], published_at=timezone.localdate(), is_current=True)
    mail.outbox.clear()
    enter(APIClient())
    code = code_from(mail.outbox[0])

    missing = APIClient().post(GUEST_CODE, {'email': 'curioso@example.com', 'code': code}, format='json')
    assert missing.status_code == 400 and 'aceitar o termo' in missing.data['tcleAccepted'][0]
    mail.outbox.clear()
    enter(APIClient())
    code = code_from(mail.outbox[0])
    response = APIClient().post(GUEST_CODE, {'email': 'curioso@example.com', 'code': code, 'tcleAccepted': True}, format='json')
    assert response.status_code == 200
    versions = sorted(item.document.version for item in ConsentAcceptance.objects.filter(user_id=first['me']['id']))
    assert versions == ['1.1', '1.2']


def test_email_of_donor_or_receptor_asks_for_the_password(api, donor):
    mail.outbox.clear()
    response = enter(api, email=DONOR['email'])
    assert response.status_code == 400 and response.data['email'] == [services.OWNED_BY_ACCOUNT]
    assert mail.outbox == [], 'nenhum código para conta com senha'


def test_guests_expire_after_twelve_months_without_access(api, seeded):
    stale = enter(api).data
    fresh = enter(APIClient(), email='novo@example.com').data
    donor_data = APIClient().post(REGISTER, DONOR, format='json').data
    now = timezone.now()
    for pk, days in ((stale['me']['id'], 366), (fresh['me']['id'], 364), (donor_data['me']['id'], 900)):
        Participant.objects.filter(user_id=pk).update(ultimo_acesso=now - timedelta(days=days))
    PushToken.objects.create(user_id=stale['me']['id'], token='ExponentPushToken[velho]', platform='android')

    assert services.expire_guests(now) == 1
    gone = Participant.objects.select_related('user').get(user_id=stale['me']['id'])
    assert gone.user.status == Status.INATIVO and gone.user.email is None and gone.anonymized_at
    assert not PushToken.objects.filter(user_id=stale['me']['id']).exists()
    assert Participant.objects.get(user_id=fresh['me']['id']).user.email == 'novo@example.com'
    assert Participant.objects.get(user_id=donor_data['me']['id']).user.status == Status.ATIVO, 'o prazo é só do convidado'

    # O e-mail fica livre: quem volta depois do prazo começa um registro novo, sem código.
    again = enter(APIClient())
    assert again.status_code == 201 and again.data['me']['id'] != stale['me']['id']


def test_opening_the_app_counts_as_access(api, seeded):
    guest = enter(api).data
    old = timezone.now() - timedelta(days=200)
    Participant.objects.filter(user_id=guest['me']['id']).update(ultimo_acesso=old)
    assert auth(APIClient(), guest['access']).get('/api/v1/me/').status_code == 200
    assert Participant.objects.get(user_id=guest['me']['id']).ultimo_acesso > old


def test_guest_clears_email_by_deactivating_without_password(api, seeded):
    guest = enter(api).data
    client = auth(APIClient(), guest['access'])
    assert client.post('/api/v1/me/deactivate/', {}, format='json').status_code == 204
    user = participants().get()
    assert user.status == Status.INATIVO and user.email is None
