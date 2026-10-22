import json

from django.conf import settings
from django.core.mail import EmailMessage
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.models import Role, User, digits
from accounts.permissions import IsParticipant
from accounts.services import issue_tokens, record_login
from accounts.throttling import scoped

from . import services
from .serializers import LoginSerializer, ParticipantInputSerializer, PasswordConfirmSerializer

INVALID_LOGIN = 'E-mail, telefone/CPF ou senha inválidos.'


def find_participants(identifier: str):
    identifier = identifier.strip()
    users = User.objects.filter(role=Role.PARTICIPANT)
    if '@' in identifier:
        return users.filter(email__iexact=identifier)
    number = digits(identifier)
    return users.filter(Q(phone=number) | Q(cpf=number)) if number else users.none()


def session_response(user: User, code=status.HTTP_200_OK) -> Response:
    return Response({**issue_tokens(user), 'me': services.payload(user.participant)}, status=code)


@scoped('register')
@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    serializer = ParticipantInputSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = services.register(serializer.validated_data)
    return session_response(user, status.HTTP_201_CREATED)


@scoped('login')
@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    user = next(
        (candidate for candidate in find_participants(data['identifier']) if candidate.check_password(data['password'])),
        None,
    )
    if user is None or not user.is_active:
        raise ValidationError({'detail': INVALID_LOGIN})
    record_login(user, data['channel'])
    return session_response(user)


@api_view(['GET', 'PATCH'])
@permission_classes([IsParticipant])
def me(request):
    participant = request.user.participant
    if request.method == 'PATCH':
        serializer = ParticipantInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        services.update(participant, serializer.validated_data, request.user)
        participant.refresh_from_db()
    return Response(services.payload(participant))


@api_view(['POST'])
@permission_classes([IsParticipant])
def change_profile(request):
    serializer = ParticipantInputSerializer(data=request.data, partial=True)
    serializer.is_valid(raise_exception=True)
    participant = request.user.participant
    services.change_profile(participant, serializer.validated_data)
    participant.refresh_from_db()
    return Response(services.payload(participant))


@api_view(['GET'])
@permission_classes([IsParticipant])
def history(request):
    events = request.user.participant.history.all()[:200]
    return Response(
        [
            {'id': event.pk, 'icon': event.icon, 'title': event.title, 'detail': event.detail, 'when': event.created_at.isoformat()}
            for event in events
        ]
    )


@api_view(['POST'])
@permission_classes([IsParticipant])
def export(request):
    user = request.user
    if not user.email:
        raise ValidationError({'detail': 'Cadastre um e-mail para receber a cópia dos seus dados.'})
    message = EmailMessage(
        'Seus dados no STEM Project',
        'Segue em anexo a cópia dos dados que o STEM Project guarda sobre você.',
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
    )
    body = json.dumps(services.export(user.participant), ensure_ascii=False, indent=2)
    message.attach('meus-dados-stem.json', body, 'application/json')
    message.send(fail_silently=False)
    return Response({'detail': 'Enviamos a cópia dos seus dados para o e-mail cadastrado.'}, status=status.HTTP_202_ACCEPTED)


@api_view(['POST'])
@permission_classes([IsParticipant])
def deactivate(request):
    serializer = PasswordConfirmSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = request.user
    if user.has_usable_password() and not user.check_password(serializer.validated_data.get('password', '')):
        raise ValidationError({'password': ['Senha incorreta.']})
    services.anonymize(user.participant)
    return Response(status=status.HTTP_204_NO_CONTENT)
