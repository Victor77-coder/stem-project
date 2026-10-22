from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from participants.models import ChangeEvent
from participants.views import find_participants

from .models import AccessRequest, Channel, PasswordResetCode, Role, Status, User
from .permissions import IsTeamMember, TeamReadAdminWrite
from .serializers import (
    EmailSerializer,
    ForgotSerializer,
    PasswordChangeSerializer,
    ResetSerializer,
    SenhaSerializer,
    StaffAccountSerializer,
    StaffLoginSerializer,
    StatusSerializer,
    staff_payload,
)
from .services import issue_tokens, notify_admins, record_login, revoke_sessions, set_status, temporary_password
from .throttling import scoped

GENERIC_RESET = 'Se houver uma conta com esse contato, enviaremos um código de 6 dígitos.'
INVALID_CODE = 'Código inválido ou expirado.'


def _password_errors(password: str, user: User | None) -> None:
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        raise ValidationError({'password': list(exc.messages)})


def _log_password_change(user: User) -> None:
    if user.is_participant and hasattr(user, 'participant'):
        ChangeEvent.objects.create(participant=user.participant, icon='shield', title='Senha alterada', actor=user)


@api_view(['POST'])
@permission_classes([AllowAny])
def logout(request):
    try:
        RefreshToken(request.data.get('refresh', '')).blacklist()
    except TokenError:
        pass
    return Response(status=status.HTTP_204_NO_CONTENT)


@scoped('password')
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    serializer = PasswordChangeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = request.user
    if not user.check_password(serializer.validated_data['current']):
        raise ValidationError({'current': ['Senha atual incorreta.']})
    _password_errors(serializer.validated_data['new'], user)
    user.set_password(serializer.validated_data['new'])
    user.save(update_fields=['password'])
    revoke_sessions(user)
    _log_password_change(user)
    return Response(issue_tokens(user))


@scoped('password')
@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password(request):
    serializer = ForgotSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    for user in find_participants(serializer.validated_data['identifier']):
        if user.is_active and user.email:
            code = PasswordResetCode.issue(user)
            send_mail(
                'Código para redefinir sua senha · STEM Project',
                f'Seu código é {code}. Ele vale por {settings.PASSWORD_RESET_CODE_MINUTES} minutos.\n'
                'Se você não pediu, ignore este e-mail. O STEM nunca pede a senha do Gov.br.',
                settings.DEFAULT_FROM_EMAIL,
                [user.email],
                fail_silently=True,
            )
    return Response({'detail': GENERIC_RESET}, status=status.HTTP_202_ACCEPTED)


def _code_entry(data: dict) -> tuple[User, PasswordResetCode]:
    for user in find_participants(data['identifier']):
        entry = PasswordResetCode.verify(user, data['code']) if user.is_active else None
        if entry:
            return user, entry
    raise ValidationError({'code': [INVALID_CODE]})


@scoped('password')
@api_view(['POST'])
@permission_classes([AllowAny])
def verify_code(request):
    serializer = ResetSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    _code_entry(serializer.validated_data)
    return Response({'valid': True})


@scoped('password')
@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    serializer = ResetSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user, entry = _code_entry(serializer.validated_data)
    password = serializer.validated_data.get('password') or ''
    _password_errors(password, user)
    user.set_password(password)
    user.save(update_fields=['password'])
    entry.used_at = timezone.now()
    entry.save(update_fields=['used_at'])
    revoke_sessions(user)
    _log_password_change(user)
    return Response({'detail': 'Senha redefinida.'})


@scoped('login')
@api_view(['POST'])
@permission_classes([AllowAny])
def staff_login(request):
    serializer = StaffLoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    user = User.objects.filter(role=Role.STAFF, email__iexact=data['email'].strip()).select_related('staff').first()
    if not user or not user.is_active or not hasattr(user, 'staff') or not user.check_password(data['senha']):
        raise ValidationError({'detail': 'E-mail ou senha inválidos.'})
    record_login(user, Channel.WEB)
    return Response({**issue_tokens(user), 'conta': staff_payload(user)})


