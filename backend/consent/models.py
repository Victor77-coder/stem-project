from django.conf import settings
from django.db import models
from django.db.models import Q

from accounts.models import Channel


class ConsentDocument(models.Model):
    class Kind(models.TextChoices):
        TCLE = 'tcle', 'TCLE (doador e receptor)'
        TERMOS = 'termos', 'Termos de uso (público leigo)'

    kind = models.CharField(max_length=10, choices=Kind.choices)
    version = models.CharField(max_length=10)
    title = models.CharField(max_length=200)
    sections = models.JSONField(default=list, help_text='[{"title": "...", "body": "..."}]')
    published_at = models.DateField()
    is_current = models.BooleanField(default=False)

    class Meta:
        ordering = ['kind', '-published_at']
        constraints = [
            models.UniqueConstraint(fields=['kind', 'version'], name='uniq_versao_documento'),
            models.UniqueConstraint(fields=['kind'], condition=Q(is_current=True), name='uma_versao_vigente'),
        ]

    def __str__(self):
        return f'{self.get_kind_display()} v{self.version}'

    @classmethod
    def current(cls, kind: str) -> 'ConsentDocument | None':
        return cls.objects.filter(kind=kind, is_current=True).first()


class ConsentAcceptance(models.Model):
    """Aceite com versão, data/hora e canal (RF001 nota 5, RS001). Nunca é apagado."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='consents')
    document = models.ForeignKey(ConsentDocument, on_delete=models.PROTECT, related_name='acceptances')
    channel = models.CharField(max_length=10, choices=Channel.choices)
    accepted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-accepted_at']
