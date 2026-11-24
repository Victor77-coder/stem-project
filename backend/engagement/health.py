"""Saúde do envio de avisos, para o alerta do painel. Só contagens e motivos: nenhum dado de pessoa (RF013)."""

from datetime import datetime, timedelta

from django.db.models import Count

from .models import NotificationDelivery as Delivery
from .tasks import email_budget

WINDOW = timedelta(hours=24)
# Taxa de falha só vira alerta com um mínimo de tentativas, para um envio isolado não assustar ninguém.
MIN_TRIES = 5
HIGH_FAILURE = 0.5

PUSH, EMAIL = Delivery.Channel.PUSH, Delivery.Channel.EMAIL
LABEL = {PUSH: 'push', EMAIL: 'e-mail'}


def _alert(level: str, title: str, text: str) -> dict:
    return {'nivel': level, 'titulo': title, 'texto': text}


def health(now: datetime) -> dict:
    recent = Delivery.objects.filter(updated_at__gte=now - WINDOW)
    counts = {(channel, state): total for channel, state, total in recent.values_list('channel', 'status').annotate(total=Count('pk'))}
    codes = {
        (channel, code): total
        for channel, code, total in recent.filter(status=Delivery.Status.FALHOU)
        .values_list('channel', 'error_code')
        .annotate(total=Count('pk'))
    }
    summary = {
        channel: {'enviados': counts.get((channel, Delivery.Status.ENVIADO), 0), 'falhas': counts.get((channel, Delivery.Status.FALHOU), 0)}
        for channel in (PUSH, EMAIL)
    }
    alerts = []

    credentials = codes.get((PUSH, 'InvalidCredentials'), 0)
    if credentials:
        alerts.append(_alert(
            'erro',
            'Credenciais de push com problema',
            f'{credentials} envio(s) de push falharam nas últimas 24 horas porque faltam ou estão erradas as credenciais '
            'do Firebase (Android) ou da Apple (iPhone) no EAS. Até corrigir, nenhum push desse sistema chega.',
        ))
    smtp = codes.get((EMAIL, 'SMTPIndisponivel'), 0)
    if smtp:
        alerts.append(_alert(
            'erro',
            'Servidor de e-mail fora do ar ou recusando a conexão',
            f'{smtp} e-mail(s) não saíram nas últimas 24 horas. Confira as variáveis EMAIL_* do servidor e a conta no Brevo.',
        ))
    for channel in (PUSH, EMAIL):
        failed = summary[channel]['falhas']
        tried = summary[channel]['enviados'] + failed
        explained = credentials if channel == PUSH else smtp
        if tried >= MIN_TRIES and failed / tried >= HIGH_FAILURE and not explained:
            alerts.append(_alert(
                'aviso',
                f'Muitas falhas de {LABEL[channel]}',
                f'{failed} de {tried} envios de {LABEL[channel]} falharam nas últimas 24 horas. O motivo aparece em cada aviso disparado.',
            ))

    waiting = Delivery.objects.filter(channel=EMAIL, status=Delivery.Status.PENDENTE, notification__disparado_em__isnull=False).count()
    if waiting and email_budget(now) == 0:
        alerts.append(_alert(
            'info',
            'Cota diária de e-mail esgotada',
            f'{waiting} e-mail(s) de aviso esperam a próxima janela, a partir das 8h.',
        ))
    return {'ultimas24h': summary, 'alertas': alerts}