@scoped('request')
@api_view(['POST'])
@permission_classes([AllowAny])
def staff_forgot(request):
    serializer = EmailSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data['email'].lower()
    if User.objects.filter(role=Role.STAFF, email=email, status=Status.ATIVO).exists():
        notify_admins(
            'Pedido de redefinição de senha no painel',
            f'{email} pediu para redefinir a senha do painel. Use "Resetar Senha" no perfil da conta.',
        )
    return Response({'detail': 'Se o e-mail estiver cadastrado, você receberá as instruções para redefinir sua senha.'})


@scoped('request')
@api_view(['POST'])
@permission_classes([AllowAny])
def access_request(request):
    serializer = EmailSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    entry = AccessRequest.objects.create(email=serializer.validated_data['email'].lower())
    notify_admins('Pedido de acesso ao painel', f'{entry.email} pediu acesso ao painel do STEM Project.')
    return Response({'detail': 'Sua solicitação foi enviada ao administrador.'}, status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH'])
@permission_classes([IsTeamMember])
def staff_me(request):
    user = request.user
    if request.method == 'PATCH':
        data = {key: request.data[key] for key in ('nome', 'email') if key in request.data}
        serializer = StaffAccountSerializer(instance=user, data=data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save_to(user)
    return Response(staff_payload(user))


def _confirm(request) -> None:
    serializer = SenhaSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    if not request.user.check_password(serializer.validated_data.get('senha') or ''):
        raise ValidationError({'senha': ['Senha incorreta. Tente novamente.']})


class StaffAccountViewSet(viewsets.ViewSet):
    """Contas da equipe do painel. Participantes do app nunca aparecem aqui (RF012, RS004)."""

    permission_classes = [TeamReadAdminWrite]

    def _queryset(self):
        return User.objects.filter(role=Role.STAFF, staff__isnull=False).select_related('staff')

    def _get(self, pk) -> User:
        return get_object_or_404(self._queryset().exclude(status=Status.CANCELADO), pk=pk)

    def list(self, request):
        accounts = self._queryset().exclude(status=Status.CANCELADO)
        if request.query_params.get('status') in Status.values:
            accounts = accounts.filter(status=request.query_params['status'])
        if q := request.query_params.get('q', '').strip():
            accounts = accounts.filter(Q(name__icontains=q) | Q(email__icontains=q))
        return Response([staff_payload(user) for user in accounts.order_by('name')])

    def retrieve(self, request, pk=None):
        return Response(staff_payload(self._get(pk)))

    def create(self, request):
        serializer = StaffAccountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        password = temporary_password()
        user = User(role=Role.STAFF)
        user.set_password(password)
        serializer.save_to(user)
        return Response({**staff_payload(user), 'senhaTemporaria': password}, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        user = self._get(pk)
        serializer = StaffAccountSerializer(instance=user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if user == request.user and serializer.validated_data.get('nivel', user.staff.nivel) != user.staff.nivel:
            raise PermissionDenied('Você não pode alterar o próprio nível de acesso.')
        serializer.save_to(user)
        return Response(staff_payload(user))

    update = partial_update

    @action(detail=True, methods=['post'])
    def status(self, request, pk=None):
        user = self._get(pk)
        serializer = StatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target = serializer.validated_data['status']
        if user == request.user:
            raise PermissionDenied('Você não pode alterar o status da própria conta.')
        if target != Status.ATIVO:
            _confirm(request)
        set_status(user, target, actor=request.user)
        return Response(staff_payload(user))

    @action(detail=True, methods=['post'], url_path='reset-password')
    def reset_password(self, request, pk=None):
        user = self._get(pk)
        password = temporary_password()
        user.set_password(password)
        user.save(update_fields=['password'])
        revoke_sessions(user)
        return Response({'senhaTemporaria': password})
