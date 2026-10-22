from django.conf import settings
from django.db import models
from django.db.models import Q

from catalog.models import Center, Content, PublishStatus, published_needs
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
    participant = models.OneToOneField(Participant, on_delete=models.CASCADE, related_name='preferences')
    push = models.BooleanField(default=True)
    email = models.BooleanField(default=True)
    campaigns = models.BooleanField(default=True)
    events = models.BooleanField(default=True)
    official = models.BooleanField(default=True)

    KIND_FIELD = {
        Notification.Kind.CAMPANHA: 'campaigns',
        Notification.Kind.EVENTO: 'events',
        Notification.Kind.COMUNICADO: 'official',
    }


class JourneyProgress(models.Model):
    class Region(models.TextChoices):
        MACEIO = 'maceio'
        RECIFE = 'recife'
        OUTRA = 'outra'

    participant = models.OneToOneField(Participant, on_delete=models.CASCADE, related_name='journey')
    current = models.PositiveSmallIntegerField(default=1)
    region = models.CharField(max_length=10, choices=Region.choices, default=Region.MACEIO)
    updated_at = models.DateTimeField(auto_now=True)


class SavedContent(models.Model):
    participant = models.ForeignKey(Participant, on_delete=models.CASCADE, related_name='saved')
    content = models.ForeignKey(Content, on_delete=models.CASCADE, related_name='+')
    saved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['participant', 'content'], name='uniq_salvo')]
