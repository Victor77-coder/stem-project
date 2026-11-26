"""RF13: telas do painel — cadastros de centros e campanhas, relatórios agregados, log de ações e pedidos de acesso."""

from datetime import date, timedelta

from rest_framework.test import APIClient

from accounts.models import AccessRequest, Role, User
from catalog.models import CatalogHistory, Center

from .conftest import DONOR

CAMPAIGN = {
    'nome': 'Mutirão de cadastro de doadores',
    'nome_curto': 'Mutirão Hemoal',
    'endereco': 'Av. Jorge de Lima, 58',
    'cidade': 'Maceió',
    'uf': 'AL',
    'tipo': 'campanha',
    'evento_quando': '06/12 · 8h às 16h',
    # Relativa a hoje: com data fixa o teste quebraria quando ela passasse.
    'evento_fim': (date.today() + timedelta(days=10)).isoformat(),
    'fonte': 'Hemoal',
    'fonte_data': '2026-11-20',
    'status': 'publicado',
}


def cnes_center() -> Center:
    return Center.objects.create(
        slug='hemocentro-teste-1234567', cnes='1234567', origem=Center.Origin.CNES, nome='HEMOCENTRO TESTE',
        nome_curto='Hemocentro Teste', endereco='Rua A, 1', cidade='Maceió', uf='AL', tipo='hemocentro',
        fonte='CNES/DataSUS', fonte_data=date(2026, 11, 20), status='publicado', revisar=True, motivo_revisao='Coordenada mudou 2 km',
    )


def test_team_registers_campaigns_and_corrects_cnes_centers(staff_login):
    editor = staff_login('silva_js@email.com', 'senha123')
    created = editor.post('/api/v1/staff/centers/', {**CAMPAIGN, 'origem': 'cnes'}, format='json')
    assert created.status_code == 201, created.data
    assert created.data['origem'] == 'manual' and created.data['slug'].startswith('mutirao-hemoal'), 'o painel só cria cadastro manual, com slug próprio'
    shown = APIClient().get('/api/v1/centros/', {'kind': 'campanha', 'uf': 'AL'}).data['results']
    assert any(item['name'] == CAMPAIGN['nome'] and item['eventWhen'] == CAMPAIGN['evento_quando'] for item in shown)

    center = cnes_center()
    locked = editor.patch(f'/api/v1/staff/centers/{center.pk}/', {'nome': 'Outro nome', 'uf': 'PE'}, format='json')
    assert locked.status_code == 400 and {'nome', 'uf'} <= set(locked.data) and 'telefone' not in locked.data
    fixed = editor.patch(
        f'/api/v1/staff/centers/{center.pk}/',
        {'telefone': '(82) 3315-2102', 'revisar': False, 'motivo_revisao': '', 'nome': center.nome},
        format='json',
    )
    assert fixed.status_code == 200, fixed.data
    center.refresh_from_db()
    assert center.telefone == '(82) 3315-2102' and center.revisar is False
    assert CatalogHistory.objects.filter(entidade='centro', objeto_id=str(center.pk), acao='Editou').exists()


def test_reports_only_count_and_hide_small_groups(api, staff_login):
    for index in range(6):
        api.post('/api/v1/auth/register/', {**DONOR, 'email': f'd{index}@example.com', 'cpf': '', 'uf': 'AL'}, format='json')
    api.post('/api/v1/auth/register/', {**DONOR, 'email': 'r@example.com', 'cpf': '', 'uf': 'AL', 'profile': 'receptor'}, format='json')

    data = staff_login().get('/api/v1/staff/relatorios/').data
    assert data['participantes']['ativos']['doador'] == 6 and data['participantes']['ativos']['receptor'] == 1
    alagoas = next(row for row in data['participantes']['porUf'] if row['uf'] == 'AL')
    assert alagoas['doador'] == 6 and alagoas['receptor'] is None, '1 receptor em AL vira "menos de 5"'
    assert len(data['meses']) == 12 and data['meses'][-1]['novos']['doador'] == 6
    text = str(data)
    assert 'example.com' not in text and DONOR['name'] not in text, 'relatório sem nomes nem e-mails'


def test_action_log_lists_team_actions_with_filters(staff_login):
    admin = staff_login()
    admin.post('/api/v1/staff/centers/', CAMPAIGN, format='json')
    created = admin.post('/api/v1/staff/accounts/', {'nome': 'Nova Pessoa', 'email': 'nova@stem.com'}, format='json')
    assert created.status_code == 201, created.data

    everything = admin.get('/api/v1/staff/logs/').data
    kinds = {item['tipo'] for item in everything['itens']}
    assert {'centro', 'conta'} <= kinds
    accounts = admin.get('/api/v1/staff/logs/', {'tipo': 'conta'}).data['itens']
    assert accounts[0]['acao'] == 'Criou a conta' and accounts[0]['objeto'] == 'Nova Pessoa' and accounts[0]['pessoa'] == 'John Doe'
    assert admin.get('/api/v1/staff/logs/', {'pessoa': 'ninguém'}).data['itens'] == []


def test_admin_approves_or_refuses_access_requests(api, staff_login):
    assert api.post('/api/v1/staff/auth/access-request/', {'email': 'Quero@Liga.org'}, format='json').status_code == 201
    api.post('/api/v1/staff/auth/access-request/', {'email': 'outro@liga.org'}, format='json')

    editor = staff_login('silva_js@email.com', 'senha123')
    assert editor.get('/api/v1/staff/access-requests/').status_code == 403, 'só administradores veem os pedidos'

    admin = staff_login()
    pending = admin.get('/api/v1/staff/access-requests/').data
    assert {item['email'] for item in pending} == {'quero@liga.org', 'outro@liga.org'}
    first = next(item for item in pending if item['email'] == 'quero@liga.org')
    approved = admin.post(f'/api/v1/staff/access-requests/{first["id"]}/aprovar/', {'nome': 'Quero Entrar', 'tipoConta': 'Editor'}, format='json')
    assert approved.status_code == 201, approved.data
    assert approved.data['senhaTemporaria'] and approved.data['pedido']['situacao'] == 'atendido'
    assert User.objects.filter(role=Role.STAFF, email='quero@liga.org').exists()
    again = admin.post(f'/api/v1/staff/access-requests/{first["id"]}/aprovar/', {'nome': 'X'}, format='json')
    assert again.status_code == 400

    other = AccessRequest.objects.get(email='outro@liga.org')
    refused = admin.post(f'/api/v1/staff/access-requests/{other.pk}/recusar/', format='json')
    assert refused.status_code == 200 and refused.data['situacao'] == 'recusado'
    assert refused.data['atendidoPor'] == 'John Doe'
