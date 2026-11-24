import importlib
import re
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import pytest
from django.apps import apps as django_apps
from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from catalog.models import PublishStatus
from engagement import tasks
from engagement.health import health
from engagement.models import Notification, NotificationDelivery, Preferences, PushToken

from .conftest import DONOR, auth

pytestmark = pytest.mark.django_db

BRASILIA = ZoneInfo('America/Sao_Paulo')
MORNING = datetime(2026, 11, 24, 10, 0, tzinfo=BRASILIA)
TOKEN = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]'


def register(api, email, uf='AL', city='Maceió', **extra) -> APIClient:
    body = {key: value for key, value in DONOR.items() if key != 'cpf'}
    response = api.post('/api/v1/auth/register/', {**body, 'email': email, 'uf': uf, 'city': city, **extra}, format='json')
    assert response.status_code == 201, response.data
    return auth(APIClient(), response.data['access'])


def code_from(message) -> str:
    return re.search(r'\b(\d{6})\b', message.body).group(1)


def prefs_of(email: str) -> Preferences:
    return Preferences.objects.get(participant__user__email=email)


def opt_in(email: str, push=False, mail_on=False, **topics):
    user = User.objects.get(email=email, role='participant')
    if push:
        PushToken.objects.create(user=user, token=f'ExponentPushToken[{user.pk}xxxxxxxxxxxx]', platform='android')
    if mail_on:
        user.email_confirmado_em = timezone.now()
        user.save(update_fields=['email_confirmado_em'])
    Preferences.objects.filter(participant__user=user).update(push=push, email=mail_on, **topics)
    return user


def notice(**fields) -> Notification:
    defaults = {
        'tipo': 'campanha', 'titulo': 'Mutirão no Hemoal', 'mensagem': 'Sábado, no Hemoal Maceió.', 'origem': 'Hemoal',
        'uf': 'AL', 'data_disparo': MORNING - timedelta(minutes=5), 'status': PublishStatus.PUBLICADO,
    }
    return Notification.objects.create(**{**defaults, **fields})


@pytest.fixture
def expo(monkeypatch):
    sent: list[dict] = []
    replies: dict[str, dict] = {}

    def fake(messages):
        sent.extend(messages)
        return [replies.get(item['to'], {'status': 'ok', 'id': 'ticket'}) for item in messages]

    monkeypatch.setattr(tasks, 'post_to_expo', fake)
    return sent, replies


def test_registration_is_strictly_opt_in(api, seeded):
    client = register(api, 'nova@example.com')
    prefs = client.get('/api/v1/me/preferences/').data
    assert {key: prefs[key] for key in ('push', 'email', 'campaigns', 'events', 'official')} == dict.fromkeys(
        ('push', 'email', 'campaigns', 'events', 'official'), False
    )
    assert prefs['hasEmail'] and not prefs['emailConfirmed'] and not prefs['hasDevice']
    assert client.get('/api/v1/me/inbox/').data == [], 'sem assunto escolhido, a caixa de entrada fica vazia'
    assert mail.outbox == []


def test_email_channel_needs_code(api, seeded):
    client = register(api, 'nova@example.com', notices={'email': True, 'campaigns': True})
    assert prefs_of('nova@example.com').campaigns is True
    assert prefs_of('nova@example.com').email is False, 'o canal só liga depois do código'
    assert len(mail.outbox) == 1 and 'Confirme seu e-mail' in mail.outbox[0].subject
    code = code_from(mail.outbox[0])

    refused = client.patch('/api/v1/me/preferences/', {'email': True}, format='json')
    assert refused.status_code == 400 and 'Confirme seu e-mail' in refused.data['email'][0]

    api.post('/api/v1/auth/password/forgot/', {'identifier': 'nova@example.com'}, format='json')
    reset_code = code_from(mail.outbox[-1])
    assert client.post('/api/v1/me/email/confirmar/', {'code': reset_code}, format='json').status_code == 400, (
        'código de senha não confirma e-mail'
    )
    assert client.post('/api/v1/me/email/confirmar/', {'code': '000000' if code != '000000' else '111111'}, format='json').status_code == 400

    confirmed = client.post('/api/v1/me/email/confirmar/', {'code': code}, format='json')
    assert confirmed.status_code == 200 and confirmed.data['email'] is True and confirmed.data['emailConfirmed'] is True
    assert client.get('/api/v1/me/').data['emailConfirmed'] is True

    client.patch('/api/v1/me/', {'email': 'outra@example.com'}, format='json')
    prefs = client.get('/api/v1/me/preferences/').data
    assert prefs['email'] is False and prefs['emailConfirmed'] is False, 'endereço novo pede nova confirmação'

    assert client.post('/api/v1/me/email/codigo/').status_code == 202
    assert mail.outbox[-1].to == ['outra@example.com']


