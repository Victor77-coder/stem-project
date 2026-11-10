from datetime import date
from decimal import Decimal

from django.core.management import call_command

from catalog.models import Statistic
from catalog.public import REGION_OF
from ingestion.models import CollectionRun

URL = '/api/internal/ingest/'
TOKEN = {'HTTP_AUTHORIZATION': 'Bearer test-ingest-token'}
SEED_DATE = date(2026, 8, 1)

# Valores reais do Tabnet (SIH/SUS, internações por TCTH, por UF de residência do paciente).
TABNET = {
    '2024': {'RO': 24, 'AC': 17, 'AM': 26, 'RR': 1, 'PA': 40, 'AP': 7, 'TO': 30, 'MA': 17, 'PI': 32, 'CE': 122, 'RN': 82, 'PB': 58,
             'PE': 136, 'AL': 49, 'SE': 24, 'BA': 150, 'MG': 403, 'ES': 56, 'RJ': 158, 'SP': 889, 'PR': 294, 'SC': 148, 'RS': 173,
             'MS': 23, 'MT': 31, 'GO': 92, 'DF': 96},
    '2025': {'RO': 31, 'AC': 5, 'AM': 26, 'RR': 8, 'PA': 35, 'AP': 13, 'TO': 20, 'MA': 42, 'PI': 48, 'CE': 134, 'RN': 96, 'PB': 70,
             'PE': 140, 'AL': 51, 'SE': 9, 'BA': 136, 'MG': 406, 'ES': 45, 'RJ': 167, 'SP': 909, 'PR': 298, 'SC': 136, 'RS': 181,
             'MS': 30, 'MT': 43, 'GO': 93, 'DF': 86},
}
# Valores reais do painel do REDOME (doadores cadastrados por UF no ano, filtro "Ano" do painel).
DONORS = {
    '2024': {'AC': 823, 'AL': 3806, 'AM': 489, 'AP': 822, 'BA': 8825, 'CE': 6047, 'DF': 2799, 'ES': 5143, 'GO': 5261,
             'MA': 2391, 'MG': 16588, 'MS': 4155, 'MT': 1198, 'PA': 2865, 'PB': 5475, 'PE': 6347, 'PI': 2214, 'PR': 7813,
             'RJ': 6034, 'RN': 1710, 'RO': 4057, 'RR': 444, 'RS': 3982, 'SC': 5734, 'SE': 3045, 'SP': 27999, 'TO': 2635},
    '2025': {'AC': 628, 'AL': 2454, 'AM': 476, 'AP': 835, 'BA': 8719, 'CE': 8792, 'DF': 2973, 'ES': 4641, 'GO': 5219,
             'MA': 2417, 'MG': 17332, 'MS': 4241, 'MT': 1152, 'PA': 3172, 'PB': 5103, 'PE': 5651, 'PI': 2193, 'PR': 7735,
             'RJ': 5675, 'RN': 2714, 'RO': 3594, 'RR': 471, 'RS': 4858, 'SC': 6028, 'SE': 3160, 'SP': 35907, 'TO': 2477},
}
NOT_INFORMED = {'2024': 0, '2025': 1}


def canonical(years=('2024', '2025'), redome=True, collected_at='2026-11-10T10:00:00+00:00', bump=0, sem_uf=None):
    by_uf = {uf: {year: TABNET[year].get(uf, 0) for year in years} for uf in REGION_OF}
    by_uf['SP'][years[-1]] += bump
    return {
        'source': 'tcth', 'competencia': f'{years[-1][2:]}12', 'publicado_ate': '2608', 'collected_at': collected_at,
        'raw_files': [{'name': 'tcth_uf_2024-2025.html', 'url': 'http://tabnet', 'sha256': 'abc', 'size': 1, 'status': 'downloaded'}],
        'transplantes': {
            'conteudo': 'Internações', 'procedimentos': ['0505010011'], 'anos': list(years), 'por_uf': by_uf,
            'sem_uf': sem_uf or {year: 0 for year in years},
        },
        'redome': {
            'anos': list(years),
            'doadores': {year: sum(DONORS[year].values()) + NOT_INFORMED[year] for year in years},
            'por_uf': {uf: {year: DONORS[year][uf] for year in years} for uf in REGION_OF},
            'uf_nao_informada': {year: NOT_INFORMED[year] for year in years}, 'codigos_fora_das_ufs': [],
        } if redome else None,
        'warnings': [],
    }


