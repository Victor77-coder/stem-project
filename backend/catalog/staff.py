from collections import defaultdict
from datetime import datetime

from django.conf import settings
from django.db import transaction
from django.db.models import Count
from django.db.models.functions import TruncMonth
from django.forms.models import model_to_dict
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from accounts.models import Role, Status, StatusChange, User
from accounts.permissions import IsTeamMember, TeamReadAdminWrite
from engagement.health import health
from engagement.models import Notification, NotificationDelivery
from engagement.services import reach
from participants.models import Participant

from .models import AppSettings, Attachment, CatalogHistory, Center, Content, JourneyStep, PublishStatus, Statistic

SUBSTANTIVE = ('titulo', 'descricao', 'categoria', 'fonte', 'secoes')
NO_SOURCE = 'Informe a fonte para publicar. Sem fonte o conteúdo permanece como rascunho.'
NO_VALIDATION = 'Conteúdo clínico-educacional só é publicado após a validação clínica da liga.'
NO_PUBLISH = 'Somente administradores e administradores de conteúdo publicam avisos. Salve como rascunho.'
NO_PUBLISH_STEP = 'Somente administradores publicam ou alteram etapas oficiais da jornada. Salve como rascunho.'


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
        'publicadoEm': timezone.localtime(content.publicado_em).date().isoformat() if content.publicado_em else '',
        'historico': history,
        'slug': content.slug or '',
        'secoes': content.secoes,
        'minutos': content.minutos,
        'palavrasChave': content.palavras_chave,
        'destaque': content.destaque,
        'lista': content.lista,
        'selo': content.selo,
        'linkOriginal': content.link_original,
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
        if content.validado_por_id is None and not content.is_collected_news:
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


# Centro do CNES: a coleta mensal atualiza estes campos. No painel só se corrige o resto (telefone, horário,
# observações, coordenadas, nome curto, status e a revisão).
CNES_LOCKED = ('cnes', 'codigo_ibge', 'nome', 'endereco', 'cidade', 'uf', 'tipo', 'fonte', 'fonte_data')
CNES_LOCKED_MESSAGE = 'Vem do CNES e é atualizado pela coleta mensal. Corrija na fonte ou marque o centro para revisão.'


def unique_center_slug(text: str) -> str:
    base = slugify(text)[:50].strip('-') or 'centro'
    slug, n = base, 2
    while Center.objects.filter(slug=slug).exists():
        slug, n = f'{base}-{n}', n + 1
    return slug


class CenterSerializer(PublishRules):
    """Cadastros do painel (RF13): campanhas e centros manuais por inteiro; centros do CNES, só as correções seguras."""

    required_to_publish = {
        'fonte': 'Fonte é obrigatória. Sem fonte a unidade não é publicada.',
        'fonte_data': 'Informe a data de atualização da fonte.',
    }

    class Meta:
        model = Center
        exclude = ()
        read_only_fields = ('origem', 'dados_cnes')
        extra_kwargs = {'slug': {'required': False}}

    def validate(self, attrs):
        if self.instance is not None and self.instance.origem == Center.Origin.CNES:
            locked = [field for field in CNES_LOCKED if field in attrs and attrs[field] != getattr(self.instance, field)]
            if locked:
                raise ValidationError({field: [CNES_LOCKED_MESSAGE] for field in locked})
        return super().validate(attrs)

    def create(self, validated_data):
        validated_data['origem'] = Center.Origin.MANUAL
        if not validated_data.get('slug'):
            validated_data['slug'] = unique_center_slug(validated_data.get('nome_curto') or validated_data['nome'])
        return super().create(validated_data)


class NotificationSerializer(PublishRules):
    required_to_publish = {'origem': 'Campanhas e comunicados exigem origem oficial. Sem origem, permanece rascunho.'}
    envios = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        exclude = ()
        read_only_fields = ('disparado_em',)

    def get_envios(self, notice: Notification) -> dict:
        totals = {
            (channel, state): total
            for channel, state, total in notice.deliveries.values_list('channel', 'status').annotate(total=Count('pk'))
        }
        return {
            channel: {state: totals.get((channel, state), 0) for state in NotificationDelivery.Status.values}
            for channel in NotificationDelivery.Channel.values
        }


