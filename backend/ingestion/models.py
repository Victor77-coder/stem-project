from django.conf import settings
from django.db import models


class CollectionRun(models.Model):
    """Uma carga de fonte pública: quem pediu, o que veio, o que mudou e os arquivos brutos usados."""

    class Status(models.TextChoices):
        ENFILEIRADA = 'enfileirada', 'Enfileirada'
        EXECUTANDO = 'executando', 'Executando'
        SUCESSO = 'sucesso', 'Sucesso'
        ERRO = 'erro', 'Erro'

    source = models.CharField(max_length=30)
    competencia = models.CharField(max_length=4, blank=True, help_text='AAMM da fonte, ex.: 2609')
    filters = models.JSONField(default=dict, blank=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.EXECUTANDO)
    flow_run_id = models.CharField(max_length=64, blank=True)
    requested_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    stats = models.JSONField(default=dict, blank=True)
    raw_files = models.JSONField(default=list, blank=True)
    warnings = models.JSONField(default=list, blank=True)
    error = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.source} {self.competencia or "-"} · {self.status}'
