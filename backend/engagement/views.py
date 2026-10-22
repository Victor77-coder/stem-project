from datetime import timedelta

from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsParticipant
from catalog.models import Content, PublishStatus
from catalog.public import content_lookup

from .models import JourneyProgress, Notification, NotificationReceipt, Preferences, SavedContent

INBOX_DAYS = 60
PREF_FIELDS = ('push', 'email', 'campaigns', 'events', 'official')


class PreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Preferences
        fields = PREF_FIELDS


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
    return Response(PreferencesSerializer(prefs).data)


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsParticipant])
def journey(request):
    participant = request.user.participant
    progress = JourneyProgress.objects.get_or_create(participant=participant)[0]
    if request.method != 'GET':
        if participant.profile == 'leigo':
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
    region = Q(uf='') | Q(uf=participant.uf, cidade='') | Q(uf=participant.uf, cidade__iexact=participant.city)
    return (
        Notification.objects.filter(status=PublishStatus.PUBLICADO, tipo__in=kinds, data_disparo__lte=now)
        .filter(data_disparo__gte=now - timedelta(days=INBOX_DAYS))
        .filter(region)
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
