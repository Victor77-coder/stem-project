import math
import uuid

from django.db.models import Q
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.throttling import scoped
from consent.models import ConsentDocument

from .cache import cached_response
from .geo import locate_cep, normalize_cep
from .models import Attachment, Center, Content, EstimateRule, GlossaryTerm, JourneyStep, PublishStatus, Statistic

RADIUS_KM = 50
MAX_RADIUS_KM = 300
ESTIMATE_DISCLAIMER = (
    'Estimativa exclusivamente preditiva, baseada em dados públicos. '
    'Não é confirmação de atendimento, procedimento, vaga ou prazo.'
)
UNDERREPORTING_NOTICE = 'Algumas unidades podem não reportar ao DataSUS. Os números podem estar abaixo do real.'
REGION_OF = {
    **dict.fromkeys(['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'], 'Norte'),
    **dict.fromkeys(['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'], 'Nordeste'),
    **dict.fromkeys(['DF', 'GO', 'MT', 'MS'], 'Centro-Oeste'),
    **dict.fromkeys(['ES', 'MG', 'RJ', 'SP'], 'Sudeste'),
    **dict.fromkeys(['PR', 'RS', 'SC'], 'Sul'),
}


def br_date(value) -> str:
    return value.strftime('%d/%m/%Y') if value else ''


def content_lookup(key: str) -> Q:
    try:
        return Q(pk=uuid.UUID(key))
    except ValueError:
        return Q(slug=key)


def visible_contents(request):
    allowed = [Content.Visibility.PUBLICO]
    user = request.user
    if user.is_authenticated and user.is_participant:
        allowed.append(Content.Visibility.RESTRITO)
    return Content.objects.filter(status=PublishStatus.PUBLICADO, visibilidade__in=allowed).prefetch_related('anexos')


def article(content: Content, request) -> dict:
    return {
        'id': content.slug or str(content.pk),
        'title': content.titulo,
        'summary': content.descricao,
        'category': content.categoria,
        'audience': content.publico_alvo,
        'minutes': content.minutos,
        'list': content.lista,
        'featured': content.destaque,
        'keywords': content.palavras_chave,
        'tag': content.selo,
        'validated': f'Validado pela equipe médica da liga · {br_date(content.validado_em)}' if content.validado_em else '',
        'source': content.fonte,
        'sections': content.secoes or [{'title': '', 'body': content.descricao}],
        'updatedAt': content.atualizado_em.isoformat(),
        'attachments': [
            {
                'id': str(item.pk),
                'name': item.nome,
                'size': item.tamanho,
                'url': request.build_absolute_uri(f'/api/v1/anexos/{item.pk}/'),
            }
            for item in content.anexos.all()
        ],
    }


@api_view(['GET'])
@permission_classes([AllowAny])
def contents(request):
    def build():
        query = visible_contents(request)
        params = request.query_params
        if params.get('categoria'):
            query = query.filter(categoria=params['categoria'])
        if params.get('lista'):
            query = query.filter(lista=params['lista'])
        if q := params.get('q', '').strip():
            query = query.filter(Q(titulo__icontains=q) | Q(descricao__icontains=q) | Q(palavras_chave__icontains=q))
        audience = params.get('publico')
        return [
            article(item, request)
            for item in query.order_by('-destaque', 'criado_em')
            if audience not in Content.AUDIENCES or audience in item.publico_alvo
        ]

    return cached_response(request, build)


@api_view(['GET'])
@permission_classes([AllowAny])
def content_detail(request, key):
    return cached_response(request, lambda: article(get_object_or_404(visible_contents(request), content_lookup(key)), request))


@api_view(['GET'])
@permission_classes([AllowAny])
def attachment(request, pk):
    item = get_object_or_404(Attachment.objects.select_related('content'), pk=pk)
    if not visible_contents(request).filter(pk=item.content_id).exists():
        raise Http404
    return FileResponse(item.arquivo.open('rb'), as_attachment=True, filename=item.nome)


