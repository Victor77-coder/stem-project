import secrets

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Channel, LoginEvent, Role, StaffProfile, Status, StatusChange, User


def issue_tokens(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {'access': str(refresh.access_token), 'refresh': str(refresh)}


def record_login(user: User, channel: str) -> None:
    channel = channel if channel in Channel.values else Channel.WEB
    user.last_login = timezone.now()
    user.last_login_channel = channel
    user.save(update_fields=['last_login', 'last_login_channel'])
    LoginEvent.objects.create(user=user, channel=channel)


def revoke_sessions(user: User) -> None:
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


def set_status(user: User, status: str, actor: User | None) -> None:
    if user.status == status:
        return
    StatusChange.objects.create(user=user, from_status=user.status, to_status=status, actor=actor)
    user.status = status
    user.save(update_fields=['status'])
    if status != Status.ATIVO:
        revoke_sessions(user)


def temporary_password() -> str:
    # Maiúscula e número garantidos, para passar nas regras do app e do painel.
    return f'Stem{secrets.randbelow(10**4):04d}{secrets.token_urlsafe(6)}'


def notify_admins(subject: str, body: str) -> None:
    emails = list(
        User.objects.filter(role=Role.STAFF, status=Status.ATIVO, staff__nivel=StaffProfile.Level.ADMIN, email__isnull=False)
        .values_list('email', flat=True)
    )
    if emails:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, emails, fail_silently=True)
