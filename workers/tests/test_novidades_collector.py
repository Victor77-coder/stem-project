import json
from datetime import date
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest

from workers.collectors import download
from workers.collectors.novidades import collector
from workers.collectors.novidades.collector import PORTALS, is_on_topic, parse_posts, posts_url, since_date, summary

FIXTURES = Path(__file__).parent / 'fixtures' / 'novidades'
# Respostas reais de /wp-json/wp/v2/posts (REDOME: só medula; Abrale: 1 matéria de TMO e 2 de outros assuntos).
REDOME_POSTS = (FIXTURES / 'redome_posts.json').read_bytes()
ABRALE_POSTS = (FIXTURES / 'abrale_posts.json').read_bytes()
REDOME, AMEO, SBTMO, ABRALE = PORTALS
SINCE = date(2026, 8, 1)


def test_redome_posts_all_enter_with_title_summary_date_and_link():
    items, received = parse_posts(REDOME_POSTS, REDOME, SINCE)
    assert received == 3 and len(items) == 3
    first = items[0]
    assert first == {
        'portal': 'redome',
        'fonte': 'REDOME/INCA',
        'titulo': 'Medula do jovem de 23 anos saiu da Alemanha e chegou ao Brasil em menos de 24 horas',
        'resumo': 'Confira os detalhes na reportagem da RPC, afiliada da TV Globo no Paraná, e do portal G1',
        'link': 'https://redome.inca.gov.br/doador-de-medula-na-alemanha-ajuda-a-salvar-brasileiro-de-9-anos-com-doenca-rara-um-irmao-alemao/',
        'publicado_em': '2026-11-04',
    }


def test_general_portals_keep_only_posts_about_marrow_or_stem_cells():
    items, received = parse_posts(ABRALE_POSTS, ABRALE, SINCE)
    assert received == 3
    assert [item['titulo'] for item in items] == ['Conitec abre consulta pública de TMO para linfoma de hodgkin']
    assert items[0]['resumo'].endswith('na saúde pública.'), 'o "…" depois do ponto final sai do resumo'
    assert 'Células-Tronco Hematopoiéticas' in items[0]['resumo']


def test_topic_matches_without_accents_and_as_whole_words():
    assert is_on_topic('Doação de medula óssea', '')
    assert is_on_topic('Pesquisa', 'uso de células-tronco hematopoéticas')
    assert is_on_topic('Pesquisa', 'CELULA TRONCO')
    assert is_on_topic('Consulta pública sobre TCTH', '')
    assert not is_on_topic('Atmosfera e clima', 'agosto verde claro'), '"tmo" dentro de outra palavra não conta'
    assert not is_on_topic('Novas regras para doação de sangue', 'mudanças nos critérios para doar')
    assert is_on_topic('Confira como foi o Lançamento do Manual de Terapia Celular', '')
    assert is_on_topic('Pesquisa', 'avanços das terapias celulares no SUS')


def test_sbtmo_posts_all_enter_like_redome():
    post = {
        'title': {'rendered': 'Confira como foi o Lançamento do Manual de Terapia Celular SBTMO'},
        'date': '2026-10-16T10:00:00',
        'link': 'https://sbtmo.org.br/manual-de-terapia-celular/',
        'excerpt': {'rendered': '<p>Evento da sociedade.</p>'},
    }
    congress = {**post, 'title': {'rendered': 'Inscrições abertas para o congresso'}, 'link': 'https://sbtmo.org.br/congresso/'}
    items, received = parse_posts(json.dumps([post, congress]).encode(), SBTMO, SINCE)
    assert not SBTMO.filter_by_topic
    assert received == 2 and [item['link'] for item in items] == [post['link'], congress['link']]


def test_summary_is_plain_text_without_read_more_and_cut_on_a_word():
    assert summary('<p>Texto &amp; mais [&hellip;]</p>') == 'Texto & mais'
    assert summary('<p>Fim da frase. Leia mais</p>') == 'Fim da frase.'
    assert summary('<p>Corte no meio&hellip;</p>') == 'Corte no meio…', 'reticências sem ponto final marcam o corte'
    long = summary('<p>' + 'palavra ' * 200 + '</p>')
    assert len(long) <= collector.SUMMARY_LIMIT + 1 and long.endswith('palavra…')


def test_links_outside_the_portal_and_old_posts_are_dropped():
    posts = json.loads(REDOME_POSTS)
    posts[0]['link'] = 'https://exemplo.com/golpe'
    posts[1]['link'] = posts[1]['link'].replace('https://', 'http://')
    posts[2]['date'] = '2026-07-31T23:59:00'
    items, received = parse_posts(json.dumps(posts).encode(), REDOME, SINCE)
    assert received == 3 and items == []


def test_unexpected_payload_is_an_explicit_error():
    with pytest.raises(RuntimeError, match='lista de posts'):
        parse_posts(b'{"code": "rest_no_route"}', REDOME, SINCE)
    with pytest.raises(RuntimeError, match='fora do formato'):
        parse_posts(b'[{"title": "sem rendered"}]', REDOME, SINCE)


