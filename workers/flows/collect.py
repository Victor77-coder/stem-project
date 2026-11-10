from __future__ import annotations

import json
import os
from typing import Any
from urllib.request import Request, urlopen

import docker
from prefect import flow, get_run_logger, task

from workers.collectors.cnes.collector import UFS

DEFAULT_INGEST_URL = 'http://api:8000/api/internal/ingest/'


def collector_command(source: str, ufs: list[str], competencia: str, run_id: int | None, ingest_url: str) -> list[str]:
    command = ['--source', source, '--ufs', ','.join(ufs), '--ingest-url', ingest_url]
    if competencia:
        command += ['--competencia', competencia]
    if run_id is not None:
        command += ['--run-id', str(run_id)]
    return command


def report_failure(source: str, run_id: int | None, message: str) -> None:
    """Sem isto, uma coleta pedida pelo painel ficaria 'enfileirada' para sempre."""
    url = os.environ.get('INGEST_URL', DEFAULT_INGEST_URL)
    token = os.environ.get('INGEST_API_TOKEN', '')
    body = json.dumps({'source': source, 'run_id': run_id, 'error': message[:2000]}).encode('utf-8')
    request = Request(url, data=body, method='POST', headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {token}'})
    with urlopen(request, timeout=30):
        pass


@task(retries=2, retry_delay_seconds=60)
def run_collector_container(source: str, ufs: list[str], competencia: str, run_id: int | None) -> dict[str, Any]:
    logger = get_run_logger()
    image = os.environ.get('COLLECTORS_IMAGE', 'stem-collectors:local')
    network = os.environ.get('COLLECTORS_NETWORK', 'stem-net')
    ingest_url = os.environ.get('INGEST_URL', DEFAULT_INGEST_URL)
    token = os.environ.get('INGEST_API_TOKEN', '')
    if not token:
        raise RuntimeError('INGEST_API_TOKEN é obrigatório para iniciar coletores')

    command = collector_command(source, ufs, competencia, run_id, ingest_url)
    logger.info('iniciando coletor image=%s network=%s command=%s', image, network, ' '.join(command))
    client = docker.from_env()
    container = client.containers.run(
        image=image,
        command=command,
        environment={'INGEST_API_TOKEN': token, 'INGEST_URL': ingest_url},
        network=network,
        volumes={os.environ.get('COLLECTORS_DATA_VOLUME', 'stem-collector-data'): {'bind': '/app/.data', 'mode': 'rw'}},
        detach=True,
    )
    try:
        for chunk in container.logs(stream=True, follow=True):
            line = chunk.decode('utf-8', errors='replace').rstrip()
            if line:
                logger.info(line)
        status = int(container.wait().get('StatusCode', 1))
        if status != 0:
            raise RuntimeError(f'coletor terminou com status {status}')
        return {'source': source, 'ufs': ufs, 'competencia': competencia, 'status': status}
    finally:
        try:
            container.remove(force=True)
        except docker.errors.APIError:
            logger.warning('não foi possível remover o container %s', container.id)


@flow(name='stem.collect')
def collect_flow(source: str, ufs: list[str] | None = None, competencia: str = '', run_id: int | None = None) -> dict[str, Any]:
    ufs = ufs or list(UFS)
    try:
        return run_collector_container(source, ufs, competencia, run_id)
    except Exception as exc:
        try:
            report_failure(source, run_id, str(exc))
        except Exception as report_exc:  # noqa: BLE001
            get_run_logger().warning('falha ao registrar o erro na API: %s', report_exc)
        raise
