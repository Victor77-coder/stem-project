import hmac
import json
import logging

from django.conf import settings
from django.db import transaction
from django.http import HttpRequest, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from .models import CollectionRun
from .sources import APPLIERS

logger = logging.getLogger(__name__)


def _authorized(request: HttpRequest) -> JsonResponse | None:
    expected = settings.INGEST_API_TOKEN
    if not expected:
        return JsonResponse({'detail': 'INGEST_API_TOKEN não configurado.'}, status=503)
    header = request.META.get('HTTP_AUTHORIZATION', '')
    given = header.removeprefix('Bearer ').strip() if header.startswith('Bearer ') else ''
    if not hmac.compare_digest(given.encode(), expected.encode()):
        return JsonResponse({'detail': 'Token de ingestão inválido.'}, status=401)
    return None


def _run_for(payload: dict) -> CollectionRun:
    run = CollectionRun.objects.filter(pk=payload.get('run_id'), source=payload['source']).first() if payload.get('run_id') else None
    if run is None:
        run = CollectionRun(source=payload['source'], filters=payload.get('filters') or {})
    run.status = CollectionRun.Status.EXECUTANDO
    run.started_at = run.started_at or timezone.now()
    run.save()
    return run


def _finish(run: CollectionRun, status: str, **fields) -> None:
    for key, value in fields.items():
        setattr(run, key, value)
    run.status, run.finished_at = status, timezone.now()
    run.save()


@csrf_exempt
@require_POST
def ingest(request: HttpRequest) -> JsonResponse:
    """Recebe o payload canônico dos coletores (rede interna do compose, token Bearer)."""
    denied = _authorized(request)
    if denied is not None:
        return denied
    try:
        payload = json.loads(request.body or b'{}')
    except (UnicodeDecodeError, json.JSONDecodeError):
        return JsonResponse({'detail': 'JSON inválido.'}, status=400)
    if not isinstance(payload, dict) or payload.get('source') not in APPLIERS:
        return JsonResponse({'detail': f'Fonte desconhecida: {payload.get("source") if isinstance(payload, dict) else ""}'}, status=400)

    run = _run_for(payload)
    if payload.get('error'):
        _finish(run, CollectionRun.Status.ERRO, error=str(payload['error'])[:5000])
        return JsonResponse({'status': 'erro', 'collection_run_id': run.pk})

    canonical = payload.get('canonical')
    if not isinstance(canonical, dict) or not canonical.get('competencia'):
        _finish(run, CollectionRun.Status.ERRO, error='Payload canônico ausente ou sem competência.')
        return JsonResponse({'detail': 'Payload canônico ausente ou sem competência.', 'collection_run_id': run.pk}, status=400)

    try:
        with transaction.atomic():
            result = APPLIERS[payload['source']](canonical)
    except Exception as exc:
        logger.exception('Falha ao aplicar a carga %s', run.pk)
        _finish(run, CollectionRun.Status.ERRO, competencia=canonical['competencia'], error=f'{type(exc).__name__}: {exc}'[:5000])
        return JsonResponse({'status': 'erro', 'collection_run_id': run.pk, 'detail': str(exc)}, status=500)

    _finish(
        run,
        CollectionRun.Status.SUCESSO,
        competencia=canonical['competencia'],
        stats=result['stats'],
        raw_files=canonical.get('raw_files', []),
        warnings=[*canonical.get('warnings', []), *result['warnings']],
        error='',
    )
    return JsonResponse({'status': 'sucesso', 'collection_run_id': run.pk, 'stats': result['stats']})
