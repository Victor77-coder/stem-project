"""RF10/RS008: campanha tem data de término; encerrada ou sem data, não aparece no app como se estivesse valendo."""
from datetime import date, timedelta

import pytest
from django.utils import timezone

from catalog.models import Center

pytestmark = pytest.mark.django_db

MACEIO = {'lat': -9.6658, 'lng': -35.735}


def campaign(slug: str, end: date | None) -> Center:
    return Center.objects.create(
        slug=slug, nome=f'Campanha {slug}', nome_curto=slug, endereco='Av. Jorge de Lima, 58', cidade='Maceió', uf='AL',
        tipo=Center.Kind.CAMPANHA, lat=-9.6724, lng=-35.7578, evento_quando='Sábado · 8h às 16h', evento_fim=end,
        fonte='Hemoal', fonte_data=date(2026, 11, 20), status='publicado',
    )


def shown(api, **params) -> set[str]:
    return {item['id'] for item in api.get('/api/v1/centros/', {'kind': 'campanha', **params}).data['results']}


def test_only_campaigns_still_running_are_shown(api, db):
    today = timezone.localdate()
    campaign('futura', today + timedelta(days=10))
    campaign('hoje', today)
    campaign('encerrada', today - timedelta(days=1))
    campaign('sem-data', None)
    assert shown(api) == {'futura', 'hoje'}, 'termina hoje ainda vale; encerrada e sem data de término somem'
    assert shown(api, **MACEIO) == {'futura', 'hoje'}, 'vale também para a busca por distância'


def test_ended_campaign_detail_is_not_found(api, db):
    campaign('encerrada', timezone.localdate() - timedelta(days=1))
    assert api.get('/api/v1/centros/encerrada/').status_code == 404


def test_seeded_campaign_of_october_is_over(api, seeded):
    assert shown(api, uf='AL') == set(), 'o mutirão de 25/out do seed já terminou'


def test_panel_requires_the_end_date_to_publish_a_campaign(staff_login):
    admin = staff_login()
    body = {
        'nome': 'Mutirão de cadastro', 'nome_curto': 'Mutirão', 'endereco': 'Av. Jorge de Lima, 58', 'cidade': 'Maceió',
        'uf': 'AL', 'tipo': 'campanha', 'evento_quando': 'Sábado · 8h às 16h', 'fonte': 'Hemoal',
        'fonte_data': '2026-11-20', 'status': 'publicado',
    }
    refused = admin.post('/api/v1/staff/centers/', body, format='json')
    assert refused.status_code == 400 and 'evento_fim' in refused.data

    end = (timezone.localdate() + timedelta(days=10)).isoformat()
    assert admin.post('/api/v1/staff/centers/', {**body, 'evento_fim': end}, format='json').status_code == 201
    draft = admin.post('/api/v1/staff/centers/', {**body, 'nome_curto': 'Rascunho', 'status': 'rascunho'}, format='json')
    assert draft.status_code == 201, 'rascunho pode ficar sem data'