def test_push_channel_needs_a_device(api, seeded):
    client = register(api, 'nova@example.com')
    refused = client.patch('/api/v1/me/preferences/', {'push': True}, format='json')
    assert refused.status_code == 400 and 'Permita as notificações' in refused.data['push'][0]
    assert client.post('/api/v1/me/push-tokens/', {'token': 'qualquer-coisa'}, format='json').status_code == 400

    assert client.post('/api/v1/me/push-tokens/', {'token': TOKEN, 'platform': 'ios'}, format='json').status_code == 204
    assert client.patch('/api/v1/me/preferences/', {'push': True}, format='json').data['push'] is True

    assert client.delete('/api/v1/me/push-tokens/', {'token': TOKEN}, format='json').status_code == 204
    assert PushToken.objects.count() == 0 and prefs_of('nova@example.com').push is False, 'logout sem aparelho desliga o push'


def test_migration_turns_channels_off_and_marks_old_notices(api, seeded):
    register(api, 'nova@example.com')
    Preferences.objects.update(push=True, email=True, campaigns=True)
    old = notice(data_disparo=timezone.now() - timedelta(days=1))
    future = notice(titulo='Futuro', data_disparo=timezone.now() + timedelta(days=1))
    migration = importlib.import_module('engagement.migrations.0002_avisos_opt_in_e_envios')
    migration.opt_out_and_mark_sent(django_apps, None)

    prefs = prefs_of('nova@example.com')
    assert (prefs.push, prefs.email, prefs.campaigns) == (False, False, True), 'assuntos de quem já tinha conta ficam'
    old.refresh_from_db()
    future.refresh_from_db()
    assert old.disparado_em == old.data_disparo and future.disparado_em is None


def test_unsubscribe_link(api, seeded):
    register(api, 'nova@example.com')
    user = opt_in('nova@example.com', mail_on=True, campaigns=True)
    from engagement.services import unsubscribe_url

    path = unsubscribe_url(user).removeprefix('http://localhost:8000')
    page = api.get(path)
    assert page.status_code == 200 and 'Parar de receber' in page.content.decode()
    assert prefs_of('nova@example.com').email is True, 'abrir o link não desliga sozinho'

    assert api.post(path).status_code == 200
    assert prefs_of('nova@example.com').email is False
    assert api.get('/api/v1/avisos/sair/token-falso/').status_code == 404


def test_dispatch_follows_region_topic_and_channel(api, seeded, expo):
    sent, _ = expo
    for email, uf, city in (('al@example.com', 'AL', 'Maceió'), ('pe@example.com', 'PE', 'Recife'), ('semassunto@example.com', 'AL', 'Maceió')):
        register(api, email, uf=uf, city=city)
    alagoas = opt_in('al@example.com', push=True, mail_on=True, campaigns=True)
    opt_in('pe@example.com', push=True, mail_on=True, campaigns=True)
    opt_in('semassunto@example.com', push=True, mail_on=True, campaigns=False)
    item = notice()
    mail.outbox.clear()

    assert tasks.dispatch(MORNING) == 1
    assert [message['to'] for message in sent] == [alagoas.push_tokens.get().token]
    assert sent[0]['title'] == item.titulo and sent[0]['data'] == {'noticeId': str(item.pk)}
    assert [message.to for message in mail.outbox] == [['al@example.com']]
    link = mail.outbox[0].extra_headers['List-Unsubscribe']
    assert '/api/v1/avisos/sair/' in mail.outbox[0].body and link.startswith('<http')
    assert set(NotificationDelivery.objects.values_list('user__email', 'channel', 'status')) == {
        ('al@example.com', 'push', 'enviado'),
        ('al@example.com', 'email', 'enviado'),
    }

    assert tasks.dispatch(MORNING + timedelta(minutes=5)) == 0, 'o mesmo aviso não sai duas vezes'
    assert len(sent) == 1 and len(mail.outbox) == 1


