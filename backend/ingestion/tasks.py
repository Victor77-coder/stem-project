from celery import shared_task
from django.utils import timezone

from .models import CollectionRun
from .sources import BR_UFS, DEPLOYMENTS


def start_flow_run(deployment: str, parameters: dict) -> str:
    from prefect.deployments import run_deployment

    flow_run = run_deployment(name=deployment, parameters=parameters, timeout=0)
    return str(flow_run.id)


@shared_task(bind=True, ignore_result=True, max_retries=3, default_retry_delay=30)
def trigger_collection(self, run_id: int) -> None:
    """Pede ao Prefect a execução do coletor. ENFILEIRADA passa a significar 'o Prefect aceitou o flow run'."""
    run = CollectionRun.objects.filter(pk=run_id).first()
    if run is None or run.status != CollectionRun.Status.ENFILEIRADA:
        return
    parameters = {
        'source': run.source,
        'ufs': run.filters.get('ufs') or list(BR_UFS),
        'competencia': run.filters.get('competencia') or '',
        'run_id': run.pk,
    }
    try:
        run.flow_run_id = start_flow_run(DEPLOYMENTS[run.source], parameters)
    except Exception as exc:
        if self.request.retries < self.max_retries:
            raise self.retry(exc=exc) from exc
        run.status, run.finished_at = CollectionRun.Status.ERRO, timezone.now()
        run.error = f'Prefect indisponível: {exc}'[:5000]
    run.save()
