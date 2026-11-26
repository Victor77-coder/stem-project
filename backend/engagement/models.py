from django.conf import settings
from django.db import models
from django.db.models import Q

from catalog.models import Center, Content, JourneyStep, PublishStatus, published_needs
from participants.models import Participant


class Notification(models.Model):
    """Campanha, evento ou comunicado oficial (RF009). O tipo 4, doador localizado, não existe no MVP."""

    class Kind(models.TextChoices):
        CAMPANHA = 'campanha', 'Campanha de doação'
        EVENTO = 'evento', 'Evento de saúde'
        COMUNICADO = 'comunicado', 'Comunicado oficial'

    tipo = models.CharField(max_length=12, choices=Kind.choices)
    titulo = models.CharField(max_length=120)
    mensagem = models.CharField(max_length=500)
    origem = models.CharField(max_length=120, blank=True)
    uf = models.CharField(max_length=2, blank=True, help_text='Vazio: todo o país')
    cidade = models.CharField(max_length=100, blank=True)
    data_disparo = models.DateTimeField()
    status = models.CharField(max_length=10, choices=PublishStatus.choices, default=PublishStatus.RASCUNHO)
    centro = models.ForeignKey(Center, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    conteudo = models.ForeignKey(Content, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    atualizado_em = models.DateTimeField(auto_now=True)
    # Quando o envio por push e e-mail começou. A caixa de entrada não depende disso.
    disparado_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-data_disparo']
        constraints = [published_needs(~Q(origem=''), 'aviso_publicado_tem_origem')]

    def __str__(self):
        return self.titulo


class NotificationReceipt(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='receipts')
    notification = models.ForeignKey(Notification, on_delete=models.CASCADE, related_name='receipts')
    read_at = models.DateTimeField(null=True, blank=True)
    hidden_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['user', 'notification'], name='uniq_recibo')]


class Preferences(models.Model):
    """Opt-in estrito (RF10): tudo nasce desligado e só o titular liga."""

    participant = models.OneToOneField(Participant, on_delete=models.CASCADE, related_name='preferences')
    push = models.BooleanField(default=False)
    email = models.BooleanField(default=False)
    campaigns = models.BooleanField(default=False)
    events = models.BooleanField(default=False)
    official = models.BooleanField(default=False)

    KIND_FIELD = {
        Notification.Kind.CAMPANHA: 'campaigns',
        Notification.Kind.EVENTO: 'events',
        Notification.Kind.COMUNICADO: 'official',
    }


class PushToken(models.Model):
    """Token do Expo de um aparelho. Sai no logout ou quando a Expo responde DeviceNotRegistered."""

    class Platform(models.TextChoices):
        ANDROID = 'android', 'Android'
        IOS = 'ios', 'iOS'

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='push_tokens')
    token = models.CharField(max_length=200, unique=True)
    platform = models.CharField(max_length=10, choices=Platform.choices)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)


class NotificationDelivery(models.Model):
    """Um envio por canal e pessoa. A restrição única impede mandar o mesmo aviso duas vezes."""

    class Channel(models.TextChoices):
        PUSH = 'push', 'Push'
        EMAIL = 'email', 'E-mail'

    class Status(models.TextChoices):
        PENDENTE = 'pendente', 'Pendente'
        ENVIADO = 'enviado', 'Enviado'
        FALHOU = 'falhou', 'Falhou'
        IGNORADO = 'ignorado', 'Ignorado'

    notification = models.ForeignKey(Notification, on_delete=models.CASCADE, related_name='deliveries')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    channel = models.CharField(max_length=5, choices=Channel.choices)
    status = models.CharField(max_length=8, choices=Status.choices, default=Status.PENDENTE)
    sent_at = models.DateTimeField(null=True, blank=True)
    error = models.CharField(max_length=500, blank=True)
    # Código curto do erro, para o painel agrupar: InvalidCredentials, DeviceNotRegistered, BadDeviceToken, SMTP…
    error_code = models.CharField(max_length=40, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    # Quantas vezes o envio foi tentado. Falha volta para a fila até NOTIFY_MAX_ATTEMPTS.
    attempts = models.PositiveSmallIntegerField(default=0)
    # Push: um ticket da Expo por aparelho ({"id", "token"}). O recibo de cada um diz se a Apple ou o Google aceitaram.
    tickets = models.JSONField(default=list, blank=True)
    # Quando os recibos foram lidos. Vazio com tickets = ainda aguardando o recibo.
    receipts_checked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['notification', 'user', 'channel'], name='uniq_envio')]


class JourneyProgress(models.Model):
    """Guia pessoal (RF05/RF06): o próprio titular marca as etapas que já fez. Não é status oficial do SUS."""

    class Region(models.TextChoices):
        MACEIO = 'maceio'
        RECIFE = 'recife'
        OUTRA = 'outra'

    # Etapas embarcadas no app (mobile/src/content/journey.ts). Valem só enquanto o painel não tiver etapas cadastradas.
    STEPS = {
        'doador': ('cadastro', 'coleta', 'redome', 'contato', 'doacao', 'pos-doacao'),
        'receptor': ('indicacao', 'encaminhamento', 'busca', 'preparacao', 'transplante', 'pos-tcth'),
    }

    participant = models.OneToOneField(Participant, on_delete=models.CASCADE, related_name='journey')
    # Ids das etapas que o titular marcou como feitas, em qualquer ordem e desmarcáveis.
    done = models.JSONField(default=list, blank=True)
    # Itens marcados no checklist de cada etapa: {"cadastro": ["Documento oficial com foto"]}.
    checklist = models.JSONField(default=dict, blank=True)
    region = models.CharField(max_length=10, choices=Region.choices, default=Region.MACEIO)
    updated_at = models.DateTimeField(auto_now=True)

    @classmethod
    def step_ids(cls, kind: str) -> list[str]:
        """Ids que as marcas aceitam, na ordem do painel. Inclui rascunhos e inativas: uma etapa despublicada
        não pode invalidar as marcas que o titular já tinha."""
        ids = list(JourneyStep.objects.filter(jornada=kind).order_by('ordem').values_list('slug', flat=True))
        return ids or list(cls.STEPS[kind])

    def clear(self) -> None:
        self.done = []
        self.checklist = {}


class SavedContent(models.Model):
    participant = models.ForeignKey(Participant, on_delete=models.CASCADE, related_name='saved')
    content = models.ForeignKey(Content, on_delete=models.CASCADE, related_name='+')
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['participant', 'content'], name='uniq_salvo')]
