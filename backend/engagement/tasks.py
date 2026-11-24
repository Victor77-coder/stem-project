from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMessage, get_connection
from django.db.models import Q
from django.utils import timezone

from accounts.models import PasswordResetCode
from catalog.models import PublishStatus

from .models import Notification, NotificationDelivery as Delivery, PushToken
from .services import audience, email_ready, push_ready, unsubscribe_url

PUSH_BATCH = 100
# Aviso publicado com data de disparo antiga fica só na caixa de entrada: push e e-mail atrasados confundem.
STALE_AFTER = timedelta(days=2)
EXPIRED = 'Expirou na fila: o aviso tem mais de 2 dias.'

# Recibos da Expo: a Expo recomenda esperar uns 15 minutos e guarda cada recibo por 24 horas.
RECEIPT_DELAY = timedelta(minutes=15)
RECEIPT_TTL = timedelta(hours=24)
RECEIPT_BATCH = 1000
RECEIPT_LOST = 'O recibo da Expo expirou sem resposta; a entrega não foi confirmada.'
# Token que não vale mais para o aparelho (app desinstalado ou token de outro app): sai da base.
GONE_ERRORS = {'DeviceNotRegistered', 'BadDeviceToken'}


def in_window(now: datetime) -> bool:
    start, end = settings.NOTIFY_HOURS
    return start <= now.astimezone(ZoneInfo(settings.NOTIFY_TIMEZONE)).hour < end


@shared_task(ignore_result=True)
def dispatch_due() -> None:
    dispatch(timezone.now())


def dispatch(now: datetime) -> int:
    """Põe na fila os avisos que venceram e envia a fila. Devolve quantos avisos começaram agora."""
    if not in_window(now):
        return 0
    due = Notification.objects.filter(
        status=PublishStatus.PUBLICADO,
        disparado_em__isnull=True,
        data_disparo__lte=now,
        data_disparo__gte=now - STALE_AFTER,
    )
    started = 0
    for notice in due:
        # Reserva o aviso antes de enfileirar: com dois workers, só um passa.
        if Notification.objects.filter(pk=notice.pk, disparado_em__isnull=True).update(disparado_em=now):
            queue_notice(notice)
            started += 1
    deliver(now)
    return started


def queue_notice(notice: Notification) -> None:
    """Um envio pendente por pessoa e canal, com quem está pronto para receber agora."""
    people = audience(notice.tipo, notice.uf, notice.cidade)
    rows = [
        Delivery(notification=notice, user_id=pk, channel=Delivery.Channel.PUSH)
        for pk in people.filter(push_ready()).values_list('user_id', flat=True).distinct()
    ] + [
        Delivery(notification=notice, user_id=pk, channel=Delivery.Channel.EMAIL)
        for pk in people.filter(email_ready()).values_list('user_id', flat=True)
    ]
    Delivery.objects.bulk_create(rows, ignore_conflicts=True)


def email_budget(now: datetime) -> int | None:
    """Quantos e-mails de aviso ainda cabem hoje (dia de Brasília). None = sem limite.

    A cota do provedor soma avisos e códigos de 6 dígitos. Os códigos têm a reserva garantida; se passarem dela,
    o excesso também sai da parte dos avisos.
    """
    if not settings.EMAIL_DAILY_LIMIT:
        return None
    start = now.astimezone(ZoneInfo(settings.NOTIFY_TIMEZONE)).replace(hour=0, minute=0, second=0, microsecond=0)
    notices = Delivery.objects.filter(channel=Delivery.Channel.EMAIL, status=Delivery.Status.ENVIADO, sent_at__gte=start).count()
    codes = PasswordResetCode.objects.filter(created_at__gte=start).count()
    return max(0, settings.EMAIL_DAILY_LIMIT - notices - max(settings.EMAIL_DAILY_RESERVE, codes))


def deliver(now: datetime) -> None:
    """Envia o que está na fila: pendentes e falhas com tentativas sobrando, de avisos ainda recentes.

    E-mail além da cota do dia fica pendente e sai na janela seguinte, a partir das 8h.
    """
    waiting = Delivery.objects.filter(notification__disparado_em__isnull=False).filter(
        Q(status=Delivery.Status.PENDENTE) | Q(status=Delivery.Status.FALHOU, attempts__lt=settings.NOTIFY_MAX_ATTEMPTS)
    )
    waiting.filter(notification__data_disparo__lt=now - STALE_AFTER).update(
        status=Delivery.Status.IGNORADO, error=EXPIRED, error_code='Expirou', updated_at=now
    )
    queue = list(
        waiting.filter(notification__data_disparo__gte=now - STALE_AFTER)
        .select_related('user', 'notification')
        .order_by('notification__data_disparo', 'notification_id', 'pk')
    )
    by_notice: dict[int, list[Delivery]] = {}
    for item in queue:
        by_notice.setdefault(item.notification_id, []).append(item)
    budget = email_budget(now)
    for items in by_notice.values():
        notice = items[0].notification
        _send_push(notice, [item for item in items if item.channel == Delivery.Channel.PUSH], now)
        emails = [item for item in items if item.channel == Delivery.Channel.EMAIL]
        if budget is not None:
            emails, budget = emails[:budget], max(0, budget - len(emails))
        _send_email(notice, emails, now)