def post(api, data, run_id=None):
    return api.post(URL, {'source': 'tcth', 'run_id': run_id, 'filters': {}, 'canonical': data}, format='json', **TOKEN)


def latest(indicator, recorte, period):
    return Statistic.objects.filter(indicador=indicator, recorte=recorte, periodo=period).order_by('-data_extracao').first()


def test_collection_feeds_national_regional_and_uf_indicators(api, seeded):
    response = post(api, canonical())
    assert response.status_code == 200, response.json()
    stats = response.json()['stats']
    assert stats['recebidos'] == 2 * (1 + 27 + 5) * 2, 'transplantes e doadores, 2 anos cada'
    assert stats['anos'] == ['2024', '2025']

    brasil = latest('transplantes', 'BR', '2025')
    assert brasil.valor == Decimal(3258) and brasil.rotulo == '3.258'
    assert brasil.fonte == 'DataSUS/Tabnet (SIH/SUS, por residência)' and brasil.aviso_subnotificacao
    assert brasil.data_extracao == date(2026, 11, 10)
    assert latest('transplantes', 'SP', '2025').valor == 909
    assert latest('transplantes', 'AL', '2025').valor == 51, 'alagoanos transplantados, mesmo fora de AL'
    assert latest('transplantes_regiao', 'Nordeste', '2025').valor == 726
    regions = sum(latest('transplantes_regiao', name, '2025').valor for name in ('Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'))
    assert regions == brasil.valor

    donors = latest('doadores', 'BR', '2025')
    assert donors.valor == 148_618 and donors.rotulo == '148.618', 'cadastros no ano, número completo como no painel'
    assert donors.fonte == 'REDOME/INCA (painel de doadores)' and not donors.aviso_subnotificacao
    assert latest('doadores', 'AL', '2025').rotulo == '2.454', 'painel: Alagoas, Ano 2025'
    assert latest('doadores', 'AL', '2024').rotulo == '3.806'
    assert latest('doadores', 'Nordeste', '2025').valor == sum(
        DONORS['2025'][uf] for uf in ('AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE')
    )
    assert donors.valor - sum(DONORS['2025'].values()) == NOT_INFORMED['2025'], 'Brasil inclui quem está sem UF'

    run = CollectionRun.objects.get()
    assert run.status == CollectionRun.Status.SUCESSO and run.competencia == '2512'


def test_seed_examples_leave_collected_indicators_and_do_not_come_back(api, seeded):
    response = post(api, canonical())
    assert response.json()['stats']['exemplos_removidos'] > 0
    for indicator in ('transplantes', 'transplantes_regiao', 'doadores'):
        assert not Statistic.objects.filter(indicador=indicator, data_extracao=SEED_DATE).exists(), indicator
    assert Statistic.objects.filter(indicador='espera', data_extracao=SEED_DATE).exists(), 'espera não tem fonte coletada'

    call_command('seed_mvp', verbosity=0)
    assert not Statistic.objects.filter(indicador='transplantes', data_extracao=SEED_DATE).exists()


