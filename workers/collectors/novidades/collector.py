"""Novidades sobre medula óssea e células-tronco nos portais que publicam pela API pública do WordPress.

Cada matéria vira só título, resumo, data e link para o original: o texto inteiro não é copiado. No STEM ela
entra como rascunho da categoria Novidades e só aparece no app depois que a liga valida e publica (RS008).

O REDOME só publica sobre medula, então tudo entra. Ameo, SBTMO e Abrale também falam de doação de sangue,
política de saúde e outros cânceres: dali só entra matéria que cita medula, células-tronco ou transplante.
"""

from __future__ import annotations

import html
import json
import logging
import re
import unicodedata
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urlsplit

from workers.collectors.download import RemoteFile, fetch_remote_file

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Portal:
    key: str
    name: str
    base_url: str
    # False: tudo o que o portal publica é sobre o tema.
    filter_by_topic: bool


PORTALS = (
    Portal('redome', 'REDOME/INCA', 'https://redome.inca.gov.br', filter_by_topic=False),
    Portal('ameo', 'Ameo', 'https://ameo.org.br', filter_by_topic=True),
    Portal('sbtmo', 'SBTMO', 'https://sbtmo.org.br', filter_by_topic=True),
    Portal('abrale', 'Abrale', 'https://abrale.org.br', filter_by_topic=True),
)
SOURCE_LABEL = 'Portais REDOME/INCA, Ameo, SBTMO e Abrale (API pública do WordPress)'

# Coleta semanal com janela de 30 dias: uma semana perdida não deixa matéria para trás.
DAYS_BACK = 30
PER_PAGE = 100
# Teto por portal, para uma carga retroativa longa não virar centenas de rascunhos de uma vez.
MAX_PAGES = 5
SUMMARY_LIMIT = 600
# O firewall da Abrale recusa o "Python-urllib" padrão; o robots.txt dos portais libera a API.
USER_AGENT = 'STEM-coletor/0.1 (novidades publicas: titulo, resumo e link)'

# Comparado sem acento e em minúsculas.
TOPIC = re.compile(r'\b(medula|celulas?[- ]tronco|tmo|tcth|transplantes?|redome|hematopoi?et\w*|cordao umbilical)\b')
# "[…]", "Leia mais" e o "…" que alguns temas põem depois do ponto final.
READ_MORE = re.compile(r'\s*(\[(…|\.\.\.)\]|(leia|continue lendo|saiba) mais\.?|(?<=[.!?])…)\s*$', re.I)


def fold(text: str) -> str:
    return unicodedata.normalize('NFD', text).encode('ascii', 'ignore').decode('ascii').lower()


def plain(fragment: str) -> str:
    """HTML do WordPress em texto corrido."""
    without_code = re.sub(r'<(script|style)\b.*?</\1>', ' ', fragment or '', flags=re.S | re.I)
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', without_code))).strip()


def summary(excerpt: str) -> str:
    text = READ_MORE.sub('', plain(excerpt)).strip()
    if len(text) <= SUMMARY_LIMIT:
        return text
    cut = text[:SUMMARY_LIMIT].rsplit(' ', 1)[0].rstrip(' ,;:')
    return f'{cut}…'


def is_on_topic(title: str, text: str) -> bool:
    return bool(TOPIC.search(fold(f'{title} {text}')))


def since_date(competencia: str | None, today: date) -> date:
    """Vazio: últimos ``DAYS_BACK`` dias. AAMM: desde o primeiro dia daquele mês (carga retroativa)."""
    if not competencia:
        return today - timedelta(days=DAYS_BACK)
    if not re.fullmatch(r'\d{2}(0[1-9]|1[0-2])', competencia):
        raise ValueError(f'competência inválida: {competencia!r} (use AAMM, ex.: 2601)')
    return date(2000 + int(competencia[:2]), int(competencia[2:]), 1)


def posts_url(portal: Portal, since: date, page: int) -> str:
    query = {
        'after': f'{since.isoformat()}T00:00:00',
        'per_page': PER_PAGE,
        'page': page,
        'orderby': 'date',
        'order': 'desc',
        '_fields': 'date,link,title,excerpt',
    }
    return f'{portal.base_url}/wp-json/wp/v2/posts?{urlencode(query)}'