class ReachQuery(serializers.Serializer):
    tipo = serializers.ChoiceField(Notification.Kind.choices)
    uf = serializers.CharField(max_length=2, required=False, allow_blank=True, default='')
    cidade = serializers.CharField(max_length=100, required=False, allow_blank=True, default='')


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
    """RF05/RF06: as etapas oficiais só mudam pelos administradores. A equipe pode preparar rascunhos."""

    queryset = JourneyStep.objects.all()
    serializer_class = JourneyStepSerializer
    entidade = 'etapa'

    def _require_admin(self):
        if not self.request.user.staff.is_admin:
            raise PermissionDenied(NO_PUBLISH_STEP)

    def perform_create(self, serializer):
        if serializer.validated_data.get('status') == PublishStatus.PUBLICADO:
            self._require_admin()
        super().perform_create(serializer)

    def perform_update(self, serializer):
        if PublishStatus.PUBLICADO in (serializer.instance.status, serializer.validated_data.get('status')):
            self._require_admin()
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if instance.status == PublishStatus.PUBLICADO:
            self._require_admin()
        super().perform_destroy(instance)


class StaffCenterViewSet(AuditedViewSet):
    queryset = Center.objects.all()
    serializer_class = CenterSerializer
    entidade = 'centro'


class StaffNotificationViewSet(AuditedViewSet):
    """Qualquer pessoa da equipe escreve rascunhos; publicar, mexer no publicado e despublicar exige permissão."""

    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    entidade = 'aviso'

    def _require_publisher(self):
        if not self.request.user.staff.can_publish_notices:
            raise PermissionDenied(NO_PUBLISH)

    def perform_create(self, serializer):
        if serializer.validated_data.get('status') == PublishStatus.PUBLICADO:
            self._require_publisher()
        super().perform_create(serializer)

    def perform_update(self, serializer):
        notice = serializer.instance
        if notice.disparado_em or (notice.status == PublishStatus.PUBLICADO and notice.data_disparo <= timezone.now()):
            raise ValidationError({'detail': 'Aviso já disparado não pode ser alterado. Despublique e crie outro.'})
        if PublishStatus.PUBLICADO in (notice.status, serializer.validated_data.get('status')):
            self._require_publisher()
        super().perform_update(serializer)

    def perform_destroy(self, instance):
        if instance.status == PublishStatus.PUBLICADO:
            self._require_publisher()
        super().perform_destroy(instance)

    @action(detail=False, methods=['get'])
    def alcance(self, request):
        query = ReachQuery(data=request.query_params)
        query.is_valid(raise_exception=True)
        data = query.validated_data
        return Response(reach(data['tipo'], data['uf'].strip().upper(), data['cidade'].strip()))

    @action(detail=False, methods=['get'])
    def saude(self, request):
        """Alertas do envio nas últimas 24 horas (credenciais de push, SMTP, falhas em massa, cota de e-mail)."""
        return Response(health(timezone.now()))


class StaffStatisticViewSet(AuditedViewSet):
    queryset = Statistic.objects.all()
    serializer_class = StatisticSerializer
    entidade = 'estatistica'
    soft_delete = False


# RF13: relatórios só com contagens. Recortes de 1 a 4 pessoas viram "menos de 5" para ninguém ser identificado.
SMALL_COUNT = 5
REPORT_MONTHS = 12
ENTITY_LABEL = {
    'conteudo': 'Conteúdo',
    'etapa': 'Jornada',
    'centro': 'Centros e campanhas',
    'aviso': 'Avisos',
    'estatistica': 'Estatísticas',
    'configuracao': 'Configurações',
    'conta': 'Contas da equipe',
    'acesso': 'Pedidos de acesso',
}
LOG_LIMIT = 300


def _masked(total: int) -> int | None:
    return total if total == 0 or total >= SMALL_COUNT else None


def _months(now) -> list[str]:
    """Os últimos REPORT_MONTHS meses, do mais antigo ao atual, como 'aaaa-mm'."""
    year, month, months = now.year, now.month, []
    for _ in range(REPORT_MONTHS):
        months.append(f'{year:04d}-{month:02d}')
        year, month = (year - 1, 12) if month == 1 else (year, month - 1)
    return months[::-1]


def _by_month(query, field: str, start) -> dict[str, int]:
    rows = query.filter(**{f'{field}__gte': start}).annotate(mes=TruncMonth(field)).values('mes').annotate(total=Count('pk'))
    return {timezone.localtime(row['mes']).strftime('%Y-%m'): row['total'] for row in rows}