def _finish(
    delivery: Delivery, status: str, now: datetime, error: str = '', tickets: list[dict] | None = None, code: str = ''
) -> None:
    delivery.status = status
    delivery.error = error[:500]
    delivery.error_code = code[:40]
    delivery.sent_at = now if status == Delivery.Status.ENVIADO else None
    delivery.attempts += 1
    # Nova tentativa, novos tickets: o recibo volta a ser esperado.
    delivery.tickets = tickets or []
    delivery.receipts_checked_at = None
    delivery.updated_at = now
    delivery.save(
        update_fields=['status', 'error', 'error_code', 'sent_at', 'attempts', 'tickets', 'receipts_checked_at', 'updated_at']
    )


def _error_code(details: dict) -> str:
    """O código da Expo; num DeveloperError, o motivo que a Apple deu (ex.: BadDeviceToken)."""
    apns = (details.get('apns') or {}).get('reason')
    return (apns if details.get('error') == 'DeveloperError' and apns else details.get('error')) or ''


def _expo_headers() -> dict:
    headers = {'Accept': 'application/json', 'Content-Type': 'application/json'}
    if settings.EXPO_ACCESS_TOKEN:
        headers['Authorization'] = f'Bearer {settings.EXPO_ACCESS_TOKEN}'
    return headers


def post_to_expo(messages: list[dict]) -> list[dict]:
    response = httpx.post(settings.EXPO_PUSH_URL, json=messages, headers=_expo_headers(), timeout=15)
    response.raise_for_status()
    return response.json()['data']


def fetch_receipts(ids: list[str]) -> dict[str, dict]:
    """Recibos por ID de ticket. Ticket ainda sem recibo simplesmente não vem na resposta."""
    response = httpx.post(settings.EXPO_RECEIPTS_URL, json={'ids': ids}, headers=_expo_headers(), timeout=15)
    response.raise_for_status()
    return response.json().get('data') or {}


def _token_gone(details: dict) -> bool:
    """A Expo põe o motivo em `error` (DeviceNotRegistered) ou repassa o da Apple em `apns.reason` (BadDeviceToken)."""
    reasons = {details.get('error'), (details.get('apns') or {}).get('reason')}
    return bool(reasons & GONE_ERRORS)


@shared_task(ignore_result=True)
def check_receipts_due() -> None:
    check_receipts(timezone.now())


def check_receipts(now: datetime) -> int:
    """Lê os recibos dos pushes aceitos pela Expo há mais de 15 minutos. Devolve quantos envios foram resolvidos.

    Com ao menos um aparelho aceito pela Apple ou pelo Google, o envio fica "enviado". Se todos falharem, vira
    "falhou" e volta para a fila de novas tentativas; token que não vale mais é apagado, e aí a nova tentativa
    termina como "ignorado". Recibo que não chega em 24 horas fica registrado como não confirmado.
    """
    waiting = list(
        Delivery.objects.filter(
            channel=Delivery.Channel.PUSH,
            status=Delivery.Status.ENVIADO,
            receipts_checked_at__isnull=True,
            sent_at__lte=now - RECEIPT_DELAY,
        ).exclude(tickets=[])
    )
    ids = [ticket['id'] for delivery in waiting for ticket in delivery.tickets if ticket.get('id')]
    receipts: dict[str, dict] = {}
    for start in range(0, len(ids), RECEIPT_BATCH):
        try:
            receipts.update(fetch_receipts(ids[start : start + RECEIPT_BATCH]))
        except (httpx.HTTPError, KeyError, ValueError):
            return 0  # Expo fora do ar: os recibos continuam lá até 24 horas, o próximo ciclo tenta de novo.

    gone: list[str] = []
    resolved = 0
    for delivery in waiting:
        results = [(ticket, receipts.get(ticket.get('id', ''))) for ticket in delivery.tickets]
        if any(receipt is None for _, receipt in results) and delivery.sent_at > now - RECEIPT_TTL:
            continue  # recibo ainda não saiu
        failures = [(ticket, receipt) for ticket, receipt in results if receipt and receipt.get('status') != 'ok']
        gone += [ticket['token'] for ticket, receipt in failures if _token_gone(receipt.get('details') or {})]
        delivery.receipts_checked_at = now
        delivery.updated_at = now
        fields = ['receipts_checked_at', 'updated_at']
        delivered = any(receipt and receipt.get('status') == 'ok' for _, receipt in results)
        if not delivered and failures:
            delivery.status = Delivery.Status.FALHOU
            delivery.error = (failures[0][1].get('message') or 'Erro no recibo da Expo.')[:500]
            delivery.error_code = _error_code(failures[0][1].get('details') or {})[:40]
            delivery.sent_at = None
            fields += ['status', 'error', 'error_code', 'sent_at']
        elif not delivered:
            delivery.error = RECEIPT_LOST
            delivery.error_code = 'SemRecibo'
            fields += ['error', 'error_code']
        delivery.save(update_fields=fields)
        resolved += 1
    PushToken.objects.filter(token__in=gone).delete()
    return resolved


