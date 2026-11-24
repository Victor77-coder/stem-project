import re
from datetime import timedelta

from django.shortcuts import get_object_or_404, render
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.models import PasswordResetCode
from accounts.permissions import IsParticipant
from accounts.throttling import scoped
from catalog.models import Content, PublishStatus
from catalog.public import content_lookup
from participants.models import ChangeEvent

from .models import JourneyProgress, Notification, NotificationReceipt, Preferences, PushToken, SavedContent
from .services import notices_for, send_email_code, unsubscribe_user

INBOX_DAYS = 60
PREF_FIELDS = ('push', 'email', 'campaigns', 'events', 'official')
EXPO_TOKEN = re.compile(r'^Expo(nent)?PushToken\[[^\]]+\]$')
NEEDS_DEVICE = 'Permita as notificações no celular para ativar este canal.'
NEEDS_CONFIRMED_EMAIL = 'Confirme seu e-mail com o código enviado antes de ativar este canal.'
INVALID_CODE = 'Código inválido ou expirado.'


class PreferencesSerializer(serializers.ModelSerializer):
    """Canal só liga com meio real de entrega: aparelho registrado (push) ou e-mail confirmado."""

    class Meta:
        model = Preferences
        fields = PREF_FIELDS

    def validate(self, attrs):
        user = self.instance.participant.user
        if attrs.get('push') and not self.instance.push and not user.push_tokens.exists():
            raise serializers.ValidationError({'push': [NEEDS_DEVICE]})
        if attrs.get('email') and not self.instance.email and (not user.email or user.email_confirmado_em is None):
            raise serializers.ValidationError({'email': [NEEDS_CONFIRMED_EMAIL]})
        return attrs


def preferences_payload(prefs: Preferences) -> dict:
    user = prefs.participant.user
    return {
        **PreferencesSerializer(prefs).data,
        'hasEmail': bool(user.email),
        'emailConfirmed': user.email_confirmado_em is not None,
        'hasDevice': user.push_tokens.exists(),
    }


class PushTokenSerializer(serializers.Serializer):
    token = serializers.RegexField(EXPO_TOKEN, max_length=200, error_messages={'invalid': 'Token de push inválido.'})
    platform = serializers.ChoiceField(PushToken.Platform.choices, required=False, default=PushToken.Platform.ANDROID)


class CodeSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=12)


class JourneySerializer(serializers.ModelSerializer):
    class Meta:
        model = JourneyProgress
        fields = ('current', 'region')

    def validate_current(self, value):
        if not 1 <= value <= 7:
            raise serializers.ValidationError('Etapa inválida.')
        return value