def journey_step(step: JourneyStep, region: str) -> dict:
    return {
        'id': step.slug,
        'order': step.ordem,
        'title': step.titulo,
        'shortTitle': step.titulo_curto,
        'summary': step.resumo_por_regiao.get(region) or step.resumo,
        'homeBody': step.resumo_home or None,
        'body': step.corpo,
        'stemDoes': step.o_que_stem_faz,
        'susDoes': step.o_que_sus_faz,
        'checklist': [{'label': label} for label in step.checklist],
        'place': step.local,
        'source': step.fonte,
    }


@api_view(['GET'])
@permission_classes([AllowAny])
def journeys(request, kind):
    if kind not in JourneyStep.Journey.values:
        raise Http404
    region = request.query_params.get('regiao', 'maceio')

    def build():
        steps = JourneyStep.objects.filter(jornada=kind, status=PublishStatus.PUBLICADO)
        return [journey_step(step, region) for step in steps]

    return cached_response(request, build)


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    rad = math.radians
    d_lat, d_lng = rad(lat2 - lat1), rad(lng2 - lng1)
    s = math.sin(d_lat / 2) ** 2 + math.cos(rad(lat1)) * math.cos(rad(lat2)) * math.sin(d_lng / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(s))


def format_distance(km: float) -> str:
    return f'{round(km * 1000)} m' if km < 1 else f'{km:.1f} km'.replace('.', ',')


def center(item: Center, km: float | None = None) -> dict:
    return {
        'id': item.slug,
        'cnes': item.cnes or None,
        'name': item.nome,
        'shortName': item.nome_curto,
        'address': item.endereco,
        'listAddress': item.endereco_lista or item.endereco,
        'city': item.cidade,
        'uf': item.uf,
        'kind': item.tipo,
        'lat': item.lat,
        'lng': item.lng,
        'hours': item.horario or None,
        'phone': item.telefone or None,
        'services': item.servicos,
        'notes': item.observacoes,
        'eventWhen': item.evento_quando or None,
        'source': item.fonte,
        'sourceDate': br_date(item.fonte_data),
        'km': round(km, 2) if km is not None else None,
        'distance': format_distance(km) if km is not None else None,
    }


def _float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


@api_view(['GET'])
@permission_classes([AllowAny])
def centers(request):
    """Contrato de GET /centros?lat=&lng=&q=&kind=. Coordenadas do aparelho não são gravadas (RF008)."""
    params = request.query_params
    lat, lng = _float(params.get('lat')), _float(params.get('lng'))
    radius = min(_float(params.get('raio')) or RADIUS_KM, MAX_RADIUS_KM)

    def build():
        query = Center.objects.filter(status=PublishStatus.PUBLICADO)
        if params.get('kind') in Center.Kind.values:
            query = query.filter(tipo=params['kind'])
        if params.get('uf'):
            query = query.filter(uf=params['uf'].upper())
        if params.get('cidade'):
            query = query.filter(cidade__iexact=params['cidade'])
        if q := params.get('q', '').strip():
            query = query.filter(
                Q(nome__icontains=q) | Q(endereco__icontains=q) | Q(cidade__icontains=q) | Q(cnes=q) | Q(nome_curto__icontains=q)
            )
        if lat is None or lng is None:
            return {'results': [center(item) for item in query], 'lastUpdate': _last_update(query)}
        near = []
        for item in query.exclude(lat__isnull=True).exclude(lng__isnull=True):
            km = haversine_km(lat, lng, item.lat, item.lng)
            if km <= radius:
                near.append((km, item))
        near.sort(key=lambda pair: pair[0])
        return {'results': [center(item, km) for km, item in near], 'lastUpdate': _last_update(query)}

    return cached_response(request, build)


def _last_update(query) -> str:
    latest = query.exclude(fonte_data__isnull=True).order_by('-fonte_data').values_list('fonte_data', flat=True).first()
    return br_date(latest)


@api_view(['GET'])
@permission_classes([AllowAny])
def center_detail(request, slug):
    item = get_object_or_404(Center, slug=slug, status=PublishStatus.PUBLICADO)
    lat, lng = _float(request.query_params.get('lat')), _float(request.query_params.get('lng'))
    km = haversine_km(lat, lng, item.lat, item.lng) if None not in (lat, lng, item.lat, item.lng) else None
    return Response(center(item, km))