def parse_posts(raw: bytes, portal: Portal, since: date) -> tuple[list[dict[str, str]], int]:
    """Itens no tema publicados desde ``since`` e quantos posts a página trouxe."""
    posts = json.loads(raw.decode('utf-8'))
    if not isinstance(posts, list):
        raise RuntimeError(f'{portal.name}: a API não devolveu uma lista de posts ({str(posts)[:200]})')
    host = urlsplit(portal.base_url).hostname
    items = []
    for post in posts:
        try:
            title = plain(post['title']['rendered'])
            published = datetime.fromisoformat(post['date']).date()
            link = post['link']
            excerpt = summary(post.get('excerpt', {}).get('rendered', ''))
        except (KeyError, TypeError, ValueError) as exc:
            raise RuntimeError(f'{portal.name}: post fora do formato da API do WordPress ({exc!r})') from exc
        # A API devolve o link canônico do próprio site; qualquer outro endereço é descartado.
        parts = urlsplit(link)
        if parts.scheme != 'https' or parts.hostname != host or not title:
            logger.warning('%s: post ignorado (link %r, título %r)', portal.name, link, title)
            continue
        # Alguns sites ignoram o filtro "after" quando a resposta vem do cache.
        if published < since:
            continue
        if portal.filter_by_topic and not is_on_topic(title, excerpt):
            continue
        items.append({
            'portal': portal.key,
            'fonte': portal.name,
            'titulo': title,
            'resumo': excerpt,
            'link': link,
            'publicado_em': published.isoformat(),
        })
    return items, len(posts)


def collect_portal(portal: Portal, since: date, raw_dir: Path, raw_files: list[RemoteFile], warnings: list[str]) -> tuple[list[dict], int]:
    items: list[dict] = []
    received = 0
    for page in range(1, MAX_PAGES + 1):
        try:
            file = fetch_remote_file(
                raw_dir / portal.key / f'posts_desde_{since.isoformat()}_p{page}.json',
                posts_url(portal, since, page),
                timeout=60,
                headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'},
            )
        except RuntimeError as exc:
            # Página além da última: o WordPress responde 400 (rest_post_invalid_page_number).
            if page == 1:
                raise
            if 'HTTP Error 400' not in str(exc):
                warnings.append(f'{portal.name}: coleta parou na página {page} ({exc})')
            break
        raw_files.append(file)
        found, count = parse_posts(file.path.read_bytes(), portal, since)
        items += found
        received += count
        if count < PER_PAGE:
            break
    else:
        warnings.append(f'{portal.name}: mais de {MAX_PAGES * PER_PAGE} posts desde {since:%d/%m/%Y}; os mais antigos ficaram de fora')
    return items, received


def collect(competencia: str | None, data_dir: Path, *, portals: tuple[Portal, ...] = PORTALS) -> dict[str, Any]:
    now = datetime.now(UTC)
    since = since_date(competencia or None, now.date())
    raw_dir = data_dir / 'raw' / 'novidades'
    raw_files: list[RemoteFile] = []
    warnings: list[str] = []
    items: list[dict] = []
    summary_by_portal: dict[str, dict[str, Any]] = {}

    for portal in portals:
        try:
            found, received = collect_portal(portal, since, raw_dir, raw_files, warnings)
        except Exception as exc:  # noqa: BLE001
            warnings.append(f'{portal.name}: portal indisponível nesta carga ({exc})')
            summary_by_portal[portal.key] = {'nome': portal.name, 'erro': str(exc)[:300]}
            continue
        logger.info('%s: %s posts desde %s, %s no tema', portal.name, received, since, len(found))
        summary_by_portal[portal.key] = {'nome': portal.name, 'posts': received, 'no_tema': len(found)}
        items += found

    if not any('erro' not in value for value in summary_by_portal.values()):
        raise RuntimeError(f'nenhum portal respondeu: {"; ".join(warnings)}')

    return {
        'source': 'novidades',
        'source_label': SOURCE_LABEL,
        'competencia': now.strftime('%y%m'),
        'desde': since.isoformat(),
        'collected_at': now.isoformat(timespec='seconds'),
        'raw_files': [item.describe() for item in raw_files],
        'portais': summary_by_portal,
        'itens': sorted(items, key=lambda item: item['publicado_em'], reverse=True),
        'warnings': warnings,
    }