def test_dispatch_waits_for_the_daytime_window(api, seeded, expo):
    sent, _ = expo
    register(api, 'al@example.com')
    opt_in('al@example.com', push=True, campaigns=True)
    night = datetime(2026, 11, 23, 21, 0, tzinfo=BRASILIA)
    item = notice(data_disparo=night - timedelta(minutes=1))

    assert tasks.dispatch(night) == 0
    assert tasks.dispatch(datetime(2026, 11, 24, 7, 59, tzinfo=BRASILIA)) == 0
    item.refresh_from_db()
    assert item.disparado_em is None and sent == []
    assert tasks.dispatch(datetime(2026, 11, 24, 8, 0, tzinfo=BRASILIA)) == 1 and len(sent) == 1


def test_dispatch_skips_stale_and_unpublished_notices(api, seeded, expo):
    sent, _ = expo
    register(api, 'al@example.com')
    opt_in('al@example.com', push=True, campaigns=True)
    notice(data_disparo=MORNING - timedelta(days=3))
    notice(titulo='Rascunho', status=PublishStatus.RASCUNHO)
    notice(titulo='Amanhã', data_disparo=MORNING + timedelta(days=1))
    assert tasks.dispatch(MORNING) == 0 and sent == []


def test_dispatch_drops_unregistered_devices(api, seeded, expo):
    _, replies = expo
    register(api, 'al@example.com')
    user = opt_in('al@example.com', push=True, campaigns=True)
    token = user.push_tokens.get().token
    replies[token] = {'status': 'error', 'message': 'not registered', 'details': {'error': 'DeviceNotRegistered'}}
    notice()

    tasks.dispatch(MORNING)
    assert not PushToken.objects.filter(token=token).exists()
    delivery = NotificationDelivery.objects.get()
    assert delivery.status == 'falhou' and delivery.error == 'not registered'

    tasks.dispatch(MORNING + timedelta(minutes=5))
    delivery.refresh_from_db()
    assert delivery.status == 'ignorado' and delivery.attempts == 2, 'sem aparelho, a nova tentativa desiste'


def test_email_quota_leaves_the_rest_for_the_next_day(api, seeded, expo, settings):
    settings.EMAIL_DAILY_LIMIT, settings.EMAIL_DAILY_RESERVE = 53, 50  # 3 e-mails de aviso por dia
    emails = [f'pessoa{index}@example.com' for index in range(5)]
    for email in emails:
        register(api, email)
        opt_in(email, mail_on=True, campaigns=True)
    notice()
    mail.outbox.clear()

    tasks.dispatch(MORNING)
    assert len(mail.outbox) == 3
    assert NotificationDelivery.objects.filter(status='pendente').count() == 2

    tasks.dispatch(MORNING + timedelta(hours=2))
    assert len(mail.outbox) == 3, 'a cota do dia acabou'

    tasks.dispatch(MORNING + timedelta(days=1))
    assert len(mail.outbox) == 5 and not NotificationDelivery.objects.exclude(status='enviado').exists()
    assert sorted(to for message in mail.outbox for to in message.to) == sorted(emails)


def test_email_quota_counts_codes_beyond_the_reserve(api, seeded, settings):
    settings.EMAIL_DAILY_LIMIT, settings.EMAIL_DAILY_RESERVE = 10, 2
    register(api, 'al@example.com')
    user = User.objects.get(email='al@example.com', role='participant')
    for _ in range(7):
        tasks.PasswordResetCode.issue(user, tasks.PasswordResetCode.Purpose.EMAIL)
    tasks.PasswordResetCode.objects.update(created_at=MORNING - timedelta(hours=1))
    assert tasks.email_budget(MORNING) == 3, '10 de cota, 7 códigos (acima da reserva de 2), nenhum aviso'
    assert tasks.email_budget(MORNING + timedelta(days=1)) == 8, 'no dia seguinte, os códigos de ontem não contam'
    settings.EMAIL_DAILY_LIMIT = 0
    assert tasks.email_budget(MORNING) is None, 'sem limite'