def _send_push(notice: Notification, deliveries: list[Delivery], now: datetime) -> None:
    if not deliveries:
        return
    tokens = list(PushToken.objects.filter(user_id__in=[item.user_id for item in deliveries]))
    accepted: dict[int, list[dict]] = {}
    errors: dict[int, tuple[str, str]] = {}
    gone: list[int] = []
    for start in range(0, len(tokens), PUSH_BATCH):
        batch = tokens[start : start + PUSH_BATCH]
        messages = [
            {'to': item.token, 'title': notice.titulo, 'body': notice.mensagem, 'sound': 'default', 'data': {'noticeId': str(notice.pk)}}
            for item in batch
        ]
        try:
            tickets = post_to_expo(messages)
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            tickets = [{'status': 'error', 'message': f'Expo indisponível: {exc}', 'details': {'error': 'ExpoIndisponivel'}}] * len(batch)
        for item, ticket in zip(batch, tickets):
            if ticket.get('status') == 'ok':
                # Aceito pela Expo, mas ainda não pela Apple ou pelo Google: o recibo confirma depois.
                accepted.setdefault(item.user_id, []).append({'id': ticket.get('id', ''), 'token': item.token})
                continue
            details = ticket.get('details') or {}
            errors[item.user_id] = (ticket.get('message') or 'Erro desconhecido na Expo.', _error_code(details))
            if _token_gone(details):
                gone.append(item.pk)
    PushToken.objects.filter(pk__in=gone).delete()
    with_token = {item.user_id for item in tokens}
    for delivery in deliveries:
        if delivery.user_id in accepted:
            _finish(delivery, Delivery.Status.ENVIADO, now, tickets=accepted[delivery.user_id])
        elif delivery.user_id not in with_token:
            _finish(delivery, Delivery.Status.IGNORADO, now, 'Nenhum aparelho registrado.', code='SemAparelho')
        else:
            message, code = errors.get(delivery.user_id, ('', ''))
            _finish(delivery, Delivery.Status.FALHOU, now, message, code=code)


def _email_body(notice: Notification, link: str) -> str:
    origin = f'\n\nOrigem: {notice.origem}' if notice.origem else ''
    return (
        f'{notice.titulo}\n\n{notice.mensagem}{origin}\n\n'
        '—\n'
        'Você recebe este e-mail porque ativou os avisos por e-mail no aplicativo STEM Project.\n'
        f'Para parar de receber: {link}\n'
    )


def _send_email(notice: Notification, deliveries: list[Delivery], now: datetime) -> None:
    if not deliveries:
        return
    connection = get_connection()
    try:
        connection.open()
    except Exception as exc:  # provedor fora do ar ou credencial errada: tudo volta para a fila.
        for delivery in deliveries:
            _finish(delivery, Delivery.Status.FALHOU, now, f'SMTP indisponível: {exc}', code='SMTPIndisponivel')
        return
    try:
        for delivery in deliveries:
            user = delivery.user
            if not user.email or user.email_confirmado_em is None:
                _finish(delivery, Delivery.Status.IGNORADO, now, 'E-mail não confirmado.', code='EmailNaoConfirmado')
                continue
            link = unsubscribe_url(user)
            message = EmailMessage(
                f'{notice.titulo} · STEM Project',
                _email_body(notice, link),
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                connection=connection,
                headers={'List-Unsubscribe': f'<{link}>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'},
            )
            try:
                message.send()
            except Exception as exc:  # SMTP recusou ou caiu: fica registrado e volta para a fila no disparo seguinte.
                _finish(delivery, Delivery.Status.FALHOU, now, str(exc), code='SMTPRecusou')
            else:
                _finish(delivery, Delivery.Status.ENVIADO, now)
    finally:
        connection.close()
