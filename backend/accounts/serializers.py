from rest_framework import serializers

from participants.validators import clean_uf

from .models import Role, StaffProfile, User

PROFILE_FIELDS = {
    'tipoConta': 'tipo_conta',
    'avatar': 'avatar',
    'documento1': 'documento1',
    'documento2': 'documento2',
    'genero': 'genero',
    'cep': 'cep',
    'logradouro': 'logradouro',
    'numero': 'numero',
    'pais': 'pais',
    'estado': 'estado',
    'cidade': 'cidade',
    'bairro': 'bairro',
    'complemento': 'complemento',
    'referencia': 'referencia',
}


def staff_payload(user: User) -> dict:
    profile = user.staff
    return {
        'id': str(user.pk),
        'nome': user.name,
        'email': user.email or '',
        'status': user.status,
        'nivel': profile.nivel,
        'podeValidar': profile.can_validate,
        **{key: getattr(profile, attr) for key, attr in PROFILE_FIELDS.items()},
        'criadoEm': user.created_at.date().isoformat(),
        'ultimoLogin': user.last_login.date().isoformat() if user.last_login else '',
    }


class StaffAccountSerializer(serializers.Serializer):
    """Mesmo formato do tipo Account do painel, sem senha."""

    nome = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    nivel = serializers.ChoiceField(StaffProfile.Level.choices, required=False)
    tipoConta = serializers.ChoiceField(StaffProfile.Kind.choices, required=False, allow_blank=True)
    avatar = serializers.URLField(required=False, allow_blank=True)
    documento1 = serializers.CharField(max_length=30, required=False, allow_blank=True)
    documento2 = serializers.CharField(max_length=30, required=False, allow_blank=True)
    genero = serializers.CharField(max_length=30, required=False, allow_blank=True)
    cep = serializers.CharField(max_length=9, required=False, allow_blank=True)
    logradouro = serializers.CharField(max_length=200, required=False, allow_blank=True)
    numero = serializers.CharField(max_length=20, required=False, allow_blank=True)
    pais = serializers.CharField(max_length=60, required=False, allow_blank=True)
    estado = serializers.CharField(max_length=2, required=False, allow_blank=True)
    cidade = serializers.CharField(max_length=100, required=False, allow_blank=True)
    bairro = serializers.CharField(max_length=100, required=False, allow_blank=True)
    complemento = serializers.CharField(max_length=100, required=False, allow_blank=True)
    referencia = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate_estado(self, value):
        return clean_uf(value)

    def validate_email(self, value):
        value = value.strip().lower()
        others = User.objects.filter(role=Role.STAFF, email=value)
        if self.instance is not None:
            others = others.exclude(pk=self.instance.pk)
        if others.exists():
            raise serializers.ValidationError('Já existe uma conta da equipe com este e-mail.')
        return value

    def save_to(self, user: User) -> User:
        data = self.validated_data
        if 'nome' in data:
            user.name = data['nome'].strip()
        if 'email' in data:
            user.email = data['email']
        user.role = Role.STAFF
        user.save()
        profile, _ = StaffProfile.objects.get_or_create(user=user)
        if 'nivel' in data:
            profile.nivel = data['nivel']
        for key, attr in PROFILE_FIELDS.items():
            if key in data:
                setattr(profile, attr, data[key])
        profile.save()
        return user


class StaffLoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    senha = serializers.CharField(trim_whitespace=False)


class StatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(['ativo', 'inativo', 'bloqueado', 'cancelado'])
    senha = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)


class SenhaSerializer(serializers.Serializer):
    senha = serializers.CharField(required=False, allow_blank=True, trim_whitespace=False)


class PasswordChangeSerializer(serializers.Serializer):
    current = serializers.CharField(trim_whitespace=False)
    new = serializers.CharField(trim_whitespace=False)


class ForgotSerializer(serializers.Serializer):
    identifier = serializers.CharField(max_length=150)


class ResetSerializer(ForgotSerializer):
    code = serializers.CharField(max_length=6, min_length=6)
    password = serializers.CharField(required=False, trim_whitespace=False)


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