def test_failures_are_retried_until_the_limit(api, seeded, expo, settings):
    sent, replies = expo
    register(api, 'al@example.com')
    user = opt_in('al@example.com', push=True, campaigns=True)
    token = user.push_tokens.get().token
    replies[token] = {'status': 'error', 'message': 'MessageRateExceeded'}
    notice()

    for minutes in (0, 5, 10, 15):
        tasks.dispatch(MORNING + timedelta(minutes=minutes))
    delivery = NotificationDelivery.objects.get()
    assert delivery.status == 'falhou' and delivery.attempts == settings.NOTIFY_MAX_ATTEMPTS
    assert len(sent) == settings.NOTIFY_MAX_ATTEMPTS, 'depois do limite, não tenta mais'

    delivery.status, delivery.attempts = 'falhou', 1
    delivery.save()
    replies.clear()
    tasks.dispatch(MORNING + timedelta(minutes=20))
    delivery.refresh_from_db()
    assert delivery.status == 'enviado' and delivery.attempts == 2


def test_queue_expires_with_the_notice(api, seeded, expo, settings):
    settings.EMAIL_DAILY_LIMIT, settings.EMAIL_DAILY_RESERVE = 50, 50  # nenhum e-mail de aviso cabe
    register(api, 'al@example.com')
    opt_in('al@example.com', mail_on=True, campaigns=True)
    notice()
    mail.outbox.clear()

    tasks.dispatch(MORNING)
    assert NotificationDelivery.objects.get().status == 'pendente'
    tasks.dispatch(MORNING + timedelta(days=3))
    delivery = NotificationDelivery.objects.get()
    assert delivery.status == 'ignorado' and delivery.error == tasks.EXPIRED and mail.outbox == []


def test_smtp_down_puts_emails_back_in_the_queue(api, seeded, expo, monkeypatch):
    register(api, 'al@example.com')
    opt_in('al@example.com', mail_on=True, campaigns=True)
    notice()

    class Down:
        def open(self):
            raise OSError('connection refused')

        def close(self):
            pass

    monkeypatch.setattr(tasks, 'get_connection', lambda: Down())
    tasks.dispatch(MORNING)
    delivery = NotificationDelivery.objects.get()
    assert delivery.status == 'falhou' and 'SMTP indisponível' in delivery.error

    monkeypatch.undo()
    mail.outbox.clear()
    tasks.dispatch(MORNING + timedelta(minutes=5))
    delivery.refresh_from_db()
    assert delivery.status == 'enviado' and len(mail.outbox) == 1


@pytest.fixture
def receipts(monkeypatch):
    answers: dict[str, dict] = {}
    asked: list[list[str]] = []

    def fake(ids):
        asked.append(list(ids))
        return {ticket: answers[ticket] for ticket in ids if ticket in answers}

    monkeypatch.setattr(tasks, 'fetch_receipts', fake)
    return answers, asked


LATER = MORNING + timedelta(minutes=20)
BAD_TOKEN = {'status': 'error', 'message': 'APNs BadDeviceToken', 'details': {'error': 'DeveloperError', 'apns': {'reason': 'BadDeviceToken'}}}


def test_receipts_keep_delivered_and_drop_dead_devices(api, seeded, expo, receipts):
    _, replies = expo
    answers, asked = receipts
    register(api, 'al@example.com')
    user = opt_in('al@example.com', push=True, campaigns=True)
    first = user.push_tokens.get()
    second = PushToken.objects.create(user=user, token='ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]', platform='ios')
    replies[first.token] = {'status': 'ok', 'id': 'T1'}
    replies[second.token] = {'status': 'ok', 'id': 'T2'}
    notice()

    tasks.dispatch(MORNING)
    delivery = NotificationDelivery.objects.get()
    assert delivery.status == 'enviado' and {ticket['id'] for ticket in delivery.tickets} == {'T1', 'T2'}
    assert tasks.check_receipts(MORNING + timedelta(minutes=5)) == 0 and asked == [], 'espera 15 minutos'

    answers['T1'] = {'status': 'ok', 'id': 'T1'}
    answers['T2'] = BAD_TOKEN
    assert tasks.check_receipts(LATER) == 1
    delivery.refresh_from_db()
    assert delivery.status == 'enviado' and delivery.receipts_checked_at is not None, 'um aparelho recebeu'
    assert list(user.push_tokens.values_list('token', flat=True)) == [first.token], 'token recusado pela Apple sai'
    assert tasks.check_receipts(LATER + timedelta(minutes=15)) == 0, 'recibo já lido não volta'


