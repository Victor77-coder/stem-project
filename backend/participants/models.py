from django.conf import settings
from django.db import models


class Profile(models.TextChoices):
    DOADOR = 'doador', 'Doador'
    RECEPTOR = 'receptor', 'Receptor'
    LEIGO = 'leigo', 'Público leigo'


CLINICAL_PROFILES = {Profile.DOADOR, Profile.RECEPTOR}

COMORBIDITIES = ['Nenhuma', 'Hipertensão', 'Diabetes', 'Cardiopatia', 'Doença autoimune', 'Outra']


class Sex(models.TextChoices):
    FEMININO = 'feminino', 'Feminino'
    MASCULINO = 'masculino', 'Masculino'
    OUTRO = 'outro', 'Outro'


class Participant(models.Model):
    """Dados do titular. Peso, altura, sexo e comorbidades servem só à orientação educacional."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='participant')
    profile = models.CharField(max_length=10, choices=Profile.choices)
    weight = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    height = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    sex = models.CharField(max_length=10, choices=Sex.choices, blank=True)
    comorbidities = models.JSONField(default=list, blank=True)
    cep = models.CharField(max_length=8, blank=True)
    address = models.CharField(max_length=200, blank=True)
    number = models.CharField(max_length=20, blank=True)
    district = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    uf = models.CharField(max_length=2, blank=True)
    complement = models.CharField(max_length=100, blank=True)
    allow_location = models.BooleanField(default=False)
    anonymized_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Participante #{self.pk}'

    @property
    def is_clinical(self):
        return self.profile in CLINICAL_PROFILES


class ChangeEvent(models.Model):
    """Histórico de alterações do titular (RNF10): quem, o quê, quando. Só o próprio titular lê."""

    class Icon(models.TextChoices):
        PULSE = 'pulse'
        SHIELD = 'shield'
        PERSON = 'person'

    participant = models.ForeignKey(Participant, on_delete=models.CASCADE, related_name='history')
    icon = models.CharField(max_length=10, choices=Icon.choices)
    title = models.CharField(max_length=80)
    detail = models.CharField(max_length=200, blank=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']
