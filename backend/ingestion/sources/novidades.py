"""Aplica a coleta de novidades (REDOME, Ameo, SBTMO, Abrale) na categoria Novidades do módulo Aprender.

Política: com NOVIDADES_AUTO_PUBLISH (padrão), matéria nova entra publicada, sem validação clínica, e um
rascunho coletado antes também é publicado; sem ela, entra como rascunho para a equipe aprovar no painel.
A dispensa vale só para a notícia coletada (categoria Novidades com link original); o app avisa que ela não
passou pela revisão da liga.

A matéria é identificada pelo link original: a que já foi coletada não é recriada nem tem o texto alterado,
e a que a liga removeu (inativo) continua removida.
"""

import re
from datetime import date

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import URLValidator

from catalog.models import CatalogHistory, Content, PublishStatus

COLLECTOR = 'Coleta automática'
TITLE_LIMIT = Content._meta.get_field('titulo').max_length
LINK_LIMIT = Content._meta.get_field('link_original').max_length
SOURCE_LIMIT = Content._meta.get_field('fonte').max_length
is_url = URLValidator(schemes=['https'])


def _text(item: dict, key: str, required: bool = True) -> str:
    value = item.get(key)
    if not isinstance(value, str) or (required and not value.strip()):
        raise ValueError(f'item de novidades sem "{key}": {item!r:.300}')
    return re.sub(r'\s+', ' ', value).strip()


def _cut(text: str, limit: int) -> str:
    return text if len(text) <= limit else f'{text[: limit - 1].rstrip()}…'


def _entry_status() -> str:
    return PublishStatus.PUBLICADO if settings.NOVIDADES_AUTO_PUBLISH else PublishStatus.RASCUNHO


def _news(item: dict) -> dict:
    title = _text(item, 'titulo')
    summary = _text(item, 'resumo', required=False)
    portal = _text(item, 'fonte')
    link = _text(item, 'link')
    try:
        is_url(link)
        published = date.fromisoformat(_text(item, 'publicado_em'))
    except (ValidationError, ValueError) as exc:
        raise ValueError(f'item de novidades com link ou data inválidos: {item!r:.300}') from exc
    if len(link) > LINK_LIMIT:
        raise ValueError(f'link de novidade acima de {LINK_LIMIT} caracteres: {link[:120]}…')
    return {
        'titulo': _cut(title, TITLE_LIMIT),
        # O painel exige descrição para salvar: sem resumo no portal, fica o título.
        'descricao': summary or title,
        'categoria': Content.Category.NOVIDADES,
        'publico_alvo': list(Content.AUDIENCES),
        'fonte': _cut(f'{portal} · Publicado em {published:%d/%m/%Y}', SOURCE_LIMIT),
        'visibilidade': Content.Visibility.PUBLICO,
        'minutos': 1,
        'palavras_chave': _cut(portal, Content._meta.get_field('palavras_chave').max_length),
        'link_original': link,
    }


def _log(content: Content, acao: str) -> None:
    CatalogHistory.objects.create(
        entidade='conteudo',
        objeto_id=str(content.pk),
        autor=None,
        autor_nome=COLLECTOR,
        acao=acao,
        snapshot={'titulo': content.titulo, 'fonte': content.fonte, 'link_original': content.link_original, 'status': content.status},
    )


def apply(canonical: dict) -> dict:
    items = canonical.get('itens')
    if not isinstance(items, list):
        raise ValueError('carga de novidades sem a lista de itens')
    rows = [_news(item) for item in items]

    known = {content.link_original: content for content in Content.objects.filter(link_original__in=[row['link_original'] for row in rows])}
    stats = {'recebidos': len(rows), 'novos': 0, 'ja_coletados': 0, 'rascunhos_publicados': 0, 'novos_por_portal': {}}
    for row in rows:
        content = known.get(row['link_original'])
        portal = row['palavras_chave']
        if content is None:
            content = Content.objects.create(**row, status=_entry_status())
            known[content.link_original] = content
            published = content.status == PublishStatus.PUBLICADO
            _log(content, f'{"Publicou" if published else "Criou o rascunho"} a partir de {portal}')
            stats['novos'] += 1
            stats['novos_por_portal'][portal] = stats['novos_por_portal'].get(portal, 0) + 1
            continue
        stats['ja_coletados'] += 1
        # Rascunho ainda pendente de uma coleta anterior. Inativo (removido pela liga) e publicado ficam como estão.
        if settings.NOVIDADES_AUTO_PUBLISH and content.status == PublishStatus.RASCUNHO and content.is_collected_news:
            content.status = PublishStatus.PUBLICADO
            content.save(update_fields=['status', 'atualizado_em'])
            _log(content, 'Publicou o rascunho coletado')
            stats['rascunhos_publicados'] += 1

    stats['publicacao'] = 'automática' if settings.NOVIDADES_AUTO_PUBLISH else 'aprovação no painel'
    warnings = []
    pending = stats['novos'] if not settings.NOVIDADES_AUTO_PUBLISH else 0
    if pending:
        warnings.append(f'{pending} novidade(s) aguardando aprovação da equipe no painel de conteúdos.')
    return {'stats': stats, 'warnings': warnings}
