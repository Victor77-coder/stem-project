"""Cópia dos dados em PDF (LGPD art. 18, II e V): a ficha legível que "Baixar meus dados" entrega.

O JSON de `services.export` continua sendo a versão para levar a outro serviço; esta é a versão para a pessoa ler,
imprimir ou anexar. Usa só as fontes padrão do PDF (Helvetica, WinAnsi), sem arquivo de fonte no servidor.
"""

import re
from dataclasses import dataclass, field
from datetime import datetime
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Image, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from accounts.models import Channel
from catalog.models import JourneyStep
from engagement.models import JourneyProgress, Preferences, SavedContent

from .models import Participant, Sex
from .services import actor_label
from .validators import format_decimal

LOGO = Path(__file__).parent / 'assets' / 'logo.png'
INK = colors.HexColor('#1C2433')
TEXT2 = colors.HexColor('#515B6C')
TEXT3 = colors.HexColor('#8691A5')
LINE = colors.HexColor('#E6EAF2')
MUTED = colors.HexColor('#F6F8FB')
MARGIN = 20 * mm
WIDTH = A4[0] - 2 * MARGIN

CHANNEL = {Channel.ANDROID: 'App Android', Channel.IOS: 'App iOS', Channel.WEB: 'Navegador'}
TOPICS = (('campaigns', 'Campanhas de doação'), ('events', 'Eventos de saúde'), ('official', 'Comunicados oficiais'))
NOT_KEPT = (
    '<b>O que o STEM Project não guarda:</b> prontuário, exames, resultado de compatibilidade, senha do Gov.br e '
    'histórico de rotas. O aplicativo não realiza validação clínica. <b>Seus direitos:</b> corrigir os dados em Perfil, '
    'pedir a inativação da conta em Perfil › Privacidade e receber esta cópia também em formato de dados (JSON) para '
    'levar a outro serviço.'
)


def _text(value) -> str:
    """Texto seguro para Paragraph e para a fonte padrão: a seta do histórico vira "para" e o que não existe em
    WinAnsi vira "?", em vez de um quadrado vazio no PDF."""
    text = str(value or '—').replace(' → ', ' para ').replace('→', '->')
    return escape(text.encode('cp1252', 'replace').decode('cp1252'))


def _when(value: datetime) -> str:
    return timezone.localtime(value).strftime('%d/%m/%Y às %H:%M')


def _cpf(digits: str | None) -> str:
    d = digits or ''
    return f'{d[:3]}.{d[3:6]}.{d[6:9]}-{d[9:]}' if len(d) == 11 else (d or '—')


def _phone(digits: str | None) -> str:
    d = digits or ''
    if len(d) == 11:
        return f'({d[:2]}) {d[2:7]}-{d[7:]}'
    if len(d) == 10:
        return f'({d[:2]}) {d[2:6]}-{d[6:]}'
    return d or '—'


def _count(number: int, one: str, many: str, none: str) -> str:
    return none if number == 0 else f'{number} {one if number == 1 else many}'


def _decimal(value, unit: str) -> str:
    # format_decimal evita a notação científica de Decimal.normalize() (70.00 viraria "7E+1").
    return f'{format_decimal(value).replace(".", ",")} {unit}' if value is not None else '—'


def _measure(detail: str) -> str:
    """O histórico guarda "68.5 kg → 70 kg": no documento, vírgula decimal só nas medidas ("Versão 1.0" fica)."""
    return re.sub(r'(\d+)\.(\d+)(?= (?:kg|m)\b)', r'\1,\2', detail or '')


@dataclass
class Ficha:
    """O que vai no documento, já em texto. Separado do desenho para o teste e para o e-mail usarem o mesmo."""

    holder: str
    generated_at: str
    status: str
    sections: list[tuple[str, list[tuple[str, str]]]] = field(default_factory=list)
    history: list[tuple[datetime, str, str, str]] = field(default_factory=list)


