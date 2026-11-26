"""Jornada como guia pessoal (RF05/RF06): o próprio titular marca as etapas que já fez."""
import json

import pytest
from django.core import mail
from rest_framework.test import APIClient

from engagement.models import JourneyProgress

from .conftest import DONOR, auth

pytestmark = pytest.mark.django_db


def test_guide_starts_with_nothing_marked(donor):
    client = auth(APIClient(), donor['access'])
    assert client.get('/api/v1/me/journey/').data == {'kind': 'doador', 'done': [], 'checklist': {}, 'region': 'maceio'}


def test_any_step_can_be_marked_and_unmarked(donor):
    client = auth(APIClient(), donor['access'])
    response = client.patch('/api/v1/me/journey/', {'done': ['redome', 'cadastro']}, format='json')
    assert response.status_code == 200, response.data
    assert response.data['done'] == ['cadastro', 'redome'], 'volta na ordem das etapas, sem exigir sequência'

    response = client.patch('/api/v1/me/journey/', {'done': ['redome']}, format='json')
    assert response.data['done'] == ['redome']
    assert client.get('/api/v1/me/journey/').data['done'] == ['redome']


def test_only_steps_of_the_own_profile_are_accepted(donor):
    client = auth(APIClient(), donor['access'])
    response = client.patch('/api/v1/me/journey/', {'done': ['cadastro', 'transplante']}, format='json')
    assert response.status_code == 400
    assert 'transplante' in str(response.data['done'])
    assert client.patch('/api/v1/me/journey/', {'checklist': {'busca': ['x']}}, format='json').status_code == 400


def test_checklist_and_region_are_saved(donor):
    client = auth(APIClient(), donor['access'])
    body = {'checklist': {'cadastro': ['Documento oficial com foto', 'Documento oficial com foto'], 'coleta': []}, 'region': 'recife'}
    response = client.patch('/api/v1/me/journey/', body, format='json')
    assert response.status_code == 200, response.data
    assert response.data['checklist'] == {'cadastro': ['Documento oficial com foto']}, 'sem repetidos nem listas vazias'
    assert response.data['region'] == 'recife'


def test_marks_sent_close_together_do_not_overwrite_each_other(donor):
    """Item do checklist e "marcar concluída" em sequência rápida: um PATCH não apaga o que o outro gravou."""
    from engagement.views import JourneySerializer

    client = auth(APIClient(), donor['access'])
    stale = JourneyProgress.objects.get()  # lido antes do PATCH do checklist, como num pedido concorrente
    saved = client.patch('/api/v1/me/journey/', {'checklist': {'cadastro': ['Documento oficial com foto']}}, format='json')
    assert saved.status_code == 200, saved.data

    concurrent = JourneySerializer(stale, data={'done': ['cadastro']}, partial=True, context={'kind': 'doador'})
    concurrent.is_valid(raise_exception=True)
    concurrent.save()

    marks = client.get('/api/v1/me/journey/').data
    assert marks['done'] == ['cadastro']
    assert marks['checklist'] == {'cadastro': ['Documento oficial com foto']}, 'o PATCH da etapa não regrava o checklist'


def test_guest_has_no_guide_to_fill(api, seeded):
    created = api.post(
        '/api/v1/auth/register/',
        {'profile': 'convidado', 'email': 'leitor@example.com', 'tcleAccepted': True, 'tcleVersion': '1.1'},
        format='json',
    )
    assert created.status_code == 201, created.data
    client = auth(APIClient(), created.data['access'])
    assert client.get('/api/v1/me/journey/').data['kind'] == 'convidado'
    assert client.patch('/api/v1/me/journey/', {'done': ['cadastro']}, format='json').status_code == 400


def test_switching_profile_starts_a_new_guide(donor):
    client = auth(APIClient(), donor['access'])
    client.patch('/api/v1/me/journey/', {'done': ['cadastro'], 'checklist': {'cadastro': ['Documento oficial com foto']}}, format='json')
    assert client.post('/api/v1/me/profile/', {'profile': 'receptor'}, format='json').status_code == 200
    journey = client.get('/api/v1/me/journey/').data
    assert (journey['kind'], journey['done'], journey['checklist']) == ('receptor', [], {})


def test_deactivation_erases_the_marks(donor):
    client = auth(APIClient(), donor['access'])
    client.patch('/api/v1/me/journey/', {'done': ['cadastro'], 'checklist': {'cadastro': ['Documento oficial com foto']}}, format='json')
    assert client.post('/api/v1/me/deactivate/', {'password': DONOR['password']}, format='json').status_code == 204
    progress = JourneyProgress.objects.get()
    assert (progress.done, progress.checklist) == ([], {})


def test_export_includes_the_guide(donor):
    client = auth(APIClient(), donor['access'])
    client.patch('/api/v1/me/journey/', {'done': ['cadastro']}, format='json')
    mail.outbox.clear()
    assert client.post('/api/v1/me/export/').status_code == 202
    exported = json.loads(mail.outbox[0].attachments[0][1])
    assert exported['journey'] == {'region': 'maceio', 'done': ['cadastro'], 'checklist': {}}


def test_step_added_in_panel_can_be_marked(donor):
    from catalog.models import JourneyStep
    JourneyStep.objects.create(jornada='doador', slug='nova-etapa', ordem=99, titulo='Nova', titulo_curto='Nova',
                               resumo='Resumo.', corpo='Corpo.', fonte='INCA', status='publicado')
    client = auth(APIClient(), donor['access'])
    response = client.patch('/api/v1/me/journey/', {'done': ['nova-etapa', 'cadastro']}, format='json')
    assert response.status_code == 200, response.data
    assert response.data['done'] == ['cadastro', 'nova-etapa']


def test_only_admins_publish_or_change_official_steps(staff_login):
    from catalog.models import JourneyStep
    editor = staff_login('silva_js@email.com', 'senha123')
    published = JourneyStep.objects.get(jornada='doador', slug='cadastro')
    assert editor.patch(f'/api/v1/staff/journeys/{published.pk}/', {'titulo': 'Outro'}, format='json').status_code == 403
    body = {'jornada': 'doador', 'slug': 'rascunho', 'ordem': 50, 'titulo': 'T', 'titulo_curto': 'T',
            'resumo': 'R', 'corpo': 'C', 'fonte': 'INCA'}
    draft = editor.post('/api/v1/staff/journeys/', {**body, 'status': 'rascunho'}, format='json')
    assert draft.status_code == 201, draft.data
    assert editor.patch(f'/api/v1/staff/journeys/{draft.data["id"]}/', {'status': 'publicado'}, format='json').status_code == 403
    admin = staff_login()
    assert admin.patch(f'/api/v1/staff/journeys/{draft.data["id"]}/', {'status': 'publicado'}, format='json').status_code == 200


def test_public_journey_serves_panel_steps_with_region_summary(api, seeded):
    steps = api.get('/api/v1/jornadas/receptor/?regiao=recife').data
    assert [step['id'] for step in steps][:2] == ['indicacao', 'encaminhamento']
    assert 'Recife tem centros habilitados' in steps[1]['summary']
    assert all(step['source'] and step['updatedAt'] for step in steps)
