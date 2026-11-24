from django.conf import settings
from django.core import signing
from django.core.mail import send_mail
from django.db.models import Q, QuerySet

from accounts.models import PasswordResetCode, Status, User
from participants.models import Participant

from .models import Preferences

UNSUBSCRIBE_SALT = 'engagement.avisos.sair'


# A caixa de entrada e o envio usam a mesma regra de região, vista de lados opostos.
def notices_for(participant: Participant) -> Q:
    """Avisos que alcançam a pessoa: nacional, do estado dela ou da cidade dela."""
    return Q(uf='') | Q(uf=participant.uf, cidade='') | Q(uf=participant.uf, cidade__iexact=participant.city)


def audience(tipo: str, uf: str, cidade: str) -> QuerySet[Participant]:
    """Pessoas ativas na região do aviso que ligaram o assunto dele."""
    people = Participant.objects.filter(user__status=Status.ATIVO, **{f'preferences__{Preferences.KIND_FIELD[tipo]}': True})
    if uf:
        people = people.filter(uf=uf)
        if cidade:
            people = people.filter(city__iexact=cidade)
    return people


def push_ready() -> Q:
    return Q(preferences__push=True, user__push_tokens__isnull=False)


def email_ready() -> Q:
    return Q(preferences__email=True, user__email__isnull=False, user__email_confirmado_em__isnull=False)


def reach(tipo: str, uf: str, cidade: str) -> dict:
    """Só contagens: o painel nunca vê quem recebe (RF012)."""
    people = audience(tipo, uf, cidade)
    return {
        'caixaDeEntrada': people.count(),
        'push': people.filter(push_ready()).distinct().count(),
        'email': people.filter(email_ready()).count(),
    }


def send_email_code(user: User) -> None:
    code = PasswordResetCode.issue(user, PasswordResetCode.Purpose.EMAIL)
    send_mail(
        'Confirme seu e-mail para receber avisos · STEM Project',
        f'Seu código é {code}. Ele vale por {settings.PASSWORD_RESET_CODE_MINUTES} minutos.\n'
        'Digite o código no aplicativo para ativar os avisos por e-mail. Se você não pediu, ignore este e-mail.',
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=True,
    )


def email_changed(user: User) -> None:
    """Endereço novo precisa de nova confirmação antes de receber avisos."""
    user.email_confirmado_em = None
    PasswordResetCode.discard(user, PasswordResetCode.Purpose.EMAIL)
    Preferences.objects.filter(participant__user=user).update(email=False)


def unsubscribe_url(user: User) -> str:
    token = signing.dumps(user.pk, salt=UNSUBSCRIBE_SALT)
    return f'{settings.PUBLIC_API_URL}/api/v1/avisos/sair/{token}/'


def unsubscribe_user(token: str) -> User | None:
    try:
        pk = signing.loads(token, salt=UNSUBSCRIBE_SALT)
    except signing.BadSignature:
        return None
    return User.objects.filter(pk=pk).first()