def test_receipt_failure_goes_back_to_the_queue(api, seeded, expo, receipts):
    sent, replies = expo
    answers, _ = receipts
    register(api, 'al@example.com')
    token = opt_in('al@example.com', push=True, campaigns=True).push_tokens.get().token
    replies[token] = {'status': 'ok', 'id': 'T1'}
    notice()
    tasks.dispatch(MORNING)

    answers['T1'] = BAD_TOKEN
    tasks.check_receipts(LATER)
    delivery = NotificationDelivery.objects.get()
    assert delivery.status == 'falhou' and delivery.error == 'APNs BadDeviceToken' and not PushToken.objects.exists()

    tasks.dispatch(LATER + timedelta(minutes=5))
    delivery.refresh_from_db()
    assert delivery.status == 'ignorado' and len(sent) == 1, 'sem aparelho, não reenvia'


def test_temporary_receipt_error_is_retried(api, seeded, expo, receipts):
    sent, replies = expo
    answers, _ = receipts
    register(api, 'al@example.com')
    token = opt_in('al@example.com', push=True, campaigns=True).push_tokens.get().token
    replies[token] = {'status': 'ok', 'id': 'T1'}
    notice()
    tasks.dispatch(MORNING)

    answers['T1'] = {'status': 'error', 'message': 'Too many', 'details': {'error': 'MessageRateExceeded'}}
    tasks.check_receipts(LATER)
    assert NotificationDelivery.objects.get().status == 'falhou' and PushToken.objects.filter(token=token).exists()

    replies[token] = {'status': 'ok', 'id': 'T2'}
    tasks.dispatch(LATER + timedelta(minutes=5))
    delivery = NotificationDelivery.objects.get()
    assert len(sent) == 2 and delivery.status == 'enviado' and delivery.attempts == 2
    assert [ticket['id'] for ticket in delivery.tickets] == ['T2'] and delivery.receipts_checked_at is None, 'espera o recibo novo'


def test_receipt_that_never_comes_is_recorded(api, seeded, expo, receipts):
    register(api, 'al@example.com')
    opt_in('al@example.com', push=True, campaigns=True)
    notice()
    tasks.dispatch(MORNING)

    assert tasks.check_receipts(LATER) == 0, 'recibo ainda não saiu'
    assert tasks.check_receipts(MORNING + timedelta(hours=25)) == 1
    delivery = NotificationDelivery.objects.get()
    assert delivery.status == 'enviado' and delivery.error == tasks.RECEIPT_LOST


def test_expo_down_while_reading_receipts(api, seeded, expo, monkeypatch):
    register(api, 'al@example.com')
    opt_in('al@example.com', push=True, campaigns=True)
    notice()
    tasks.dispatch(MORNING)

    def down(ids):
        raise httpx.ConnectError('fora do ar')

    monkeypatch.setattr(tasks, 'fetch_receipts', down)
    assert tasks.check_receipts(LATER) == 0
    assert NotificationDelivery.objects.get().receipts_checked_at is None, 'tenta de novo no próximo ciclo'


NOTICE_BODY = {
    'tipo': 'campanha',
    'titulo': 'Mutirão de cadastro',
    'mensagem': 'Sábado no Hemoal.',
    'origem': 'Hemoal',
    'uf': 'AL',
    'cidade': '',
    'data_disparo': '2026-12-01T10:00:00-03:00',
    'status': 'rascunho',
}


def test_only_publishers_publish_notices(staff_login):
    editor = staff_login('silva_js@email.com', 'senha123')
    assert editor.get('/api/v1/staff/me/').data['podePublicarAvisos'] is False
    draft = editor.post('/api/v1/staff/notifications/', NOTICE_BODY, format='json')
    assert draft.status_code == 201, draft.data
    assert editor.post('/api/v1/staff/notifications/', {**NOTICE_BODY, 'status': 'publicado'}, format='json').status_code == 403
    path = f'/api/v1/staff/notifications/{draft.data["id"]}/'
    assert editor.patch(path, {'status': 'publicado'}, format='json').status_code == 403

    admin = staff_login()
    assert admin.get('/api/v1/staff/me/').data['podePublicarAvisos'] is True
    published = admin.patch(path, {'status': 'publicado'}, format='json')
    assert published.status_code == 200 and published.data['status'] == 'publicado'
    assert published.data['envios']['push'] == {'pendente': 0, 'enviado': 0, 'falhou': 0, 'ignorado': 0}
    assert editor.patch(path, {'titulo': 'Outro'}, format='json').status_code == 403, 'publicado só muda com permissão'
    assert editor.delete(path).status_code == 403


