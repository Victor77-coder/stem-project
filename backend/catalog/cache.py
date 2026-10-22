import uuid
from collections.abc import Callable

from django.core.cache import cache
from rest_framework.response import Response

VERSION_KEY = 'catalog:version'
# Teto de desatualização se o Redis estiver fora no momento de uma publicação e a troca de versão se perder.
TTL_SECONDS = 300


def _version() -> str:
    current = cache.get(VERSION_KEY)
    if current is None:
        cache.add(VERSION_KEY, uuid.uuid4().hex, None)
        current = cache.get(VERSION_KEY) or 'sem-cache'
    return current


def invalidate() -> None:
    cache.set(VERSION_KEY, uuid.uuid4().hex, None)


def cached_response(request, build: Callable[[], object]) -> Response:
    """Catálogo público com cache. Sem Redis, `get` devolve None e a resposta sai direto do Postgres."""
    audience = 'p' if getattr(request.user, 'is_authenticated', False) and request.user.is_participant else 'a'
    key = f'catalog:{_version()}:{audience}:{request.get_full_path()}'
    data = cache.get(key)
    if data is None:
        data = build()
        cache.set(key, data, TTL_SECONDS)
    return Response(data)