def test_public_statistics_show_collected_numbers(api, seeded):
    post(api, canonical())
    data = api.get('/api/v1/estatisticas/', {'uf': 'PE'}).data
    assert data['years'] == ['2025', '2024']
    assert data['year'] == '2025'
    assert data['headline'] == {'donors': '5.651', 'transplants': '140'}, 'os dois cartões seguem a UF e o ano'
    assert data['region'] == 'Nordeste' and data['wait']
    assert {item['name']: item['value'] for item in data['regions']}['Sudeste'] == 909 + 406 + 167 + 45
    assert 'DataSUS/Tabnet (SIH/SUS, por residência)' in data['source'] and 'REDOME/INCA (painel de doadores)' in data['source']
    assert data['extractedAt'] == '10/11/2026'
    assert data['underreporting'] is True

    alagoas = api.get('/api/v1/estatisticas/', {'ano': '2024', 'uf': 'AL'}).data
    assert alagoas['headline'] == {'donors': '3.806', 'transplants': '49'}, 'os dois cartões seguem o ano'
    assert api.get('/api/v1/estatisticas/', {'ano': '2025', 'uf': 'AL'}).data['headline']['donors'] == '2.454'

    brasil = api.get('/api/v1/estatisticas/', {'uf': 'BR'}).data
    assert brasil['headline'] == {'donors': '148.618', 'transplants': '3.258'}
    assert brasil['region'] is None and brasil['wait'] == '', 'tempo de espera só existe por região'
    assert 'DataSUS/Tabnet e REDOME' not in brasil['source'], 'sem o exemplo de espera, a fonte é só a coletada'


def test_patients_without_residence_uf_count_only_for_brasil(api, seeded):
    post(api, canonical(sem_uf={'2024': 0, '2025': 3}))
    assert latest('transplantes', 'BR', '2025').valor == 3258 + 3
    regions = sum(latest('transplantes_regiao', name, '2025').valor for name in ('Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'))
    assert regions == 3258


def test_revisions_are_counted_and_the_newest_extraction_wins(api, seeded):
    post(api, canonical())
    same_day = post(api, canonical()).json()['stats']
    assert same_day['novos'] == 0 and same_day['alterados'] == 0

    revised = post(api, canonical(collected_at='2026-12-20T10:00:00+00:00', bump=4)).json()['stats']
    assert revised['alterados'] == 3, 'SP, Sudeste e Brasil de 2025 mudaram'
    assert latest('transplantes', 'BR', '2025').valor == 3262
    assert Statistic.objects.filter(indicador='transplantes', recorte='BR', periodo='2025').count() == 2, 'histórico preservado'
    assert api.get('/api/v1/estatisticas/').data['headline']['transplants'] == '3.262'


def test_redome_outage_keeps_previous_donor_total(api, seeded):
    post(api, canonical())
    response = post(api, canonical(redome=False, collected_at='2026-12-20T10:00:00+00:00'))
    assert response.status_code == 200
    assert any(warning.startswith('REDOME:') for warning in CollectionRun.objects.first().warnings)
    assert api.get('/api/v1/estatisticas/', {'uf': 'BR'}).data['headline']['donors'] == '148.618'


def test_donors_without_years_are_rejected(api, seeded):
    data = canonical()
    data['redome'] = {'doadores': 6_183_908}
    response = post(api, data)
    assert response.status_code == 500 and 'doadores sem anos' in response.json()['detail']


def test_donors_of_another_year_are_not_reused(api, seeded):
    data = canonical()
    data['redome']['anos'] = ['2025']
    post(api, data)
    assert api.get('/api/v1/estatisticas/', {'ano': '2024', 'uf': 'AL'}).data['headline']['donors'] == '', 'sem dado do ano, o app mostra —'


def test_donors_missing_a_uf_are_rejected(api, seeded):
    data = canonical()
    del data['redome']['por_uf']['AC']
    response = post(api, data)
    assert response.status_code == 500 and 'doadores' in response.json()['detail']


def test_payload_missing_ufs_is_rejected_without_partial_writes(api, seeded):
    data = canonical()
    del data['transplantes']['por_uf']['SP']
    before = Statistic.objects.count()
    response = post(api, data)
    assert response.status_code == 500
    assert 'SP' in response.json()['detail']
    assert Statistic.objects.count() == before
    assert CollectionRun.objects.get().status == CollectionRun.Status.ERRO


def test_admin_triggers_tcth_collection(staff_login, monkeypatch):
    from ingestion import tasks

    calls = []
    monkeypatch.setattr(tasks, 'start_flow_run', lambda deployment, parameters: calls.append((deployment, parameters)) or 'flow-run-9')
    response = staff_login().post('/api/v1/staff/collections/', {'source': 'tcth'}, format='json')
    assert response.status_code == 202, response.data
    assert calls[0][0] == 'stem.collect/tcth-estatisticas'
    assert calls[0][1]['source'] == 'tcth'
