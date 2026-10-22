import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.db.models import Q
from django.utils import timezone


class Role(models.TextChoices):
    PARTICIPANT = 'participant', 'Participante'
    STAFF = 'staff', 'Equipe'


class Status(models.TextChoices):
    ATIVO = 'ativo', 'Ativo'
    INATIVO = 'inativo', 'Inativo'
    BLOQUEADO = 'bloqueado', 'Suspenso'
    CANCELADO = 'cancelado', 'Cancelado'


class Channel(models.TextChoices):
    ANDROID = 'android', 'Android'
    IOS = 'ios', 'iOS'
    WEB = 'web', 'Web'


def digits(value: str | None) -> str:
    return ''.join(ch for ch in (value or '') if ch.isdigit())


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email=None, password=None, **extra):
        user = self.model(email=self.normalize_email(email) if email else None, **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password, **extra):
        extra.update(role=Role.STAFF, is_superuser=True)
        user = self.create_user(email, password, **extra)
        StaffProfile.objects.get_or_create(user=user, defaults={'nivel': StaffProfile.Level.ADMIN})
        return user

    def get_by_natural_key(self, email):
        return self.get(email__iexact=email, role=Role.STAFF)


class User(AbstractBaseUser, PermissionsMixin):
    """Conta de login. Participantes do app e equipe do painel nunca compartilham endpoints."""

    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=11, null=True, blank=True)
    cpf = models.CharField(max_length=11, null=True, blank=True)
    name = models.CharField(max_length=150, blank=True)
    role = models.CharField(max_length=12, choices=Role.choices, default=Role.PARTICIPANT)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ATIVO)
    created_at = models.DateTimeField(default=timezone.now)
    last_login_channel = models.CharField(max_length=10, choices=Channel.choices, blank=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    EMAIL_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['role', 'email'], condition=Q(email__isnull=False), name='uniq_email_por_papel'),
            models.UniqueConstraint(fields=['role', 'phone'], condition=Q(phone__isnull=False), name='uniq_telefone_por_papel'),
            models.UniqueConstraint(fields=['role', 'cpf'], condition=Q(cpf__isnull=False), name='uniq_cpf_por_papel'),
        ]

    def __str__(self):
        return f'{self.get_role_display()} #{self.pk}'

    @property
    def is_active(self):
        return self.status == Status.ATIVO

    @property
    def is_staff(self):
        return self.role == Role.STAFF and self.is_superuser

    @property
    def is_participant(self):
        return self.role == Role.PARTICIPANT

    @property
    def is_team(self):
        return self.role == Role.STAFF

    def save(self, *args, **kwargs):
        self.email = self.email.strip().lower() if self.email and self.email.strip() else None
        self.phone = digits(self.phone) or None
        self.cpf = digits(self.cpf) or None
        super().save(*args, **kwargs)


class StatusChange(models.Model):
    """Histórico do módulo de status (RF001 nota 7). Não há exclusão física de conta."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='status_changes')
    from_status = models.CharField(max_length=10, choices=Status.choices)
    to_status = models.CharField(max_length=10, choices=Status.choices)
    actor = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class LoginEvent(models.Model):
    """Auditoria mínima de login (RF003): data/hora e canal."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='logins')
    channel = models.CharField(max_length=10, choices=Channel.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


class StaffProfile(models.Model):
    class Level(models.TextChoices):
        ADMIN = 'Admin', 'Administrador'
        USER = 'User', 'Usuário'

    class Kind(models.TextChoices):
        CONTENT_ADMIN = 'Administrador de conteúdo'
        EDITOR = 'Editor'
        CLINICAL = 'Validador clínico'

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='staff')
    nivel = models.CharField(max_length=5, choices=Level.choices, default=Level.USER)
    tipo_conta = models.CharField(max_length=30, choices=Kind.choices, blank=True)
    avatar = models.URLField(blank=True)
    documento1 = models.CharField(max_length=30, blank=True)
    documento2 = models.CharField(max_length=30, blank=True)
    genero = models.CharField(max_length=30, blank=True)
    cep = models.CharField(max_length=9, blank=True)
    logradouro = models.CharField(max_length=200, blank=True)
    numero = models.CharField(max_length=20, blank=True)
    pais = models.CharField(max_length=60, default='Brasil')
    estado = models.CharField(max_length=2, blank=True)
    cidade = models.CharField(max_length=100, blank=True)
    bairro = models.CharField(max_length=100, blank=True)
    complemento = models.CharField(max_length=100, blank=True)
    referencia = models.CharField(max_length=150, blank=True)

    @property
    def is_admin(self):
        return self.nivel == self.Level.ADMIN

    @property
    def can_validate(self):
        return self.is_admin or self.tipo_conta == self.Kind.CLINICAL


class AccessRequest(models.Model):
    """Pedido de acesso ao painel feito na tela de login."""

    email = models.EmailField()
    created_at = models.DateTimeField(auto_now_add=True)


def _hash_code(code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), code.encode(), hashlib.sha256).hexdigest()


class PasswordResetCode(models.Model):
    """Código de 6 dígitos da recuperação de senha do app. Só o hash é gravado."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reset_codes')
    code_hash = models.CharField(max_length=64)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    @classmethod
    def issue(cls, user: User) -> str:
        cls.objects.filter(user=user, used_at__isnull=True).update(used_at=timezone.now())
        code = f'{secrets.randbelow(10**6):06d}'
        cls.objects.create(
            user=user,
            code_hash=_hash_code(code),
            expires_at=timezone.now() + timedelta(minutes=settings.PASSWORD_RESET_CODE_MINUTES),
        )
        return code

    @classmethod
    def verify(cls, user: User, code: str) -> 'PasswordResetCode | None':
        entry = cls.objects.filter(user=user, used_at__isnull=True, expires_at__gt=timezone.now()).first()
        if not entry or entry.attempts >= settings.PASSWORD_RESET_MAX_ATTEMPTS:
            return None
        if not hmac.compare_digest(entry.code_hash, _hash_code(digits(code))):
            entry.attempts += 1
            entry.save(update_fields=['attempts'])
            return None
        return entry