def _preferences(participant) -> Preferences:
    return Preferences.objects.get_or_create(participant=participant)[0]


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsParticipant])
def preferences(request):
    prefs = _preferences(request.user.participant)
    if request.method != 'GET':
        serializer = PreferencesSerializer(prefs, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    return Response(preferences_payload(prefs))


@api_view(['POST', 'DELETE'])
@permission_classes([IsParticipant])
def push_tokens(request):
    if request.method == 'DELETE':
        PushToken.objects.filter(user=request.user, token=request.data.get('token', '')).delete()
        if not request.user.push_tokens.exists():
            Preferences.objects.filter(participant__user=request.user).update(push=False)
        return Response(status=status.HTTP_204_NO_CONTENT)
    serializer = PushTokenSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    # O aparelho pode trocar de conta: o token fica com quem entrou por último.
    PushToken.objects.update_or_create(
        token=serializer.validated_data['token'],
        defaults={'user': request.user, 'platform': serializer.validated_data['platform']},
    )
    return Response(status=status.HTTP_204_NO_CONTENT)


@scoped('password')
@api_view(['POST'])
@permission_classes([IsParticipant])
def email_code(request):
    user = request.user
    if not user.email:
        return Response({'email': ['Cadastre um e-mail no seu perfil para receber avisos por e-mail.']}, status=status.HTTP_400_BAD_REQUEST)
    send_email_code(user)
    return Response({'detail': f'Enviamos um código de 6 dígitos para {user.email}.'}, status=status.HTTP_202_ACCEPTED)


@scoped('password')
@api_view(['POST'])
@permission_classes([IsParticipant])
def email_confirm(request):
    serializer = CodeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = request.user
    entry = PasswordResetCode.verify(user, serializer.validated_data['code'], PasswordResetCode.Purpose.EMAIL) if user.email else None
    if entry is None:
        return Response({'code': [INVALID_CODE]}, status=status.HTTP_400_BAD_REQUEST)
    now = timezone.now()
    entry.used_at = now
    entry.save(update_fields=['used_at'])
    user.email_confirmado_em = now
    user.save(update_fields=['email_confirmado_em'])
    # O código só é enviado a quem pediu avisos por e-mail: confirmar já liga o canal.
    prefs = _preferences(user.participant)
    prefs.email = True
    prefs.save(update_fields=['email'])
    ChangeEvent.objects.create(participant=user.participant, icon='shield', title='Avisos por e-mail ativados', actor=user)
    return Response(preferences_payload(prefs))


@csrf_exempt
@require_http_methods(['GET', 'POST'])
def unsubscribe(request, token):
    """Link "parar de receber" dos e-mails. O GET só pergunta, para leitores de link não desligarem por engano."""
    user = unsubscribe_user(token)
    if user is None or not hasattr(user, 'participant'):
        return render(request, 'engagement/sair.html', {'invalid': True}, status=404)
    if request.method == 'GET':
        return render(request, 'engagement/sair.html', {'ask': True})
    changed = Preferences.objects.filter(participant=user.participant, email=True).update(email=False)
    if changed:
        ChangeEvent.objects.create(participant=user.participant, icon='shield', title='Avisos por e-mail desativados', detail='Pelo link do e-mail')
    return render(request, 'engagement/sair.html', {'done': True})


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsParticipant])
def journey(request):
    participant = request.user.participant
    progress = JourneyProgress.objects.get_or_create(participant=participant)[0]
    if request.method != 'GET':
        if participant.profile == 'convidado':
            return Response({'detail': 'A jornada é acompanhada por doadores e receptores.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = JourneySerializer(progress, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    return Response({'kind': participant.profile, **JourneySerializer(progress).data})


@api_view(['GET'])
@permission_classes([IsParticipant])
def saved(request):
    slugs = SavedContent.objects.filter(participant=request.user.participant).select_related('content')
    return Response([item.content.slug or str(item.content.pk) for item in slugs])


@api_view(['PUT', 'DELETE'])
@permission_classes([IsParticipant])
def saved_item(request, key):
    content = get_object_or_404(Content, content_lookup(key), status=PublishStatus.PUBLICADO)
    participant = request.user.participant
    if request.method == 'PUT':
        SavedContent.objects.get_or_create(participant=participant, content=content)
    else:
        SavedContent.objects.filter(participant=participant, content=content).delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


def _inbox_queryset(request):
    participant = request.user.participant
    prefs = _preferences(participant)
    kinds = [kind for kind, field in Preferences.KIND_FIELD.items() if getattr(prefs, field)]
    now = timezone.now()
    return (
        Notification.objects.filter(status=PublishStatus.PUBLICADO, tipo__in=kinds, data_disparo__lte=now)
        .filter(data_disparo__gte=now - timedelta(days=INBOX_DAYS))
        .filter(notices_for(participant))
        .exclude(
            pk__in=NotificationReceipt.objects.filter(user=request.user, hidden_at__isnull=False).values('notification_id')
        )
        .select_related('centro', 'conteudo')
    )


@api_view(['GET'])
@permission_classes([IsParticipant])
def inbox(request):
    notices = list(_inbox_queryset(request))
    read = set(
        NotificationReceipt.objects.filter(user=request.user, notification__in=notices, read_at__isnull=False).values_list(
            'notification_id', flat=True
        )
    )
    return Response(
        [
            {
                'id': str(notice.pk),
                'kind': notice.tipo,
                'title': notice.titulo,
                'body': notice.mensagem,
                'origin': notice.origem,
                'sentAt': notice.data_disparo.isoformat(),
                'read': notice.pk in read,
                'centerId': notice.centro.slug if notice.centro else None,
                'contentId': (notice.conteudo.slug or str(notice.conteudo.pk)) if notice.conteudo else None,
            }
            for notice in notices
        ]
    )


@api_view(['POST'])
@permission_classes([IsParticipant])
def inbox_read(request, pk):
    notice = get_object_or_404(_inbox_queryset(request), pk=pk)
    receipt, _ = NotificationReceipt.objects.get_or_create(user=request.user, notification=notice)
    if receipt.read_at is None:
        receipt.read_at = timezone.now()
        receipt.save(update_fields=['read_at'])
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsParticipant])
def inbox_read_all(request):
    now = timezone.now()
    for notice in _inbox_queryset(request):
        NotificationReceipt.objects.update_or_create(user=request.user, notification=notice, defaults={'read_at': now})
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsParticipant])
def inbox_clear_read(request):
    NotificationReceipt.objects.filter(user=request.user, read_at__isnull=False, hidden_at__isnull=True).update(
        hidden_at=timezone.now()
    )
    return Response(status=status.HTTP_204_NO_CONTENT)
