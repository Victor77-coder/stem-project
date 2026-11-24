"""RS008: quem não tem conta vê só avisos reais, publicados para o Brasil todo."""

from datetime import timedelta

from django.utils import timezone

from engagement.models import Notification


def notice(titulo, **fields):
    data = {'tipo': 'evento', 'mensagem': 'Mensagem.', 'origem': 'INCA', 'uf': '', 'status': 'publicado',
            'data_disparo': timezone.now() - timedelta(hours=1), **fields}
    return Notification.objects.create(titulo=titulo, **data)


def test_public_inbox_shows_only_national_published_notices(api, seeded):
    now = timezone.now()
    notice('Regional', uf='AL', tipo='campanha', origem='Hemoal')
    notice('Futuro', data_disparo=now + timedelta(days=1))
    notice('Rascunho', status='rascunho')
    notice('Antigo', data_disparo=now - timedelta(days=90))
    notice('Nacional agora')

    data = api.get('/api/v1/avisos/').data
    titles = {item['title'] for item in data}
    assert 'Nacional agora' in titles
    assert not titles & {'Regional', 'Futuro', 'Rascunho', 'Antigo'}
    expected = Notification.objects.filter(
        status='publicado', uf='', data_disparo__lte=now, data_disparo__gte=now - timedelta(days=60)
    ).count()
    assert len(data) == min(expected, 20) and all(item['read'] is False for item in data)