def ficha(participant: Participant) -> Ficha:
    user = participant.user
    clinical = participant.is_clinical  # convidado não tem dado clínico, CPF nem nascimento (RNF05)
    doc = Ficha(
        holder=user.name or user.email or 'Titular',
        generated_at=_when(timezone.now()),
        status=user.get_status_display(),
    )

    email = user.email or '—'
    if user.email:
        email += ' (confirmado)' if user.email_confirmado_em else ' (não confirmado)'
    account = [('Perfil', participant.get_profile_display())]
    if user.name:
        account.append(('Nome completo', user.name))
    account += [('E-mail', email)]
    if clinical:
        account += [
            ('Telefone', _phone(user.phone)),
            ('CPF', _cpf(user.cpf)),
            ('Data de nascimento', participant.birth_date.strftime('%d/%m/%Y') if participant.birth_date else '—'),
        ]
    account += [('Conta criada em', timezone.localtime(user.created_at).strftime('%d/%m/%Y')), ('Situação', doc.status)]
    doc.sections.append(('Conta', account))

    if clinical:
        doc.sections.append(('Dados físicos', [
            ('Peso', _decimal(participant.weight, 'kg')),
            ('Altura', _decimal(participant.height, 'm')),
            ('Sexo biológico', Sex(participant.sex).label if participant.sex else '—'),
            ('Comorbidades', ', '.join(participant.comorbidities) or '—'),
        ]))
        street = ', '.join(part for part in (participant.address, participant.number) if part)
        address = ' · '.join(part for part in (street, participant.complement, participant.district) if part)
        cep = participant.cep
        doc.sections.append(('Localização', [
            ('CEP', f'{cep[:5]}-{cep[5:]}' if len(cep) == 8 else (cep or '—')),
            ('Endereço', address or '—'),
            ('Cidade', ' / '.join(part for part in (participant.city, participant.uf) if part) or '—'),
            ('Localização do aparelho (GPS)',
             'Permitida durante o uso, sem histórico de rotas' if participant.allow_location else 'Não permitida'),
        ]))

    consents = [
        (
            f'{item.document.get_kind_display().split(" (")[0]} versão {item.document.version}',
            f'Aceito em {_when(item.accepted_at)} · {CHANNEL.get(item.channel, item.channel)}',
        )
        for item in user.consents.select_related('document')
    ]
    doc.sections.append(('Consentimento', consents or [('Termo', 'Nenhum aceite registrado')]))

    prefs = Preferences.objects.filter(participant=participant).first()
    topics = [label for key, label in TOPICS if prefs and getattr(prefs, key)]
    channels = ['Caixa de entrada do app'] if topics else []
    if prefs and prefs.push:
        channels.append('Notificações no celular')
    if prefs and prefs.email:
        channels.append('E-mail')
    choices = [('Assuntos dos avisos', ', '.join(topics) or 'Nenhum'), ('Canais', ', '.join(channels) or 'Nenhum')]
    journey = JourneyProgress.objects.filter(participant=participant).first()
    if clinical and journey is not None:
        titles = dict(JourneyStep.objects.filter(jornada=participant.profile).values_list('slug', 'titulo'))
        done = [titles.get(slug, slug) for slug in journey.done]
        checked = sum(len(items) for items in journey.checklist.values())
        steps = _count(len(done), 'etapa marcada', 'etapas marcadas', 'Nenhuma etapa marcada')
        choices.append(('Jornada (guia pessoal)', steps + (f': {", ".join(done)}' if done else '')))
        choices.append(('Checklist', _count(checked, 'item marcado', 'itens marcados', 'Nenhum item marcado')))
    saved = list(SavedContent.objects.filter(participant=participant).select_related('content').values_list('content__titulo', flat=True))
    choices.append(('Conteúdos salvos', '; '.join(saved) or 'Nenhum'))
    doc.sections.append(('Avisos, jornada e conteúdos salvos', choices))

    events = [(item.created_at, item.title, _measure(item.detail), actor_label(item, user)) for item in participant.history.all()]
    logins = [(item.created_at, 'Entrada no app', CHANNEL.get(item.channel, item.channel), 'Você') for item in user.logins.all()[:50]]
    doc.history = sorted(events + logins, key=lambda row: row[0], reverse=True)
    return doc


class _NumberedCanvas(Canvas):
    """Rodapé "Página X de Y": o total só existe depois de desenhar todas as páginas."""

    footer_text = ''

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._pages = []

    def showPage(self):
        self._pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._pages)
        for number, state in enumerate(self._pages, start=1):
            self.__dict__.update(state)
            self.setStrokeColor(LINE)
            self.setLineWidth(0.6)
            self.line(MARGIN, 14 * mm, A4[0] - MARGIN, 14 * mm)
            self.setFont('Helvetica', 7)
            self.setFillColor(TEXT3)
            self.drawString(MARGIN, 10 * mm, self.footer_text)
            self.drawRightString(A4[0] - MARGIN, 10 * mm, f'Página {number} de {total}')
            super().showPage()
        super().save()


def _styles():
    base = ParagraphStyle('base', fontName='Helvetica', fontSize=9, leading=12, textColor=INK)
    return {
        'value': base,
        'label': ParagraphStyle('label', parent=base, textColor=TEXT2),
        'small': ParagraphStyle('small', parent=base, fontSize=8, leading=10.5),
        'meta_label': ParagraphStyle('meta_label', parent=base, fontSize=6.5, leading=8, textColor=TEXT3),
        'meta_value': ParagraphStyle('meta_value', parent=base, fontName='Helvetica-Bold', fontSize=9),
        'section': ParagraphStyle('section', parent=base, fontName='Helvetica-Bold', fontSize=8, leading=10),
        'title': ParagraphStyle('title', parent=base, fontName='Helvetica-Bold', fontSize=13, leading=16, alignment=TA_RIGHT),
        'subtitle': ParagraphStyle('subtitle', parent=base, fontSize=7.5, leading=10, textColor=TEXT2, alignment=TA_RIGHT),
        'th': ParagraphStyle('th', parent=base, fontName='Helvetica-Bold', fontSize=7, leading=9, textColor=TEXT3),
        'note': ParagraphStyle('note', parent=base, fontSize=7.5, leading=10.5, textColor=TEXT2),
    }


