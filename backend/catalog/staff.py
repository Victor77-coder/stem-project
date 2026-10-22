from collections import defaultdict

from django.conf import settings
from django.db import transaction
from django.db.models import Count
from django.forms.models import model_to_dict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from accounts.models import Role, Status, User
from accounts.permissions import IsTeamMember
from engagement.models import Notification
from participants.models import Participant

from .models import Attachment, CatalogHistory, Center, Content, JourneyStep, PublishStatus, Statistic

SUBSTANTIVE = ('titulo', 'descricao', 'categoria', 'fonte', 'secoes')
NO_SOURCE = 'Informe a fonte para publicar. Sem fonte o conteúdo permanece como rascunho.'
NO_VALIDATION = 'Conteúdo clínico-educacional só é publicado após a validação clínica da liga.'


def log(entidade: str, obj, user: User, acao: str, snapshot: dict | None = None) -> None:
    CatalogHistory.objects.create(
        entidade=entidade,
        objeto_id=str(obj.pk),
        autor=user,
        autor_nome=user.name or user.email or 'Equipe',
        acao=acao,
        snapshot=snapshot or {},
    )


def _confirm_password(request) -> None:
    if not request.user.check_password(request.data.get('senha') or ''):
        raise ValidationError({'senha': ['Senha incorreta. Tente novamente.']})