def test_since_is_last_30_days_or_first_day_of_competencia():
    assert since_date(None, date(2026, 11, 10)) == date(2026, 10, 11)
    assert since_date('2601', date(2026, 11, 10)) == date(2026, 1, 1)
    with pytest.raises(ValueError, match='competência inválida'):
        since_date('2613', date(2026, 11, 10))


def test_query_filters_by_date_on_the_server():
    query = parse_qs(urlsplit(posts_url(ABRALE, SINCE, 2)).query)
    assert query['after'] == ['2026-08-01T00:00:00']
    assert query['per_page'] == ['100'] and query['page'] == ['2']
    assert query['_fields'] == ['date,link,title,excerpt']


def _fake_fetch(responses: dict[str, bytes | Exception], calls: list[str]):
    def fetch(path, url, **kwargs):
        calls.append(url)
        assert kwargs['headers']['User-Agent'].startswith('STEM-coletor/'), 'o firewall da Abrale recusa Python-urllib'
        host = urlsplit(url).hostname
        response = responses[host]
        if isinstance(response, Exception):
            raise response
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(response)
        return download.RemoteFile(path=path, url=url, status='downloaded', sha256='x', size=len(response))

    return fetch


def test_one_portal_down_does_not_stop_the_others(tmp_path, monkeypatch):
    calls: list[str] = []
    responses = {
        'redome.inca.gov.br': REDOME_POSTS,
        'abrale.org.br': ABRALE_POSTS,
        'ameo.org.br': b'[]',
        'sbtmo.org.br': RuntimeError('falha ao baixar: HTTP Error 503'),
    }
    monkeypatch.setattr(collector, 'fetch_remote_file', _fake_fetch(responses, calls))
    payload = collector.collect('2608', tmp_path)
    assert payload['source'] == 'novidades' and payload['desde'] == '2026-08-01'
    assert payload['portais']['redome'] == {'nome': 'REDOME/INCA', 'posts': 3, 'no_tema': 3}
    assert payload['portais']['abrale'] == {'nome': 'Abrale', 'posts': 3, 'no_tema': 1}
    assert 'erro' in payload['portais']['sbtmo']
    assert any('SBTMO' in warning for warning in payload['warnings'])
    assert [item['publicado_em'] for item in payload['itens']] == ['2026-11-04', '2026-10-29', '2026-10-26', '2026-10-21']
    assert len(payload['raw_files']) == 3


def test_every_portal_down_is_an_error(tmp_path, monkeypatch):
    responses = {portal.base_url.removeprefix('https://'): RuntimeError('fora do ar') for portal in PORTALS}
    monkeypatch.setattr(collector, 'fetch_remote_file', _fake_fetch(responses, []))
    with pytest.raises(RuntimeError, match='nenhum portal respondeu'):
        collector.collect(None, tmp_path)


FULL_PAGE = json.dumps([json.loads(REDOME_POSTS)[0]] * collector.PER_PAGE).encode()


def _paged(monkeypatch, *pages):
    responses = iter(pages)
    calls: list[str] = []

    def fetch(path, url, **kwargs):
        calls.append(url)
        response = next(responses)
        if isinstance(response, Exception):
            raise response
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(response)
        return download.RemoteFile(path=path, url=url, status='downloaded', sha256='x', size=len(response))

    monkeypatch.setattr(collector, 'fetch_remote_file', fetch)
    return calls


def test_pages_until_a_short_page(tmp_path, monkeypatch):
    calls = _paged(monkeypatch, FULL_PAGE, REDOME_POSTS)
    warnings: list[str] = []
    items, received = collector.collect_portal(REDOME, SINCE, tmp_path, [], warnings)
    assert received == collector.PER_PAGE + 3 and len(items) == collector.PER_PAGE + 3
    assert len(calls) == 2 and 'page=2' in calls[1]
    assert warnings == []


def test_page_past_the_last_ends_quietly_but_other_failures_warn(tmp_path, monkeypatch):
    past_last = RuntimeError('falha ao baixar https://redome.inca.gov.br/...: HTTP Error 400: Bad Request')
    _paged(monkeypatch, FULL_PAGE, past_last)
    warnings: list[str] = []
    items, _ = collector.collect_portal(REDOME, SINCE, tmp_path, [], warnings)
    assert len(items) == collector.PER_PAGE and warnings == []

    _paged(monkeypatch, FULL_PAGE, RuntimeError('falha ao baixar: HTTP Error 503: Service Unavailable'))
    items, _ = collector.collect_portal(REDOME, SINCE, tmp_path / 'b', [], warnings)
    assert len(items) == collector.PER_PAGE and 'página 2' in warnings[0]


def test_backfill_is_capped_per_portal(tmp_path, monkeypatch):
    _paged(monkeypatch, *[FULL_PAGE] * collector.MAX_PAGES)
    warnings: list[str] = []
    items, _ = collector.collect_portal(REDOME, SINCE, tmp_path, [], warnings)
    assert len(items) == collector.MAX_PAGES * collector.PER_PAGE
    assert 'mais antigos ficaram de fora' in warnings[0]