def _section_title(number: int, title: str, style) -> Table:
    bar = Table([[Paragraph(f'{number}. {_text(title).upper()}', style)]], colWidths=[WIDTH])
    bar.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), MUTED),
        ('LINEBEFORE', (0, 0), (0, -1), 2.5, INK),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    bar.keepWithNext = True  # o título nunca fica sozinho no pé da página
    return bar


def _rows(pairs: list[tuple[str, str]], s) -> Table:
    table = Table(
        [[Paragraph(_text(label), s['label']), Paragraph(_text(value), s['value'])] for label, value in pairs],
        colWidths=[WIDTH * 0.34, WIDTH * 0.66],
    )
    table.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, -1), 0.6, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    return table


def _history(rows: list[tuple[datetime, str, str, str]], s) -> Table:
    head = [Paragraph(text, s['th']) for text in ('DATA', 'HORA', 'REGISTRO', 'DETALHE', 'RESPONSÁVEL')]
    body = []
    for when, title, detail, by in rows:
        local = timezone.localtime(when)
        body.append([Paragraph(local.strftime('%d/%m/%Y'), s['small']), Paragraph(local.strftime('%H:%M'), s['small']),
                     Paragraph(_text(title), s['small']), Paragraph(_text(detail or '—'), s['small']), Paragraph(_text(by), s['small'])])
    table = Table([head] + (body or [[Paragraph('Nenhum registro.', s['small']), '', '', '', '']]),
                  colWidths=[WIDTH * w for w in (0.14, 0.09, 0.28, 0.31, 0.18)], repeatRows=1)
    table.setStyle(TableStyle([
        ('LINEBELOW', (0, 0), (-1, 0), 0.9, INK),
        ('LINEBELOW', (0, 1), (-1, -1), 0.6, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    return table


def render(participant: Participant) -> bytes:
    doc = ficha(participant)
    s = _styles()
    buffer = BytesIO()
    pdf = SimpleDocTemplate(
        buffer, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=16 * mm, bottomMargin=22 * mm,
        title='Cópia dos dados pessoais · STEM Project', author='STEM Project', subject='LGPD art. 18',
    )
    logo = Image(str(LOGO), width=30 * mm, height=12 * mm)
    head = Table(
        [[logo, [Paragraph('CÓPIA DOS DADOS PESSOAIS', s['title']),
                 Paragraph('Lei nº 13.709/2018 (LGPD), art. 18, II e V', s['subtitle'])]]],
        colWidths=[WIDTH * 0.4, WIDTH * 0.6],
    )
    head.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'BOTTOM'), ('LINEBELOW', (0, 0), (-1, -1), 1.5, INK),
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    meta = Table([[
        [Paragraph('TITULAR', s['meta_label']), Paragraph(_text(doc.holder), s['meta_value'])],
        [Paragraph('GERADA EM', s['meta_label']), Paragraph(_text(doc.generated_at), s['meta_value'])],
        [Paragraph('SITUAÇÃO DA CONTA', s['meta_label']), Paragraph(_text(doc.status), s['meta_value'])],
    ]], colWidths=[WIDTH / 3] * 3)
    meta.setStyle(TableStyle([
        ('BOX', (0, 0), (-1, -1), 0.6, LINE), ('LINEAFTER', (0, 0), (1, 0), 0.6, LINE),
        ('TOPPADDING', (0, 0), (-1, -1), 5), ('BOTTOMPADDING', (0, 0), (-1, -1), 6), ('LEFTPADDING', (0, 0), (-1, -1), 7),
    ]))

    story = [head, Spacer(1, 10), meta, Spacer(1, 12)]
    for number, (title, pairs) in enumerate(doc.sections, start=1):
        story.append(KeepTogether([_section_title(number, title, s['section']), _rows(pairs, s), Spacer(1, 11)]))
    story += [
        _section_title(len(doc.sections) + 1, 'Histórico de alterações e acessos', s['section']),
        _history(doc.history, s),
        Spacer(1, 14),
    ]
    note = Table([[Paragraph(NOT_KEPT, s['note'])]], colWidths=[WIDTH])
    note.setStyle(TableStyle([('BOX', (0, 0), (-1, -1), 0.6, LINE), ('LEFTPADDING', (0, 0), (-1, -1), 8),
                              ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 8)]))
    story.append(KeepTogether([note]))

    canvas = type('FichaCanvas', (_NumberedCanvas,), {'footer_text': f'STEM Project · Cópia dos seus dados · gerada em {doc.generated_at}'})
    pdf.build(story, canvasmaker=canvas)
    return buffer.getvalue()