@api_view(['GET'])
@permission_classes([IsTeamMember])
def reports(request):
    """Relatórios do painel (RF13): volumes de cadastros, inativações, avisos e conteúdos. Nenhum nome nem identificador."""
    now = timezone.localtime()
    months = _months(now)
    start = timezone.make_aware(datetime.strptime(months[0], '%Y-%m'))
    participants = Participant.objects.all()
    active = participants.filter(user__status=Status.ATIVO)
    profiles = Participant._meta.get_field('profile').choices

    by_profile = dict(active.values_list('profile').annotate(total=Count('pk')))
    by_uf: dict[str, dict[str, int | None]] = defaultdict(dict)
    for uf, profile, total in active.exclude(uf='').values_list('uf', 'profile').annotate(total=Count('pk')):
        by_uf[uf][profile] = _masked(total)
    new = {profile: _by_month(participants.filter(profile=profile), 'created_at', start) for profile, _ in profiles}
    inactive = _by_month(
        StatusChange.objects.filter(user__role=Role.PARTICIPANT, to_status=Status.INATIVO), 'created_at', start
    )
    deliveries = NotificationDelivery.objects.filter(updated_at__gte=start)
    sent = {
        (channel, state): total for channel, state, total in deliveries.values_list('channel', 'status').annotate(total=Count('pk'))
    }
    return Response(
        {
            'participantes': {
                'ativos': {profile: by_profile.get(profile, 0) for profile, _ in profiles},
                'inativos': participants.exclude(user__status=Status.ATIVO).count(),
                'porUf': [
                    {'uf': uf, **{profile: counts.get(profile, 0) for profile, _ in profiles}} for uf, counts in sorted(by_uf.items())
                ],
            },
            'meses': [
                {
                    'mes': month,
                    'novos': {profile: new[profile].get(month, 0) for profile, _ in profiles},
                    'inativacoes': inactive.get(month, 0),
                }
                for month in months
            ],
            'avisos': {
                'publicados': Notification.objects.filter(status=PublishStatus.PUBLICADO, data_disparo__gte=start).count(),
                'envios': {
                    channel: {state: sent.get((channel, state), 0) for state in ('enviado', 'falhou', 'ignorado')}
                    for channel in NotificationDelivery.Channel.values
                },
            },
            'conteudos': dict(
                Content.objects.filter(status=PublishStatus.PUBLICADO).values_list('categoria').annotate(total=Count('pk'))
            ),
            'recorteMinimo': SMALL_COUNT,
            'desde': months[0],
        }
    )


def _log_item(item: CatalogHistory) -> dict:
    snapshot = item.snapshot or {}
    title = snapshot.get('titulo') or snapshot.get('nome') or snapshot.get('nome_curto') or ''
    return {
        'id': item.pk,
        'quando': item.data.isoformat(),
        'tipo': item.entidade,
        'tipoLabel': ENTITY_LABEL.get(item.entidade, item.entidade.capitalize()),
        'objeto': title or f'#{item.objeto_id}',
        'pessoa': item.autor_nome,
        'acao': item.acao,
    }


@api_view(['GET'])
@permission_classes([IsTeamMember])
def action_log(request):
    """Log de ações da equipe (RF13): quem fez o quê e quando. Filtros: tipo, pessoa, desde e até (aaaa-mm-dd)."""
    params = request.query_params
    query = CatalogHistory.objects.all()
    if params.get('tipo'):
        query = query.filter(entidade=params['tipo'])
    if pessoa := params.get('pessoa', '').strip():
        query = query.filter(autor_nome__icontains=pessoa)
    if params.get('desde'):
        query = query.filter(data__date__gte=params['desde'])
    if params.get('ate'):
        query = query.filter(data__date__lte=params['ate'])
    return Response(
        {
            'itens': [_log_item(item) for item in query.order_by('-data')[:LOG_LIMIT]],
            'tipos': [{'id': key, 'label': label} for key, label in ENTITY_LABEL.items()],
            'limite': LOG_LIMIT,
        }
    )


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
            'participantesAtivos': {profile: participants.get(profile, 0) for profile in ('doador', 'receptor', 'convidado')},
        }
    )


def app_settings_payload(config: AppSettings) -> dict:
    return {'jornadaAtiva': config.jornada_ativa, 'atualizadoEm': config.atualizado_em.isoformat()}


@api_view(['GET', 'PATCH'])
@permission_classes([TeamReadAdminWrite])
def app_settings(request):
    """Chaves do aplicativo. Toda a equipe consulta; só administradores alteram."""
    config = AppSettings.load()
    if request.method == 'PATCH':
        value = request.data.get('jornadaAtiva')
        if not isinstance(value, bool):
            raise ValidationError({'jornadaAtiva': ['Informe verdadeiro ou falso.']})
        if value != config.jornada_ativa:
            config.jornada_ativa = value
            config.save()
            log('configuracao', config, request.user, 'Ativou a Jornada no app' if value else 'Desativou a Jornada no app')
    return Response(app_settings_payload(config))
