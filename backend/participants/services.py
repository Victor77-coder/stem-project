from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from accounts.models import Channel, PasswordResetCode, Role, Status, User
from accounts.services import record_login, set_status
from consent.models import ConsentAcceptance, ConsentDocument
from engagement.models import JourneyProgress, Preferences, PushToken, SavedContent
from engagement.services import email_changed, send_email_code

from .models import CLINICAL_PROFILES, COMORBIDITIES, ChangeEvent, Participant, Profile
from .validators import format_decimal, valid_cpf

CLINICAL_FIELDS = ('weight', 'height', 'sex', 'comorbidities')
LOCATION_FIELDS = ('cep', 'address', 'number', 'district', 'city', 'uf', 'complement')
SEX_LABEL = {'feminino': 'Feminino', 'masculino': 'Masculino', 'outro': 'Outro'}
# RF02: o convidado só informa e-mail. Telefone e WhatsApp são desejáveis (Fase 2): não há canal que os use.
GUEST_EMAIL_ONLY = 'No perfil convidado, o contato é só por e-mail. Telefone e WhatsApp ainda não recebem avisos.'
GUEST_NEEDS_EMAIL = 'Informe um e-mail para receber avisos. Sem e-mail, o conteúdo público continua disponível sem cadastro.'
OWNED_BY_ACCOUNT = 'Este e-mail já tem conta de doador ou receptor. Entre com a sua senha.'
# Abrir o app com a sessão salva conta como acesso, no máximo uma gravação por hora.
TOUCH_EVERY = timedelta(hours=1)


class ReturningGuest(Exception):
    """O e-mail já é de um convidado (outro aparelho ou app reinstalado): a volta exige o código enviado ao e-mail."""

    def __init__(self, user: User):
        super().__init__(user.pk)
        self.user = user


def consent_kind(profile: str) -> str:
    return ConsentDocument.Kind.TCLE if profile in CLINICAL_PROFILES else ConsentDocument.Kind.TERMOS


def _fail(field: str, message: str):
    raise serializers.ValidationError({field: [message]})


