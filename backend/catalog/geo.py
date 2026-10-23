import json
import re
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.core.cache import cache

BRASILAPI_URL = 'https://brasilapi.com.br/api/cep/v2/{cep}'
NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
USER_AGENT = 'CelulAI/1.0 (STEM Project)'
TIMEOUT_SECONDS = 4
# CEP e centroide de cidade quase nunca mudam; o cache também segura o limite de 1 req/s do Nominatim.
CACHE_SECONDS = 30 * 24 * 3600


def _get_json(url: str):
    request = Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'application/json'})
    with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode('utf-8'))


def _coordinate(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _brasilapi(cep: str) -> dict | None:
    try:
        data = _get_json(BRASILAPI_URL.format(cep=cep))
    except (OSError, ValueError):
        return None
    coordinates = ((data.get('location') or {}).get('coordinates')) or {}
    return {
        'cep': cep,
        'address': data.get('street') or '',
        'district': data.get('neighborhood') or '',
        'city': data.get('city') or '',
        'uf': data.get('state') or '',
        'lat': _coordinate(coordinates.get('latitude')),
        'lng': _coordinate(coordinates.get('longitude')),
    }


def _nominatim(city: str, uf: str) -> tuple[float, float] | None:
    query = urlencode({'city': city, 'state': uf, 'country': 'Brasil', 'format': 'json', 'limit': 1})
    try:
        results = _get_json(f'{NOMINATIM_URL}?{query}')
    except (OSError, ValueError):
        return None
    if not results:
        return None
    lat, lng = _coordinate(results[0].get('lat')), _coordinate(results[0].get('lon'))
    return (lat, lng) if lat is not None and lng is not None else None


def city_point(city: str, uf: str) -> tuple[float, float] | None:
    key = f'geo:cidade:{uf.upper()}:{city.lower()}'
    point = cache.get(key)
    if point is None:
        point = _nominatim(city, uf)
        if point is not None:
            cache.set(key, point, CACHE_SECONDS)
    return tuple(point) if point else None


def normalize_cep(value: str) -> str | None:
    digits = re.sub(r'\D', '', value or '')
    return digits if len(digits) == 8 else None


def locate_cep(cep: str) -> dict | None:
    """Endereço e coordenadas do CEP. Sem coordenada no CEP, usa o centro da cidade (precision='cidade')."""
    key = f'geo:cep:{cep}'
    found = cache.get(key)
    if found is not None:
        return found
    found = _brasilapi(cep)
    if found is None or not found['city']:
        return None
    if found['lat'] is not None and found['lng'] is not None:
        found['precision'] = 'cep'
    else:
        point = city_point(found['city'], found['uf'])
        if point is None:
            return None
        found['lat'], found['lng'] = point
        found['precision'] = 'cidade'
    cache.set(key, found, CACHE_SECONDS)
    return found