def test_reach_shows_only_counts(api, staff_login):
    register(api, 'al@example.com')
    register(api, 'pe@example.com', uf='PE', city='Recife')
    opt_in('al@example.com', push=True, mail_on=True, campaigns=True)
    opt_in('pe@example.com', campaigns=True)
    admin = staff_login()

    alagoas = admin.get('/api/v1/staff/notifications/alcance/', {'tipo': 'campanha', 'uf': 'AL'}).data
    assert alagoas == {'caixaDeEntrada': 1, 'push': 1, 'email': 1}
    assert admin.get('/api/v1/staff/notifications/alcance/', {'tipo': 'campanha'}).data['caixaDeEntrada'] == 2
    assert admin.get('/api/v1/staff/notifications/alcance/', {'tipo': 'evento'}).data == {'caixaDeEntrada': 0, 'push': 0, 'email': 0}
    assert admin.get('/api/v1/staff/notifications/alcance/', {'tipo': 'x'}).status_code == 400


def _fail_push(replies, user, code):
    replies[user.push_tokens.get().token] = {'status': 'error', 'message': f'Erro {code}', 'details': {'error': code}}


def test_health_flags_push_credentials(api, seeded, expo):
    _, replies = expo
    for index in range(3):
        register(api, f'p{index}@example.com')
        _fail_push(replies, opt_in(f'p{index}@example.com', push=True, campaigns=True), 'InvalidCredentials')
    notice()
    tasks.dispatch(MORNING)

    report = health(MORNING + timedelta(minutes=1))
    assert report['ultimas24h']['push'] == {'enviados': 0, 'falhas': 3}
    assert [alert['titulo'] for alert in report['alertas']] == ['Credenciais de push com problema']
    assert report['alertas'][0]['nivel'] == 'erro' and '3 envio(s)' in report['alertas'][0]['texto']
    assert health(MORNING + timedelta(days=2))['alertas'] == [], 'só as últimas 24 horas'


def test_health_flags_mass_failures_and_quota(api, seeded, expo, settings):
    _, replies = expo
    settings.EMAIL_DAILY_LIMIT, settings.EMAIL_DAILY_RESERVE = 50, 50  # nenhum e-mail de aviso cabe
    for index in range(5):
        register(api, f'p{index}@example.com')
        _fail_push(replies, opt_in(f'p{index}@example.com', push=True, mail_on=True, campaigns=True), 'MessageRateExceeded')
    notice()
    tasks.dispatch(MORNING)

    alerts = health(MORNING)['alertas']
    assert [alert['titulo'] for alert in alerts] == ['Muitas falhas de push', 'Cota diária de e-mail esgotada']
    assert '5 de 5' in alerts[0]['texto'] and '5 e-mail(s)' in alerts[1]['texto']


def test_health_flags_smtp_down(api, seeded, expo, monkeypatch):
    register(api, 'al@example.com')
    opt_in('al@example.com', mail_on=True, campaigns=True)
    notice()

    class Down:
        def open(self):
            raise OSError('connection refused')

        def close(self):
            pass

    monkeypatch.setattr(tasks, 'get_connection', lambda: Down())
    tasks.dispatch(MORNING)
    assert [alert['titulo'] for alert in health(MORNING)['alertas']] == ['Servidor de e-mail fora do ar ou recusando a conexão']


def test_health_route_is_for_the_team_only(api, seeded, staff_login):
    team = staff_login()
    response = team.get('/api/v1/staff/notifications/saude/')
    assert response.status_code == 200 and set(response.data) == {'ultimas24h', 'alertas'}
    participant = register(api, 'al@example.com')
    assert participant.get('/api/v1/staff/notifications/saude/').status_code == 403
