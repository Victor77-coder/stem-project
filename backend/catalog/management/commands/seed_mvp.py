from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import Role, StaffProfile, User
from catalog import seed_data as data
from catalog.models import Center, Content, EstimateRule, GlossaryTerm, JourneyStep, PublishStatus, Statistic
from consent.models import ConsentDocument
from engagement.models import Notification


class Command(BaseCommand):
    help = 'Carrega o conteúdo do protótipo. Idempotente: pode rodar de novo sem duplicar.'

    def add_arguments(self, parser):
        parser.add_argument('--dev', action='store_true', help='Cria as contas de equipe do mock do painel (só desenvolvimento).')
        parser.add_argument(
            '--validar-com',
            metavar='EMAIL',
            help='Conta da equipe que revisou o conteúdo. Sem ela, artigos entram como rascunho aguardando validação clínica.',
        )

    @transaction.atomic
    def handle(self, *args, dev=False, validar_com=None, **options):
        validator = None
        if dev:
            validator = self._dev_staff()
        if validar_com:
            validator = User.objects.filter(role=Role.STAFF, email=validar_com.lower()).select_related('staff').first()
            if not validator or not validator.staff.can_validate:
                raise CommandError('A conta informada precisa ser da equipe e poder validar (Admin ou Validador clínico).')

        self._consent()
        count = self._contents(validator)
        self._journeys()
        self._centers()
        self._notices()
        self._statistics()
        self._estimates()
        for order, (term, body) in enumerate(data.GLOSSARY):
            GlossaryTerm.objects.update_or_create(termo=term, defaults={'definicao': body, 'ordem': order})

        state = 'publicados' if validator else 'em rascunho (valide no painel para publicar)'
        self.stdout.write(self.style.SUCCESS(f'Seed concluído: {count} conteúdos {state}.'))

    def _dev_staff(self) -> User:
        admin = None
        for item in data.DEV_STAFF:
            user = User.objects.filter(role=Role.STAFF, email=item['email']).first() or User(role=Role.STAFF, email=item['email'])
            user.name = item['nome']
            user.status = item.get('status', 'ativo')
            user.set_password(item['senha'])
            user.is_superuser = item['nivel'] == 'Admin'
            user.save()
            StaffProfile.objects.update_or_create(
                user=user,
                defaults={
                    'nivel': item['nivel'],
                    'tipo_conta': item['tipo_conta'],
                    'estado': item.get('estado', ''),
                    'cidade': item.get('cidade', ''),
                    'genero': item.get('genero', ''),
                    'avatar': item.get('avatar', ''),
                },
            )
            admin = admin or user
        self.stdout.write('Contas de desenvolvimento: admin@stem.com / admin123, silva_js@email.com / senha123')
        return admin

    def _consent(self):
        for kind, title, sections in (
            (ConsentDocument.Kind.TCLE, 'Termo de Consentimento Livre e Esclarecido', data.TCLE),
            (ConsentDocument.Kind.TERMOS, 'Termos de uso', data.TERMOS),
        ):
            if not ConsentDocument.objects.filter(kind=kind, is_current=True).exists():
                ConsentDocument.objects.update_or_create(
                    kind=kind,
                    version='1.0',
                    defaults={'title': title, 'sections': sections, 'published_at': date(2026, 10, 1), 'is_current': True},
                )

    def _contents(self, validator) -> int:
        status = PublishStatus.PUBLICADO if validator else PublishStatus.RASCUNHO
        stamp = {'validado_por': validator, 'validado_em': timezone.now() if validator else None}
        rows = []
        for item in data.ARTICLES:
            rows.append({
                **item,
                'descricao': item['secoes'][0]['body'],
                'publico_alvo': data.TODOS,
                'visibilidade': Content.Visibility.PUBLICO,
            })
        for slug, tag, quote, body in data.MYTHS:
            rows.append({
                'slug': slug, 'titulo': quote, 'descricao': body, 'categoria': 'Mitos', 'selo': tag, 'lista': 'direct',
                'fonte': data.INCA, 'publico_alvo': data.TODOS, 'visibilidade': Content.Visibility.PUBLICO,
            })
        for slug, question, answer in data.FAQS:
            rows.append({
                'slug': slug, 'titulo': question, 'descricao': answer, 'categoria': 'FAQ', 'lista': 'direct',
                'fonte': data.MS, 'publico_alvo': data.TODOS, 'visibilidade': Content.Visibility.PUBLICO,
            })
        for item in data.PANEL_CONTENTS:
            rows.append({**item, 'visibilidade': Content.Visibility.PUBLICO})
        for row in rows:
            slug = row.pop('slug')
            existing = Content.objects.filter(slug=slug).first()
            if existing and existing.status != PublishStatus.RASCUNHO:
                continue
            Content.objects.update_or_create(slug=slug, defaults={**row, **stamp, 'status': status})
        return len(rows)

    def _journeys(self):
        for order, (slug, title, short, summary, home, body, checklist, place, sus) in enumerate(data.DONOR_STEPS, 1):
            JourneyStep.objects.update_or_create(
                jornada='doador', slug=slug,
                defaults={
                    'ordem': order, 'titulo': title, 'titulo_curto': short, 'resumo': summary, 'resumo_home': home,
                    'corpo': body, 'checklist': checklist, 'local': place, 'fonte': data.JOURNEY_SOURCE,
                    'o_que_stem_faz': data.STEM, 'o_que_sus_faz': sus, 'status': PublishStatus.PUBLICADO,
                },
            )
        for order, (slug, title, short, summary, home, by_region, body) in enumerate(data.RECEPTOR_STEPS, 1):
            JourneyStep.objects.update_or_create(
                jornada='receptor', slug=slug,
                defaults={
                    'ordem': order, 'titulo': title, 'titulo_curto': short, 'resumo': summary, 'resumo_home': home,
                    'resumo_por_regiao': by_region, 'corpo': body, 'fonte': data.JOURNEY_SOURCE,
                    'o_que_stem_faz': 'Explica o que esperar. Não agenda, não altera fila e não promete prazo.',
                    'o_que_sus_faz': 'Indicação, regulação, busca de doador e o transplante.',
                    'status': PublishStatus.PUBLICADO,
                },
            )

    def _centers(self):
        for item in data.CENTERS:
            row = dict(item)
            slug = row.pop('slug')
            row['fonte_data'] = date.fromisoformat(row['fonte_data'])
            Center.objects.update_or_create(slug=slug, defaults={**row, 'status': PublishStatus.PUBLICADO})

    def _notices(self):
        now = timezone.now()
        for key, kind, title, body, origin, uf, hours, center in data.NOTICES:
            Notification.objects.update_or_create(
                titulo=title,
                defaults={
                    'tipo': kind, 'mensagem': body, 'origem': origin, 'uf': uf,
                    'data_disparo': now - timedelta(hours=hours), 'status': PublishStatus.PUBLICADO,
                    'centro': Center.objects.filter(slug=center).first() if center else None,
                },
            )

    def _statistics(self):
        extracted = date.fromisoformat(data.STATS_DATE)
        base = {'fonte': data.STATS_SOURCE, 'data_extracao': extracted}

        def put(indicator, recorte, period, value, label):
            Statistic.objects.update_or_create(
                indicador=indicator, recorte=recorte, periodo=period, data_extracao=extracted,
                defaults={'valor': Decimal(str(value)), 'rotulo': label, **base},
            )

        for year, (donors, donors_label, transplants, transplants_label) in data.HEADLINES.items():
            put('doadores', 'BR', year, donors, donors_label)
            put('transplantes', 'BR', year, transplants, transplants_label)
            for region, value in data.REGION_BASE.items():
                put('transplantes_regiao', region, year, round(value * data.YEAR_SCALE[year]), '')
            for region, (months, label) in data.WAIT.items():
                put('espera', region, year, months, label)

    def _estimates(self):
        for profile, uf, label, value in data.ESTIMATES:
            EstimateRule.objects.update_or_create(
                perfil=profile, uf=uf, ativo=True,
                defaults={'rotulo': label, 'valor': value, 'nota': data.ESTIMATE_NOTE, 'fonte': data.STATS_SOURCE},
            )