@scoped('geo')
@api_view(['GET'])
@permission_classes([AllowAny])
def cep_location(request, cep):
    """RF009: CEP digitado vira ponto de origem para /centros. O CEP não é associado a ninguém aqui."""
    digits = normalize_cep(cep)
    if digits is None:
        return Response({'detail': 'Informe um CEP com 8 dígitos.'}, status=400)
    found = locate_cep(digits)
    if found is None:
        return Response({'detail': 'Não encontramos a localização deste CEP.'}, status=404)
    return Response(found)


def _latest(indicator: str, recorte: str, period: str) -> Statistic | None:
    return Statistic.objects.filter(indicador=indicator, recorte=recorte, periodo=period).order_by('-data_extracao').first()


@api_view(['GET'])
@permission_classes([AllowAny])
def statistics(request):
    def build():
        years = sorted(
            set(Statistic.objects.filter(indicador=Statistic.Indicator.DOADORES).values_list('periodo', flat=True)), reverse=True
        )
        if not years:
            return {'years': [], 'available': False, 'detail': 'Estatísticas indisponíveis no momento.'}
        year = request.query_params.get('ano') if request.query_params.get('ano') in years else years[0]
        uf = (request.query_params.get('uf') or 'AL').upper()
        region = REGION_OF.get(uf, 'Nordeste')
        donors = _latest(Statistic.Indicator.DOADORES, 'BR', year)
        transplants = _latest(Statistic.Indicator.TRANSPLANTES, 'BR', year)
        regions = []
        for name in ('Sudeste', 'Sul', 'Nordeste', 'Centro-Oeste', 'Norte'):
            row = _latest(Statistic.Indicator.TRANSPLANTES_REGIAO, name, year)
            if row:
                regions.append({'name': name, 'value': int(row.valor)})
        wait = _latest(Statistic.Indicator.ESPERA, region, year)
        rows = [row for row in (donors, transplants, wait) if row]
        return {
            'available': True,
            'years': years,
            'year': year,
            'uf': uf,
            'region': region,
            'headline': {
                'donors': donors.rotulo if donors else '',
                'transplants': transplants.rotulo if transplants else '',
            },
            'regions': regions,
            'wait': wait.rotulo if wait else '',
            'source': rows[0].fonte if rows else '',
            'extractedAt': br_date(max(row.data_extracao for row in rows)) if rows else '',
            'underreporting': any(row.aviso_subnotificacao for row in rows),
            'notice': UNDERREPORTING_NOTICE,
        }

    return cached_response(request, build)


@api_view(['GET'])
@permission_classes([AllowAny])
def estimate(request):
    """RF011: regra por perfil e UF, sempre com aviso. Sem regra, não inventa número."""
    profile = request.query_params.get('perfil', 'receptor')
    uf = (request.query_params.get('uf') or '').upper()

    def build():
        rule = (
            EstimateRule.objects.filter(perfil=profile, uf=uf, ativo=True).first()
            or EstimateRule.objects.filter(perfil=profile, uf='*', ativo=True).first()
        )
        if rule is None:
            return {
                'available': False,
                'detail': 'Ainda não há dados públicos suficientes para estimar. Veja as etapas da sua jornada.',
                'disclaimer': ESTIMATE_DISCLAIMER,
            }
        return {
            'available': True,
            'label': rule.rotulo,
            'value': rule.valor,
            'note': rule.nota,
            'source': rule.fonte,
            'version': rule.versao,
            'disclaimer': ESTIMATE_DISCLAIMER,
        }

    response = cached_response(request, build)
    response.data = {**response.data, 'calculatedAt': timezone.now().isoformat()}
    return response


@api_view(['GET'])
@permission_classes([AllowAny])
def glossary(request):
    return cached_response(request, lambda: [{'term': item.termo, 'body': item.definicao} for item in GlossaryTerm.objects.all()])


@api_view(['GET'])
@permission_classes([AllowAny])
def consent_document(request, kind):
    def build():
        document = ConsentDocument.current(kind)
        if document is None:
            raise Http404
        return {
            'kind': document.kind,
            'version': document.version,
            'title': document.title,
            'sections': document.sections,
            'publishedAt': br_date(document.published_at),
        }

    return cached_response(request, build)
