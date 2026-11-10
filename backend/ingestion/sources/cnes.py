"""Aplica a carga do CNES nos centros (RF008).

Política: com CNES_AUTO_PUBLISH (padrão), novo entra publicado; sem ela, entra como rascunho para
aprovação no painel. Centro já publicado só recebe mudanças pequenas e, se o CNES mudar algo sensível
(coordenada, tipo, habilitações), fica marcado para revisão da equipe; quem sai do recorte é
despublicado; cadastros manuais nunca são tocados.
"""

from datetime import datetime

from django.conf import settings
from django.utils import timezone
from django.utils.text import slugify

from catalog.models import CatalogHistory, Center, PublishStatus
from catalog.public import haversine_km

AUTHOR = 'Coleta CNES'
MOVED_KM = 1.0
SNAPSHOT_FIELDS = ('tipo', 'regra', 'habilitacoes', 'servicos', 'nome', 'endereco', 'telefone', 'lat', 'lng', 'cep', 'codigo_ibge')
TIPO_LABEL = dict(Center.Kind.choices)


def _log(center: Center, acao: str, snapshot: dict | None = None) -> None:
    CatalogHistory.objects.create(
        entidade='centro', objeto_id=str(center.pk), autor=None, autor_nome=AUTHOR, acao=acao, snapshot=snapshot or {}
    )


def _source(competencia: str) -> str:
    return f'CNES/DataSUS · competência {competencia[2:]}/20{competencia[:2]}'


def _extracted_on(canonical: dict):
    raw = canonical.get('collected_at')
    if raw:
        try:
            return datetime.fromisoformat(raw).date()
        except ValueError:
            pass
    return timezone.localdate()


def _unique_slug(name: str, cnes: str) -> str:
    base = (slugify(name)[:48].strip('-') or 'centro') + f'-{cnes}'
    slug, n = base, 2
    while Center.objects.filter(slug=slug).exists():
        slug, n = f'{base}-{n}', n + 1
    return slug


def _moved(a_lat, a_lng, b_lat, b_lng) -> float | None:
    if None in (a_lat, a_lng, b_lat, b_lng):
        return None
    return haversine_km(a_lat, a_lng, b_lat, b_lng)


def _entry_status() -> str:
    return PublishStatus.PUBLICADO if settings.CNES_AUTO_PUBLISH else PublishStatus.RASCUNHO


def _create(item: dict, fonte: str, fonte_data) -> Center:
    center = Center.objects.create(
        slug=_unique_slug(item['nome'], item['cnes']),
        cnes=item['cnes'],
        codigo_ibge=item.get('codigo_ibge', '')[:7],
        nome=item['nome'][:200],
        nome_curto=item['nome'][:80],
        endereco=item.get('endereco', '')[:200],
        cidade=(item.get('cidade') or '')[:100],
        uf=item['uf'],
        tipo=item['tipo'],
        lat=item.get('lat'),
        lng=item.get('lng'),
        telefone=(item.get('telefone') or '')[:20],
        servicos=item.get('servicos', []),
        fonte=fonte,
        fonte_data=fonte_data,
        status=_entry_status(),
        origem=Center.Origin.CNES,
        dados_cnes={key: item.get(key) for key in SNAPSHOT_FIELDS},
    )
    published = center.status == PublishStatus.PUBLICADO
    _log(center, 'Importou e publicou do CNES' if published else 'Importou do CNES como rascunho', center.dados_cnes)
    return center


def _update(center: Center, item: dict, fonte: str, fonte_data, competencia: str) -> bool:
    """Atualiza o que é seguro e devolve True se o centro ficou marcado para revisão."""
    previous = center.dados_cnes or {}
    snapshot = {key: item.get(key) for key in SNAPSHOT_FIELDS}
    published = center.status == PublishStatus.PUBLICADO
    reasons = []

    center.fonte, center.fonte_data = fonte, fonte_data
    center.codigo_ibge = item.get('codigo_ibge', '')[:7] or center.codigo_ibge
    if not center.telefone and item.get('telefone'):
        center.telefone = item['telefone'][:20]
    if center.lat is None and center.lng is None and item.get('lat') is not None:
        center.lat, center.lng = item['lat'], item['lng']

    if item['tipo'] != center.tipo:
        if published:
            reasons.append(f'CNES classifica como {TIPO_LABEL[item["tipo"]].lower()}')
        else:
            center.tipo = item['tipo']

    distance = _moved(center.lat, center.lng, item.get('lat'), item.get('lng'))
    cnes_moved = _moved(previous.get('lat'), previous.get('lng'), item.get('lat'), item.get('lng'))
    if distance is not None and distance > MOVED_KM and (not previous or (cnes_moved or 0) > MOVED_KM / 10):
        reasons.append(f'Coordenada no CNES fica a {distance:.1f} km da publicada'.replace('.', ','))

    if previous and previous.get('habilitacoes') != item.get('habilitacoes'):
        reasons.append('Habilitações mudaram no CNES')

    if center.status == PublishStatus.INATIVO:
        center.status = _entry_status()
        reasons.append(f'Voltou ao recorte do CNES na competência {competencia[2:]}/20{competencia[:2]}')
    elif center.status == PublishStatus.RASCUNHO and settings.CNES_AUTO_PUBLISH:
        center.status = PublishStatus.PUBLICADO

    if reasons:
        center.revisar = True
        center.motivo_revisao = '; '.join(reasons)[:300]
    center.dados_cnes = snapshot
    center.save()
    if reasons or snapshot != previous:
        _log(center, 'Atualizou pelo CNES' + (f' ({center.motivo_revisao})' if reasons else ''), snapshot)
    return bool(reasons)


def apply(canonical: dict) -> dict:
    competencia = canonical['competencia']
    ufs = [uf.upper() for uf in canonical.get('ufs', [])]
    items = canonical.get('establishments', [])
    fonte, fonte_data = _source(competencia), _extracted_on(canonical)
    stats = {'recebidos': len(items), 'novos': 0, 'atualizados': 0, 'revisar': 0, 'inativados': 0, 'manuais_ignorados': 0}
    warnings = []

    seen = set()
    for item in items:
        seen.add(item['cnes'])
        center = Center.objects.filter(cnes=item['cnes']).first()
        if center is None:
            _create(item, fonte, fonte_data)
            stats['novos'] += 1
        elif center.origem == Center.Origin.MANUAL:
            stats['manuais_ignorados'] += 1
        else:
            stats['revisar' if _update(center, item, fonte, fonte_data, competencia) else 'atualizados'] += 1
    stats['publicados'] = Center.objects.filter(origem=Center.Origin.CNES, cnes__in=seen, status=PublishStatus.PUBLICADO).count()

    ufs_with_data = {item['uf'] for item in items}
    for uf in ufs:
        if uf not in ufs_with_data:
            warnings.append(f'{uf}: nenhum estabelecimento no recorte; nada foi despublicado nessa UF por segurança.')
    gone = (
        Center.objects.filter(origem=Center.Origin.CNES, uf__in=ufs_with_data)
        .exclude(cnes__in=seen)
        .exclude(status=PublishStatus.INATIVO)
    )
    for center in gone:
        center.status = PublishStatus.INATIVO
        center.revisar = False
        center.motivo_revisao = f'Saiu do recorte do CNES na competência {competencia[2:]}/20{competencia[:2]}'
        center.save()
        _log(center, f'Despublicou: {center.motivo_revisao}')
        stats['inativados'] += 1
    return {'stats': stats, 'warnings': warnings}