def _check_password(password: str, user: User | None = None) -> None:
    try:
        validate_password(password, user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError({'password': list(exc.messages)})


def _check_unique(field: str, value: str | None, exclude: User | None) -> None:
    if not value:
        return
    query = User.objects.filter(role=Role.PARTICIPANT, **{field: value})
    if exclude is not None:
        query = query.exclude(pk=exclude.pk)
    if query.exists():
        label = {'email': 'este e-mail', 'phone': 'este telefone', 'cpf': 'este CPF'}[field]
        _fail(field, f'Não foi possível usar {label}. Se você já tem conta, entre ou recupere a senha.')


def _check_profile_rules(profile: str, state: dict) -> None:
    """Minimização (RNF05): convidado nunca guarda dado clínico; doador e receptor precisam dos quatro campos."""
    if profile == Profile.CONVIDADO:
        if any(state.get(field) for field in (*CLINICAL_FIELDS, 'cpf')):
            _fail('profile', 'O perfil convidado não coleta CPF, peso, altura, sexo biológico nem comorbidades.')
        return
    missing = {
        'weight': 'Informe o peso.',
        'height': 'Informe a altura.',
        'sex': 'Informe o sexo biológico.',
        'comorbidities': 'Selecione as comorbidades ou "Nenhuma".',
    }
    errors = {field: [message] for field, message in missing.items() if not state.get(field)}
    if errors:
        raise serializers.ValidationError(errors)
    items = state['comorbidities']
    unknown = [item for item in items if item not in COMORBIDITIES]
    if unknown:
        _fail('comorbidities', f'Opção inválida: {", ".join(unknown)}.')
    if 'Nenhuma' in items and len(items) > 1:
        _fail('comorbidities', '"Nenhuma" não pode ser marcada junto com outras comorbidades.')
    if state.get('cpf') and not valid_cpf(state['cpf']):
        _fail('cpf', 'CPF inválido.')


def _accept(user: User, profile: str, data: dict, channel: str) -> ConsentAcceptance:
    document = ConsentDocument.current(consent_kind(profile))
    if document is None:
        _fail('tcleAccepted', 'O termo está indisponível no momento. Tente novamente mais tarde.')
    if not data.get('tcleAccepted'):
        _fail('tcleAccepted', 'É preciso aceitar o termo antes de concluir. Sem aceite, nenhum dado é gravado.')
    if data.get('tcleVersion') and data['tcleVersion'] != document.version:
        _fail('tcleVersion', 'O termo foi atualizado. Leia e aceite a versão vigente.')
    acceptance = ConsentAcceptance.objects.create(user=user, document=document, channel=channel)
    title = 'TCLE aceito' if document.kind == ConsentDocument.Kind.TCLE else 'Termos aceitos'
    ChangeEvent.objects.create(participant=user.participant, icon='shield', title=title, detail=f'Versão {document.version}', actor=user)
    return acceptance


def _has_current_consent(user: User, profile: str) -> bool:
    document = ConsentDocument.current(consent_kind(profile))
    return bool(document) and user.consents.filter(document=document).exists()


@transaction.atomic
def register(data: dict) -> User:
    profile = data.get('profile')
    if not profile:
        _fail('profile', 'Escolha o perfil.')
    channel = data.get('channel') or Channel.WEB
    email, phone = data.get('email') or None, data.get('phone') or None
    password = data.get('password') or ''

    if profile == Profile.CONVIDADO and phone:
        _fail('phone', GUEST_EMAIL_ONLY)
    if not email and not phone:
        message = GUEST_NEEDS_EMAIL if profile == Profile.CONVIDADO else 'Informe um e-mail ou telefone para acessar a conta.'
        _fail('email', message)
    if profile in CLINICAL_PROFILES:
        if not data.get('name', '').strip():
            _fail('name', 'Informe o nome.')
        if not password:
            _fail('password', 'Crie uma senha.')
    _check_profile_rules(profile, data)
    if password:
        _check_password(password)
    if profile == Profile.CONVIDADO:
        _check_returning_guest(email)
    for field, value in (('email', email), ('phone', phone), ('cpf', data.get('cpf'))):
        _check_unique(field, value, None)

    user = User(role=Role.PARTICIPANT, name=data.get('name', '').strip(), email=email, phone=phone, cpf=data.get('cpf') or None)
    user.set_password(password) if password else user.set_unusable_password()
    user.save()
    participant = Participant.objects.create(
        user=user,
        profile=profile,
        allow_location=data.get('allowLocation', False),
        ultimo_acesso=timezone.now(),
        **{field: data[field] for field in CLINICAL_FIELDS if data.get(field)},
        **{field: data.get(field, '') for field in LOCATION_FIELDS},
    )
    ChangeEvent.objects.create(participant=participant, icon='person', title='Conta criada', detail=f'Perfil {participant.get_profile_display()}', actor=user)
    _accept(user, profile, data, channel)
    notices = data.get('notices') or {}
    Preferences.objects.create(participant=participant, **{key: notices.get(key, False) for key in ('campaigns', 'events', 'official')})
    # O canal e-mail só liga quando a pessoa digitar o código no app.
    if notices.get('email') and user.email:
        send_email_code(user)
    JourneyProgress.objects.create(participant=participant, region=_region_for(participant.uf))
    record_login(user, channel)
    return user


def _check_returning_guest(email: str) -> None:
    owner = User.objects.filter(role=Role.PARTICIPANT, email__iexact=email).select_related('participant').first()
    if owner is None:
        return
    if owner.participant.profile == Profile.CONVIDADO and owner.is_active and not owner.has_usable_password():
        raise ReturningGuest(owner)
    _fail('email', OWNED_BY_ACCOUNT)


def send_guest_code(user: User) -> None:
    code = PasswordResetCode.issue(user, PasswordResetCode.Purpose.ACESSO)
    send_mail(
        'Seu código de acesso · STEM Project',
        f'Seu código é {code}. Ele vale por {settings.PASSWORD_RESET_CODE_MINUTES} minutos.\n'
        'Digite o código no aplicativo para voltar ao seu acesso de convidado. Se você não pediu, ignore este e-mail.',
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        fail_silently=True,
    )


def enter_returning_guest(data: dict) -> User:
    """Volta do convidado com o código do e-mail: reaproveita o registro e as preferências (RF02).

    Os avisos marcados agora só ligam: o que estava ligado continua, para a etapa de entrada (tudo desmarcado) não
    desligar escolhas antigas. O aceite dos termos só é gravado de novo se a versão vigente mudou.
    """
    user = (
        User.objects.filter(role=Role.PARTICIPANT, email__iexact=data['email'].strip(), participant__profile=Profile.CONVIDADO)
        .select_related('participant')
        .first()
    )
    entry = PasswordResetCode.verify(user, data['code'], PasswordResetCode.Purpose.ACESSO) if user and user.is_active else None
    if entry is None:  # fora da transação: a tentativa errada fica contada mesmo com o erro
        _fail('code', 'Código inválido ou expirado.')
    with transaction.atomic():
        return _reenter(user, entry, data)


def _reenter(user: User, entry: PasswordResetCode, data: dict) -> User:
    now = timezone.now()
    entry.used_at = now
    entry.save(update_fields=['used_at'])
    channel = data.get('channel') or Channel.WEB
    if not _has_current_consent(user, Profile.CONVIDADO):
        _accept(user, Profile.CONVIDADO, data, channel)
    # O código chegou nesse endereço: ele está confirmado para os avisos por e-mail.
    if user.email_confirmado_em is None:
        user.email_confirmado_em = now
        user.save(update_fields=['email_confirmado_em'])
    prefs, _ = Preferences.objects.get_or_create(participant=user.participant)
    notices = data.get('notices') or {}
    turned_on = [key for key in ('email', 'campaigns', 'events', 'official') if notices.get(key)]
    for key in turned_on:
        setattr(prefs, key, True)
    if turned_on:
        prefs.save(update_fields=turned_on)
    record_login(user, channel)
    touch(user.participant, now)
    return user


def touch(participant: Participant, now: datetime | None = None) -> None:
    """Registra o último acesso; é dele que conta o prazo do convidado."""
    now = now or timezone.now()
    if participant.ultimo_acesso and now - participant.ultimo_acesso < TOUCH_EVERY:
        return
    Participant.objects.filter(pk=participant.pk).update(ultimo_acesso=now)
    participant.ultimo_acesso = now


def expire_guests(now: datetime) -> int:
    """Inativa e anonimiza o convidado sem acesso há GUEST_RETENTION_DAYS (RF02). Devolve quantos saíram."""
    limit = now - timedelta(days=settings.GUEST_RETENTION_DAYS)
    stale = Participant.objects.filter(
        Q(ultimo_acesso__lt=limit) | Q(ultimo_acesso__isnull=True, created_at__lt=limit),
        profile=Profile.CONVIDADO,
        anonymized_at__isnull=True,
        user__status=Status.ATIVO,
    ).select_related('user')
    count = 0
    for participant in stale:
        anonymize(participant)
        count += 1
    return count


def _region_for(uf: str) -> str:
    return {'AL': 'maceio', 'PE': 'recife'}.get(uf, 'maceio' if not uf else 'outra')


def _changes(participant: Participant, data: dict) -> list[tuple[str, str, str]]:
    user = participant.user
    events: list[tuple[str, str, str]] = []
    if 'name' in data and data['name'].strip() != user.name:
        events.append(('person', 'Nome atualizado', ''))
    if 'email' in data and (data['email'] or None) != user.email:
        events.append(('person', 'E-mail atualizado', ''))
    if 'phone' in data and (data['phone'] or None) != user.phone:
        events.append(('person', 'Telefone atualizado', ''))
    if 'cpf' in data and (data['cpf'] or None) != user.cpf:
        events.append(('person', 'CPF atualizado', ''))
    if 'weight' in data and data['weight'] != participant.weight:
        before = f'{format_decimal(participant.weight)} kg → ' if participant.weight else ''
        events.append(('pulse', 'Peso alterado', f'{before}{format_decimal(data["weight"])} kg'))
    if 'height' in data and data['height'] != participant.height:
        before = f'{format_decimal(participant.height)} m → ' if participant.height else ''
        events.append(('pulse', 'Altura alterada', f'{before}{format_decimal(data["height"])} m'))
    if 'sex' in data and data['sex'] != participant.sex:
        events.append(('pulse', 'Sexo biológico alterado', SEX_LABEL.get(data['sex'], '')))
    if 'comorbidities' in data:
        old, new = set(participant.comorbidities), set(data['comorbidities'])
        events += [('pulse', 'Comorbidade adicionada', item) for item in sorted(new - old)]
        events += [('pulse', 'Comorbidade removida', item) for item in sorted(old - new)]
    if any(field in data and data[field] != getattr(participant, field) for field in LOCATION_FIELDS):
        city = data.get('city', participant.city)
        uf = data.get('uf', participant.uf)
        events.append(('pulse', 'Localização atualizada', '/'.join(part for part in (city, uf) if part)))
    if 'allowLocation' in data and data['allowLocation'] != participant.allow_location:
        events.append(('shield', 'Localização por GPS ativada' if data['allowLocation'] else 'Localização por GPS desativada', ''))
    return events


def _apply(participant: Participant, data: dict, actor: User) -> None:
    user = participant.user
    for field, value in (('email', data.get('email')), ('phone', data.get('phone')), ('cpf', data.get('cpf'))):
        if field in data:
            _check_unique(field, value or None, user)
    for icon, title, detail in _changes(participant, data):
        ChangeEvent.objects.create(participant=participant, icon=icon, title=title, detail=detail, actor=actor)

    previous_email = user.email
    for field in ('name', 'email', 'phone', 'cpf'):
        if field in data:
            setattr(user, field, data[field].strip() if field == 'name' else data[field] or None)
    if (user.email or '').strip().lower() != (previous_email or ''):
        email_changed(user)
    if not user.email and not user.phone:
        _fail('email', 'Mantenha ao menos um e-mail ou telefone na conta.')
    user.save()
    for field in (*CLINICAL_FIELDS, *LOCATION_FIELDS):
        if field in data:
            setattr(participant, field, data[field])
    if 'allowLocation' in data:
        participant.allow_location = data['allowLocation']
    participant.save()


def _state(participant: Participant, data: dict) -> dict:
    current = {field: getattr(participant, field) for field in CLINICAL_FIELDS}
    current['cpf'] = participant.user.cpf
    return {**current, **{key: data[key] for key in (*CLINICAL_FIELDS, 'cpf') if key in data}}


@transaction.atomic
def update(participant: Participant, data: dict, actor: User) -> None:
    data = {key: value for key, value in data.items() if key not in ('profile', 'password', 'tcleAccepted', 'tcleVersion', 'channel', 'notices')}
    if participant.profile == Profile.CONVIDADO and data.get('phone'):
        _fail('phone', GUEST_EMAIL_ONLY)
    _check_profile_rules(participant.profile, _state(participant, data))
    _apply(participant, data, actor)


@transaction.atomic
def change_profile(participant: Participant, data: dict) -> None:
    """Convidado vira doador/receptor (RF002 Obs2) ou doador e receptor trocam de jornada."""
    user = participant.user
    new_profile = data.get('profile')
    if new_profile not in CLINICAL_PROFILES:
        _fail('profile', 'Escolha doador ou receptor.')
    _check_profile_rules(new_profile, _state(participant, data))
    if not user.has_usable_password():
        if not data.get('password'):
            _fail('password', 'Crie uma senha para acessar a conta de doador ou receptor.')
        _check_password(data['password'], user)
        user.set_password(data['password'])
        user.save(update_fields=['password'])
    fields = {key: value for key, value in data.items() if key not in ('profile', 'password', 'tcleAccepted', 'tcleVersion', 'channel')}
    _apply(participant, fields, user)

    old_label = participant.get_profile_display()
    participant.profile = new_profile
    participant.save(update_fields=['profile'])
    if old_label != participant.get_profile_display():
        ChangeEvent.objects.create(participant=participant, icon='person', title='Perfil alterado', detail=f'{old_label} → {participant.get_profile_display()}', actor=user)
        # As marcas eram da jornada do perfil anterior: o guia novo começa sem etapas feitas.
        JourneyProgress.objects.update_or_create(participant=participant, defaults={'done': [], 'checklist': {}})
    if not _has_current_consent(user, new_profile):
        _accept(user, new_profile, data, data.get('channel') or Channel.WEB)


@transaction.atomic
def anonymize(participant: Participant) -> None:
    """Inativação sem exclusão física (RF001): identificadores e dado clínico saem; fica o mínimo agregável."""
    user = participant.user
    user.name = ''
    user.email = None
    user.phone = None
    user.cpf = None
    user.email_confirmado_em = None
    user.set_unusable_password()
    user.save()
    PushToken.objects.filter(user=user).delete()
    set_status(user, Status.INATIVO, actor=user)

    participant.weight = None
    participant.height = None
    participant.sex = ''
    participant.comorbidities = []
    for field in LOCATION_FIELDS:
        if field != 'uf':
            setattr(participant, field, '')
    participant.allow_location = False
    participant.anonymized_at = timezone.now()
    participant.save()
    participant.history.update(detail='')
    ChangeEvent.objects.create(participant=participant, icon='person', title='Conta inativada', actor=None)
    SavedContent.objects.filter(participant=participant).delete()
    # As etapas marcadas no guia dizem respeito à saúde do titular (doação ou tratamento).
    JourneyProgress.objects.filter(participant=participant).update(done=[], checklist={})
    Preferences.objects.filter(participant=participant).update(push=False, email=False, campaigns=False, events=False, official=False)


def payload(participant: Participant) -> dict:
    user = participant.user
    acceptance = (
        user.consents.filter(document__kind=consent_kind(participant.profile)).select_related('document').first()
    )
    current = ConsentDocument.current(consent_kind(participant.profile))
    return {
        'id': user.pk,
        'profile': participant.profile,
        'name': user.name,
        'email': user.email or '',
        'emailConfirmed': user.email_confirmado_em is not None,
        'phone': user.phone or '',
        'cpf': user.cpf or '',
        'weight': format_decimal(participant.weight),
        'height': format_decimal(participant.height),
        'sex': participant.sex,
        'comorbidities': participant.comorbidities,
        'cep': participant.cep,
        'address': participant.address,
        'number': participant.number,
        'district': participant.district,
        'city': participant.city,
        'uf': participant.uf,
        'complement': participant.complement,
        'allowLocation': participant.allow_location,
        'tcleAccepted': bool(acceptance and current and acceptance.document_id == current.pk),
        'tcleVersion': acceptance.document.version if acceptance else (current.version if current else ''),
        'tcleAcceptedAt': acceptance.accepted_at.isoformat() if acceptance else None,
        'tcleChannel': acceptance.channel if acceptance else '',
        'hasPassword': user.has_usable_password(),
        'status': user.status,
        'createdAt': user.created_at.isoformat(),
    }


def export(participant: Participant) -> dict:
    """Portabilidade (LGPD art. 18): tudo o que o STEM guarda sobre o titular."""
    data = payload(participant)
    data['consents'] = [
        {'document': str(item.document), 'acceptedAt': item.accepted_at.isoformat(), 'channel': item.channel}
        for item in participant.user.consents.select_related('document')
    ]
    data['history'] = [
        {'title': item.title, 'detail': item.detail, 'when': item.created_at.isoformat()} for item in participant.history.all()
    ]
    journey = JourneyProgress.objects.filter(participant=participant).first()
    if journey is not None:
        data['journey'] = {'region': journey.region, 'done': journey.done, 'checklist': journey.checklist}
    data['logins'] = [
        {'channel': item.channel, 'when': item.created_at.isoformat()} for item in participant.user.logins.all()[:50]
    ]
    return data
