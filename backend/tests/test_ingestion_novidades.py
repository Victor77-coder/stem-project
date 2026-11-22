import pytest

from catalog.models import CatalogHistory, Content
from ingestion.models import CollectionRun
from ingestion.sources.novidades import audience

URL = '/api/internal/ingest/'
TOKEN = {'HTTP_AUTHORIZATION': 'Bearer test-ingest-token'}
REDOME_LINK = 'https://redome.inca.gov.br/voce-viu-esse-video-do-drauzio-varella/'
SBTMO_LINK = 'https://sbtmo.org.br/conitec-abre-consulta-publica-sobre-tcth-alogenico-de-doador-nao-aparentado-para-linfoma-de-hodgkin/'


def item(link=REDOME_LINK, **overrides):
    return {
        'portal': 'redome',
        'fonte': 'REDOME/INCA',
        'titulo': 'Você viu esse vídeo do Drauzio Varella?',
        'resumo': 'Médico explica a importância de se cadastrar no REDOME e manter os dados atualizados',
        'link': link,
        'publicado_em': '2026-10-26',
        **overrides,
    }


def canonical(*items):
    return {
        'source': 'novidades', 'competencia': '2611', 'desde': '2026-10-11', 'collected_at': '2026-11-10T10:00:00+00:00',
        'raw_files': [{'name': 'posts_desde_2026-10-11_p1.json', 'url': 'https://redome.inca.gov.br/wp-json/wp/v2/posts', 'sha256': 'abc', 'size': 1, 'status': 'downloaded'}],
        'portais': {'redome': {'nome': 'REDOME/INCA', 'posts': len(items), 'no_tema': len(items)}},
        'itens': list(items),
        'warnings': [],
    }


def post(api, data, run_id=None):
    return api.post(URL, {'source': 'novidades', 'run_id': run_id, 'filters': {}, 'canonical': data}, format='json', **TOKEN)


def news():
    return Content.objects.filter(categoria=Content.Category.NOVIDADES).exclude(link_original='')


def public(api, pk):
    return next((entry for entry in api.get('/api/v1/conteudos/').data if entry['id'] == str(pk)), None)


def test_new_items_are_published_without_clinical_validation(api, seeded):
    sbtmo = item(SBTMO_LINK, portal='sbtmo', fonte='SBTMO', titulo='Conitec abre consulta pública sobre TCTH', publicado_em='2026-10-22')
    response = post(api, canonical(item(), sbtmo))
    assert response.status_code == 200, response.json()
    stats = response.json()['stats']
    assert stats['novos'] == 2 and stats['novos_por_portal'] == {'REDOME/INCA': 1, 'SBTMO': 1}
    assert stats['publicacao'] == 'automática'

    content = news().get(link_original=REDOME_LINK)
    assert content.status == 'publicado' and content.validado_por is None
    assert content.fonte == 'REDOME/INCA · Publicado em 26/10/2026'
    assert content.visibilidade == 'Público' and content.publico_alvo == ['Doador', 'Leigo'], 'cadastro no REDOME é tema de doador'
    history = CatalogHistory.objects.get(entidade='conteudo', objeto_id=str(content.pk))
    assert history.autor is None and history.autor_nome == 'Coleta automática' and history.acao == 'Publicou a partir de REDOME/INCA'

    shown = public(api, content.pk)
    assert shown['category'] == 'Novidades' and shown['link'] == REDOME_LINK
    assert shown['automatic'] is True and shown['validated'] == '', 'o app não pode dizer que a liga validou'
    assert CollectionRun.objects.get().warnings == []


@pytest.mark.parametrize(('titulo', 'resumo', 'publico'), [
    ('Doadora conclui doação de medula após contato por e-mail', 'Resposta a e-mail do REDOME muda a vida de doadora e de receptor',
     ['Doador', 'Leigo']),
    ('Conitec abre consulta pública sobre TCTH alogênico de doador não aparentado para Linfoma de Hodgkin',
     'Recomendação favorável à incorporação ao SUS.', ['Receptor', 'Leigo']),
    ('Campanha de cadastro de doadores no hemocentro', '', ['Doador', 'Leigo']),
    ('Pacientes com leucemia ganham novo tratamento', '', ['Receptor', 'Leigo']),
    ('Medula saiu da Alemanha e chegou ao Brasil em menos de 24 horas', 'Confira a reportagem.', ['Doador', 'Receptor', 'Leigo']),
])
def test_news_go_to_the_profile_of_their_topic(titulo, resumo, publico):
    assert audience(titulo, resumo) == publico


