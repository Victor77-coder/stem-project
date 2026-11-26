"""RF009: cidade digitada vira ponto de origem para /centros em qualquer UF, não só Maceió e Recife."""
from datetime import date

import pytest

from catalog import geo
from catalog.models import Center

from .test_staff_and_catalog import fake_remote

pytestmark = pytest.mark.django_db

SALVADOR = [{'lat': '-12.9711', 'lon': '-38.5108'}]


def center(slug: str, cidade: str, uf: str, lat: float, lng: float, status: str = 'publicado') -> Center:
    return Center.objects.create(
        slug=slug, nome=slug, nome_curto=slug, endereco='Endereço', cidade=cidade, uf=uf, tipo='hemocentro',
        lat=lat, lng=lng, fonte='CNES/DataSUS', fonte_data=date(2026, 10, 1), status=status,
    )


def test_city_with_uf_uses_the_geocoder(api, monkeypatch):
    get_json, calls = fake_remote({geo.NOMINATIM_URL: SALVADOR})
    monkeypatch.setattr(geo, '_get_json', get_json)
    data = api.get('/api/v1/geo/cidade/', {'nome': 'Salvador', 'uf': 'ba'}).data
    assert data == {'city': 'Salvador', 'uf': 'BA', 'lat': -12.9711, 'lng': -38.5108, 'precision': 'cidade'}
    assert 'state=BA' in calls[0]


def test_city_without_uf_takes_it_from_the_centers(api, monkeypatch):
    center('hemoba', 'Salvador', 'BA', -12.99, -38.51)
    get_json, calls = fake_remote({geo.NOMINATIM_URL: SALVADOR})
    monkeypatch.setattr(geo, '_get_json', get_json)
    data = api.get('/api/v1/geo/cidade/', {'nome': '  salvador '}).data
    assert (data['city'], data['uf']) == ('Salvador', 'BA'), 'nome e UF como estão no cadastro do centro'
    assert 'state=BA' in calls[0]


def test_accents_and_uf_typed_with_the_name(api, monkeypatch):
    center('hemoal-arapiraca', 'Arapiraca', 'AL', -9.75, -36.66)
    center('hupaa', 'Maceió', 'AL', -9.55, -35.77)
    get_json, _ = fake_remote({geo.NOMINATIM_URL: [{'lat': '-9.66', 'lon': '-35.73'}]})
    monkeypatch.setattr(geo, '_get_json', get_json)
    assert api.get('/api/v1/geo/cidade/', {'nome': 'maceio'}).data['city'] == 'Maceió'
    for typed in ('Feira de Santana, BA', 'Feira de Santana/BA', 'Feira de Santana - ba'):
        found = api.get('/api/v1/geo/cidade/', {'nome': typed}).data
        assert (found['city'], found['uf']) == ('Feira de Santana', 'BA'), typed


def test_geocoder_down_falls_back_to_the_centers_of_the_city(api, monkeypatch):
    center('a', 'Salvador', 'BA', -12.0, -38.0)
    center('b', 'Salvador', 'BA', -13.0, -39.0)
    get_json, _ = fake_remote({geo.NOMINATIM_URL: OSError('fora do ar')})
    monkeypatch.setattr(geo, '_get_json', get_json)
    data = api.get('/api/v1/geo/cidade/', {'nome': 'Salvador'}).data
    assert (data['lat'], data['lng']) == (-12.5, -38.5), 'centro dos centros da cidade (RNF08)'


def test_unknown_or_too_short(api, monkeypatch):
    center('rascunho', 'Ilhéus', 'BA', -14.79, -39.04, status='rascunho')
    get_json, _ = fake_remote({geo.NOMINATIM_URL: []})
    monkeypatch.setattr(geo, '_get_json', get_json)
    assert api.get('/api/v1/geo/cidade/', {'nome': 'ab'}).status_code == 400
    missing = api.get('/api/v1/geo/cidade/', {'nome': 'Cidade Que Não Existe'})
    assert missing.status_code == 404 and 'CEP' in missing.data['detail']
    assert api.get('/api/v1/geo/cidade/', {'nome': 'Ilhéus'}).status_code == 404, 'só centro publicado diz a UF'
    assert api.get('/api/v1/geo/cidade/', {'nome': 'Lugar Nenhum', 'uf': 'BA'}).status_code == 404
