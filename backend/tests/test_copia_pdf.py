"""LGPD art. 18, II e V: "Baixar meus dados" entrega uma ficha em PDF legível; o JSON continua para portabilidade."""
import base64
import re
import zlib

import pytest
from rest_framework.test import APIClient

from catalog.models import Content
from engagement.models import Preferences, SavedContent
from participants.models import Participant

from .conftest import DONOR, auth

pytestmark = pytest.mark.django_db


def pdf_text(content: bytes) -> str:
    """Texto dos streams do PDF (comprimidos ou não), para conferir o que foi escrito nas páginas."""
    chunks = []
    for raw in re.findall(rb'stream\r?\n(.*?)endstream', content, re.S):
        data = raw.strip()
        if data.endswith(b'~>'):  # ReportLab: /ASCII85Decode /FlateDecode
            data = base64.a85decode(data[:-2])
        try:
            data = zlib.decompress(data)
        except zlib.error:
            pass
        chunks.append(data.decode('latin-1'))
    # Acentos saem como escape octal da string PDF: \323 = Ó (byte WinAnsi).
    return re.sub(r'\\([0-7]{3})', lambda m: chr(int(m.group(1), 8)), '\n'.join(chunks))


def test_donor_downloads_a_readable_pdf(donor):
    client = auth(APIClient(), donor['access'])
    client.patch('/api/v1/me/', {'weight': '70'}, format='json')
    response = client.get('/api/v1/me/export/', {'formato': 'pdf'})

    assert response.status_code == 200
    assert response['Content-Type'] == 'application/pdf'
    assert 'meus-dados-stem.pdf' in response['Content-Disposition']
    body = response.content
    assert body.startswith(b'%PDF')
    text = pdf_text(body)
    for expected in ('CÓPIA DOS DADOS PESSOAIS', 'Maria Silva', '529.982.247-25', 'DADOS FÍSICOS', 'Hipertensão', 'TCLE versão 1.0'):
        assert expected.encode('cp1252').decode('latin-1') in text, expected
    assert 'Peso alterado' in text and '68,5 kg para 70 kg' in text, 'a seta do histórico vira "para"'
    assert 'Entrada no app' in text, 'os acessos entram no histórico'


def test_guest_pdf_has_no_clinical_section(api, seeded):
    created = api.post(
        '/api/v1/auth/register/',
        {'profile': 'convidado', 'email': 'guest@example.com', 'tcleAccepted': True, 'channel': 'web'},
        format='json',
    )
    assert created.status_code == 201, created.data
    response = auth(APIClient(), created.data['access']).get('/api/v1/me/export/', {'formato': 'pdf'})
    text = pdf_text(response.content)
    assert 'guest@example.com' in text and 'Termos de uso' in text
    assert 'DADOS F' not in text and 'Peso' not in text


def test_json_copy_includes_notices_and_saved_contents(donor):
    client = auth(APIClient(), donor['access'])
    participant = Participant.objects.get(user_id=donor['me']['id'])
    Preferences.objects.filter(participant=participant).update(campaigns=True, push=True)
    content = Content.objects.filter(status='publicado').first()
    SavedContent.objects.create(participant=participant, content=content)

    data = client.get('/api/v1/me/export/').data
    assert data['notices'] == {'campaigns': True, 'events': False, 'official': False, 'push': True, 'email': False}
    assert data['saved'] == [content.titulo]


def test_only_the_owner_gets_the_pdf(api, staff_login, donor):
    assert api.get('/api/v1/me/export/', {'formato': 'pdf'}).status_code == 401
    assert staff_login().get('/api/v1/me/export/', {'formato': 'pdf'}).status_code == 403


def test_email_copy_attaches_pdf_and_json(donor):
    from django.core import mail

    client = auth(APIClient(), donor['access'])
    assert client.post('/api/v1/me/export/').status_code == 202
    attached = {name: kind for name, _, kind in mail.outbox[-1].attachments}
    assert attached == {'meus-dados-stem.pdf': 'application/pdf', 'meus-dados-stem.json': 'application/json'}


def test_donor_fixture_is_the_one_in_the_text():
    assert DONOR['name'] == 'Maria Silva' and DONOR['cpf'] == '529.982.247-25'
