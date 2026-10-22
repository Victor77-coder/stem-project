from decimal import Decimal

from rest_framework import serializers

from accounts.models import Channel

from .models import Profile
from .validators import LooseDecimalField, clean_cep, clean_phone, clean_uf


class ParticipantInputSerializer(serializers.Serializer):
    """Campos com os mesmos nomes do rascunho de cadastro do app (RegistrationDraft)."""

    profile = serializers.ChoiceField(Profile.choices, required=False)
    name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    password = serializers.CharField(required=False, allow_blank=True, write_only=True, trim_whitespace=False)
    cpf = serializers.CharField(max_length=14, required=False, allow_blank=True)
    weight = LooseDecimalField(min_value=Decimal(20), max_value=Decimal(350), places=2, label='o peso', required=False, allow_null=True)
    height = LooseDecimalField(min_value=Decimal('0.5'), max_value=Decimal('2.5'), places=2, label='a altura', required=False, allow_null=True)
    sex = serializers.CharField(required=False, allow_blank=True)
    comorbidities = serializers.ListField(child=serializers.CharField(max_length=60), required=False, max_length=10)
    cep = serializers.CharField(max_length=9, required=False, allow_blank=True)
    address = serializers.CharField(max_length=200, required=False, allow_blank=True)
    number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    district = serializers.CharField(max_length=100, required=False, allow_blank=True)
    city = serializers.CharField(max_length=100, required=False, allow_blank=True)
    uf = serializers.CharField(max_length=2, required=False, allow_blank=True)
    complement = serializers.CharField(max_length=100, required=False, allow_blank=True)
    allowLocation = serializers.BooleanField(required=False)
    tcleAccepted = serializers.BooleanField(required=False)
    tcleVersion = serializers.CharField(max_length=10, required=False, allow_blank=True)
    channel = serializers.ChoiceField(Channel.choices, required=False)

    def validate_cep(self, value):
        return clean_cep(value)

    def validate_phone(self, value):
        return clean_phone(value)

    def validate_uf(self, value):
        return clean_uf(value)

    def validate_sex(self, value):
        if value and value not in ('feminino', 'masculino', 'outro'):
            raise serializers.ValidationError('Sexo biológico inválido.')
        return value


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=150)
    password = serializers.CharField(trim_whitespace=False)
    channel = serializers.ChoiceField(Channel.choices, required=False, default=Channel.WEB)


class PasswordConfirmSerializer(serializers.Serializer):
    password = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)