def test_profile_filters_news_but_team_correction_survives(api, staff_login):
    donor_news = item()
    recipient_news = item(SBTMO_LINK, portal='sbtmo', fonte='SBTMO', titulo='Conitec abre consulta pública sobre TCTH para linfoma',
                          resumo='Pacientes podem contribuir.')
    post(api, canonical(donor_news, recipient_news))
    by_link = {content.link_original: content for content in news()}

    def shown(perfil):
        listed = api.get('/api/v1/conteudos/', {'categoria': 'Novidades'}).data
        return {entry['link'] for entry in listed if perfil in entry['audience']}

    assert shown('Doador') == {REDOME_LINK}
    assert shown('Receptor') == {SBTMO_LINK}
    assert shown('Leigo') == {REDOME_LINK, SBTMO_LINK}

    editor = staff_login('silva_js@email.com', 'senha123')
    content = by_link[SBTMO_LINK]
    fixed = editor.patch(f'/api/v1/staff/contents/{content.pk}/', {'publicoAlvo': ['Doador', 'Receptor', 'Leigo']}, format='json')
    assert fixed.status_code == 200, fixed.data
    post(api, canonical(donor_news, recipient_news))
    content.refresh_from_db()
    assert content.publico_alvo == ['Doador', 'Receptor', 'Leigo'], 'a coleta não desfaz a correção da equipe'


def test_with_auto_publish_off_items_wait_for_the_team(api, staff_login, settings):
    settings.NOVIDADES_AUTO_PUBLISH = False
    response = post(api, canonical(item()))
    assert response.json()['stats']['publicacao'] == 'aprovação no painel'
    content = news().get()
    assert content.status == 'rascunho' and public(api, content.pk) is None
    assert any('aguardando aprovação' in warning for warning in CollectionRun.objects.get().warnings)

    # Quem não é validador clínico aprova a notícia coletada: ela dispensa a validação.
    editor = staff_login('silva_js@email.com', 'senha123')
    listed = next(entry for entry in editor.get('/api/v1/staff/contents/').data if entry['id'] == str(content.pk))
    assert listed['linkOriginal'] == REDOME_LINK
    approved = editor.patch(f'/api/v1/staff/contents/{content.pk}/', {'status': 'publicado'}, format='json')
    assert approved.status_code == 200, approved.data
    assert public(api, content.pk)['automatic'] is True


def test_pending_draft_is_published_by_the_next_collection(api, seeded, settings):
    settings.NOVIDADES_AUTO_PUBLISH = False
    post(api, canonical(item()))
    settings.NOVIDADES_AUTO_PUBLISH = True
    response = post(api, canonical(item()))
    assert response.json()['stats'] == {
        'recebidos': 1, 'novos': 0, 'ja_coletados': 1, 'rascunhos_publicados': 1, 'novos_por_portal': {}, 'publicacao': 'automática',
    }
    assert news().get().status == 'publicado'


def test_team_edits_and_removals_survive_new_collections(api, staff_login):
    post(api, canonical(item()))
    content = news().get()
    editor = staff_login('silva_js@email.com', 'senha123')
    edited = editor.patch(f'/api/v1/staff/contents/{content.pk}/', {'titulo': 'Título revisado pela liga'}, format='json')
    assert edited.status_code == 200, edited.data
    assert edited.data['status'] == 'publicado', 'editar a notícia coletada não exige validação'

    response = post(api, canonical(item(titulo='Título do portal mudou')))
    assert response.json()['stats']['novos'] == 0
    content.refresh_from_db()
    assert content.titulo == 'Título revisado pela liga'

    removed = staff_login().post(f'/api/v1/staff/contents/{content.pk}/despublicar/', {'senha': 'admin123'}, format='json')
    assert removed.status_code == 200
    post(api, canonical(item()))
    content.refresh_from_db()
    assert content.status == 'inativo' and news().count() == 1


def test_moving_collected_news_to_another_category_requires_validation(api, staff_login):
    post(api, canonical(item()))
    content = news().get()
    editor = staff_login('silva_js@email.com', 'senha123')
    response = editor.patch(f'/api/v1/staff/contents/{content.pk}/', {'categoria': 'Doenças'}, format='json')
    assert response.status_code == 400 and 'validacaoClinica' in response.data
    content.refresh_from_db()
    assert content.categoria == 'Novidades' and content.status == 'publicado'


def test_long_titles_are_cut_and_missing_summary_falls_back_to_title(api, seeded):
    response = post(api, canonical(item(titulo='Transplante ' * 30, resumo='')))
    assert response.status_code == 200, response.json()
    content = news().get()
    assert len(content.titulo) == 200 and content.titulo.endswith('…')
    assert content.descricao == ('Transplante ' * 30).strip()


def test_bad_item_rejects_the_whole_load(api, seeded):
    response = post(api, canonical(item(), item('http://sem-https.example/x')))
    assert response.status_code == 500
    assert news().count() == 0, 'a carga é atômica'
    assert CollectionRun.objects.get().status == CollectionRun.Status.ERRO

    response = post(api, canonical(item(publicado_em='26/10/2026')))
    assert response.status_code == 500 and 'data inválidos' in response.json()['detail']


def test_admin_triggers_news_collection(staff_login, monkeypatch):
    from ingestion import tasks

    calls = []
    monkeypatch.setattr(tasks, 'start_flow_run', lambda deployment, parameters: calls.append((deployment, parameters)) or 'flow-run-7')
    response = staff_login().post('/api/v1/staff/collections/', {'source': 'novidades', 'competencia': '2601'}, format='json')
    assert response.status_code == 202, response.data
    assert calls[0][0] == 'stem.collect/novidades-portais'
    assert calls[0][1]['source'] == 'novidades' and calls[0][1]['competencia'] == '2601'