def _histories(entidade: str, ids: list[str]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for entry in CatalogHistory.objects.filter(entidade=entidade, objeto_id__in=ids).order_by('data'):
        grouped[entry.objeto_id].append({'autor': entry.autor_nome, 'acao': entry.acao, 'data': entry.data.isoformat()})
    return grouped


def content_payload(content: Content, history: list[dict]) -> dict:
    return {
        'id': str(content.pk),
        'titulo': content.titulo,
        'descricao': content.descricao,
        'categoria': content.categoria,
        'publicoAlvo': content.publico_alvo,
        'fonte': content.fonte,
        'visibilidade': content.visibilidade,
        'status': content.status,
        'validacaoClinica': content.validado_por_id is not None,
        'validadoPor': content.validado_por.name if content.validado_por else '',
        'validadoEm': content.validado_em.isoformat() if content.validado_em else '',
        'anexos': [
            {'id': str(item.pk), 'nome': item.nome, 'tamanho': item.tamanho, 'enviadoEm': item.enviado_em.date().isoformat()}
            for item in content.anexos.all()
        ],
        'atualizadoEm': content.atualizado_em.date().isoformat(),
        'historico': history,
        'slug': content.slug or '',
        'secoes': content.secoes,
        'minutos': content.minutos,
        'palavrasChave': content.palavras_chave,
        'destaque': content.destaque,
        'lista': content.lista,
        'selo': content.selo,
    }


class Section(serializers.Serializer):
    title = serializers.CharField(max_length=120, allow_blank=True)
    body = serializers.CharField()


class ContentInputSerializer(serializers.Serializer):
    titulo = serializers.CharField(max_length=200)
    descricao = serializers.CharField()
    categoria = serializers.ChoiceField(Content.Category.choices)
    publicoAlvo = serializers.ListField(child=serializers.ChoiceField(Content.AUDIENCES), allow_empty=True)
    fonte = serializers.CharField(max_length=200, allow_blank=True, required=False)
    visibilidade = serializers.ChoiceField(Content.Visibility.choices, required=False)
    status = serializers.ChoiceField(PublishStatus.choices, required=False)
    validacaoClinica = serializers.BooleanField(required=False)
    slug = serializers.SlugField(max_length=80, allow_blank=True, required=False)
    secoes = Section(many=True, required=False)
    minutos = serializers.IntegerField(min_value=1, max_value=60, required=False)
    palavrasChave = serializers.CharField(max_length=200, allow_blank=True, required=False)
    destaque = serializers.BooleanField(required=False)
    lista = serializers.ChoiceField(Content.Listing.choices, required=False)
    selo = serializers.ChoiceField(['', 'Mito', 'Verdade'], required=False)


FIELD_MAP = {
    'titulo': 'titulo',
    'descricao': 'descricao',
    'categoria': 'categoria',
    'publicoAlvo': 'publico_alvo',
    'fonte': 'fonte',
    'visibilidade': 'visibilidade',
    'status': 'status',
    'secoes': 'secoes',
    'minutos': 'minutos',
    'palavrasChave': 'palavras_chave',
    'destaque': 'destaque',
    'lista': 'lista',
    'selo': 'selo',
}


@transaction.atomic
def save_content(content: Content | None, data: dict, user: User) -> Content:
    is_new = content is None
    content = content or Content()
    previous_status = content.status
    can_validate = user.staff.can_validate

    if data.get('status') == PublishStatus.INATIVO and previous_status != PublishStatus.INATIVO:
        raise ValidationError({'status': ['Para despublicar, use a ação Deletar.']})
    changed = any(key in data and data[key] != getattr(content, key) for key in SUBSTANTIVE)
    for key, attr in FIELD_MAP.items():
        if key in data:
            setattr(content, attr, data[key].strip() if key == 'fonte' else data[key])
    if 'slug' in data:
        content.slug = data['slug'] or None
        if content.slug and Content.objects.filter(slug=content.slug).exclude(pk=content.pk).exists():
            raise ValidationError({'slug': ['Já existe um conteúdo com este identificador.']})

    validate = data.get('validacaoClinica')
    if validate and not can_validate and content.validado_por_id is None:
        raise ValidationError({'validacaoClinica': ['Somente o validador clínico ou um administrador pode validar.']})
    validated_now = False
    if can_validate and validate is not None:
        if validate and (content.validado_por_id is None or changed):
            content.validado_por, content.validado_em, validated_now = user, timezone.now(), True
        elif not validate:
            content.validado_por, content.validado_em = None, None
    elif changed and content.validado_por_id is not None:
        content.validado_por, content.validado_em = None, None

    if not content.publico_alvo:
        raise ValidationError({'publicoAlvo': ['Selecione ao menos um público-alvo.']})
    if content.status == PublishStatus.PUBLICADO:
        if not content.fonte:
            raise ValidationError({'fonte': [NO_SOURCE]})
        if content.validado_por_id is None:
            raise ValidationError({'validacaoClinica': [NO_VALIDATION]})

    content.save()
    snapshot = {key: getattr(content, attr) for key, attr in FIELD_MAP.items()}
    log('conteudo', content, user, 'Criou o conteúdo' if is_new else 'Editou o conteúdo', snapshot)
    if validated_now:
        log('conteudo', content, user, 'Validou o conteúdo')
    return content


class StaffContentViewSet(viewsets.ViewSet):
    permission_classes = [IsTeamMember]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def _queryset(self):
        return Content.objects.select_related('validado_por').prefetch_related('anexos')

    def _payload(self, content: Content) -> dict:
        return content_payload(content, _histories('conteudo', [str(content.pk)])[str(content.pk)])

    def list(self, request):
        contents = list(self._queryset())
        if request.query_params.get('incluirInativos') != '1':
            contents = [item for item in contents if item.status != PublishStatus.INATIVO]
        histories = _histories('conteudo', [str(item.pk) for item in contents])
        return Response([content_payload(item, histories[str(item.pk)]) for item in contents])

    def retrieve(self, request, pk=None):
        return Response(self._payload(get_object_or_404(self._queryset(), pk=pk)))

    def create(self, request):
        serializer = ContentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        content = save_content(None, serializer.validated_data, request.user)
        return Response(self._payload(content), status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        content = get_object_or_404(self._queryset(), pk=pk)
        serializer = ContentInputSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        save_content(content, serializer.validated_data, request.user)
        return Response(self._payload(get_object_or_404(self._queryset(), pk=pk)))

    update = partial_update

    @action(detail=True, methods=['post'])
    def despublicar(self, request, pk=None):
        content = get_object_or_404(self._queryset(), pk=pk)
        _confirm_password(request)
        content.status = PublishStatus.INATIVO
        content.save(update_fields=['status', 'atualizado_em'])
        log('conteudo', content, request.user, 'Despublicou o conteúdo')
        return Response(self._payload(content))

    @action(detail=True, methods=['post'])
    def anexos(self, request, pk=None):
        content = get_object_or_404(self._queryset(), pk=pk)
        upload = request.FILES.get('arquivo')
        if upload is None:
            raise ValidationError({'arquivo': ['Envie o arquivo no campo "arquivo".']})
        if upload.size > settings.MAX_ATTACHMENT_BYTES:
            raise ValidationError({'arquivo': [f'Arquivo acima de 500 MB: {upload.name}']})
        item = Attachment.objects.create(content=content, arquivo=upload, nome=upload.name[:255], tamanho=upload.size)
        log('conteudo', content, request.user, f'Anexou {item.nome}')
        return Response(
            {'id': str(item.pk), 'nome': item.nome, 'tamanho': item.tamanho, 'enviadoEm': item.enviado_em.date().isoformat()},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['delete'], url_path=r'anexos/(?P<attachment_id>[0-9a-f-]+)')
    def remover_anexo(self, request, pk=None, attachment_id=None):
        item = get_object_or_404(Attachment, pk=attachment_id, content_id=pk)
        item.arquivo.delete(save=False)
        item.delete()
        log('conteudo', item.content, request.user, f'Removeu {item.nome}')
        return Response(status=status.HTTP_204_NO_CONTENT)


class PublishRules(serializers.ModelSerializer):
    """Mensagem clara antes de o CheckConstraint do banco recusar a publicação."""

    required_to_publish: dict[str, str] = {}

    def validate(self, attrs):
        state = {**(model_to_dict(self.instance) if self.instance else {}), **attrs}
        if state.get('status') == PublishStatus.PUBLICADO:
            errors = {field: [message] for field, message in self.required_to_publish.items() if not state.get(field)}
            if errors:
                raise ValidationError(errors)
        return attrs


class JourneyStepSerializer(PublishRules):
    required_to_publish = {'fonte': 'Informe a fonte para publicar a etapa.'}

    class Meta:
        model = JourneyStep
        exclude = ()


class CenterSerializer(PublishRules):
    required_to_publish = {
        'fonte': 'Fonte é obrigatória. Sem fonte a unidade não é publicada.',
        'fonte_data': 'Informe a data de atualização da fonte.',
    }

    class Meta:
        model = Center
        exclude = ()


class NotificationSerializer(PublishRules):
    required_to_publish = {'origem': 'Campanhas e comunicados exigem origem oficial. Sem origem, permanece rascunho.'}

    class Meta:
        model = Notification
        exclude = ()


class StatisticSerializer(serializers.ModelSerializer):
    class Meta:
        model = Statistic
        exclude = ()


class AuditedViewSet(viewsets.ModelViewSet):
    """CRUD do painel com histórico. Excluir despublica: o que já foi exibido à população fica rastreável."""

    permission_classes = [IsTeamMember]
    entidade = ''
    soft_delete = True

    def perform_create(self, serializer):
        obj = serializer.save()
        log(self.entidade, obj, self.request.user, 'Criou', serializer.data)

    def perform_update(self, serializer):
        obj = serializer.save()
        log(self.entidade, obj, self.request.user, 'Editou', serializer.data)

    def perform_destroy(self, instance):
        if self.soft_delete:
            instance.status = PublishStatus.INATIVO
            instance.save()
            log(self.entidade, instance, self.request.user, 'Despublicou')
        else:
            log(self.entidade, instance, self.request.user, 'Arquivou', self.get_serializer(instance).data)
            instance.delete()


class StaffJourneyViewSet(AuditedViewSet):
    queryset = JourneyStep.objects.all()
    serializer_class = JourneyStepSerializer
    entidade = 'etapa'


class StaffCenterViewSet(AuditedViewSet):
    queryset = Center.objects.all()
    serializer_class = CenterSerializer
    entidade = 'centro'


class StaffNotificationViewSet(AuditedViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    entidade = 'aviso'

    def perform_update(self, serializer):
        notice = serializer.instance
        if notice.status == PublishStatus.PUBLICADO and notice.data_disparo <= timezone.now():
            raise ValidationError({'detail': 'Aviso já disparado não pode ser alterado. Despublique e crie outro.'})
        super().perform_update(serializer)


class StaffStatisticViewSet(AuditedViewSet):
    queryset = Statistic.objects.all()
    serializer_class = StatisticSerializer
    entidade = 'estatistica'
    soft_delete = False


@api_view(['GET'])
@permission_classes([IsTeamMember])
def dashboard(request):
    """Métricas agregadas do painel. Nenhum dado nominal de participante (RF012)."""
    contents = Content.objects.all()
    recent = contents.order_by('-atualizado_em')[:5]
    titles = {str(pk): title for pk, title in contents.values_list('pk', 'titulo')}
    activity = CatalogHistory.objects.filter(entidade='conteudo').order_by('-data')[:5]
    by_category = dict(contents.values_list('categoria').annotate(total=Count('pk')))
    participants = dict(
        Participant.objects.filter(user__status=Status.ATIVO).values_list('profile').annotate(total=Count('pk'))
    )
    return Response(
        {
            'publicados': contents.filter(status=PublishStatus.PUBLICADO).count(),
            'rascunhos': contents.filter(status=PublishStatus.RASCUNHO).count(),
            'contasAtivas': User.objects.filter(role=Role.STAFF, status=Status.ATIVO).count(),
            'anexos': Attachment.objects.count(),
            'totalConteudos': contents.count(),
            'recentes': [
                {'id': str(item.pk), 'titulo': item.titulo, 'status': item.status, 'atualizadoEm': item.atualizado_em.date().isoformat()}
                for item in recent
            ],
            'atividade': [
                {'autor': entry.autor_nome, 'acao': entry.acao, 'titulo': titles.get(entry.objeto_id, ''), 'data': entry.data.isoformat()}
                for entry in activity
            ],
            'porCategoria': [{'categoria': value, 'total': by_category.get(value, 0)} for value in Content.Category.values],
            'participantesAtivos': {profile: participants.get(profile, 0) for profile in ('doador', 'receptor', 'leigo')},
        }
    )
