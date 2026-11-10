from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from workers.collectors.cnes.collector import UFS
from workers.sources import SOURCES

DEFAULT_OUTPUT_ROOT = Path('/app/.data') if Path('/app/.data').exists() else Path('.data')


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Coleta uma fonte pública e envia o payload canônico para a API do STEM.')
    parser.add_argument('--source', required=True, choices=sorted(SOURCES))
    parser.add_argument('--ufs', default=','.join(UFS), help='UFs separadas por vírgula. Padrão: todo o Brasil.')
    parser.add_argument('--competencia', default='', help='AAMM. Vazio usa a mais recente publicada.')
    parser.add_argument('--run-id', type=int, default=None, help='CollectionRun criado pelo painel, se houver')
    parser.add_argument('--no-enrich', action='store_true', help='Não consulta nome e coordenadas no site do CNES')
    parser.add_argument('--output-root', type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument('--ingest-url', default=os.environ.get('INGEST_URL', ''))
    parser.add_argument('--skip-ingest', action='store_true')
    return parser.parse_args(argv)


def post_payload(url: str, payload: dict[str, Any], token: str) -> dict[str, Any]:
    request = Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': f'Bearer {token}'},
        method='POST',
    )
    try:
        with urlopen(request, timeout=300) as response:
            raw = response.read()
            return json.loads(raw.decode('utf-8')) if raw else {}
    except HTTPError as exc:
        detail = exc.read().decode('utf-8', errors='replace')
        raise SystemExit(f'ingestão falhou: HTTP {exc.code} {detail}') from exc
    except URLError as exc:
        raise SystemExit(f'ingestão falhou: {exc.reason}') from exc


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(name)s: %(message)s')
    args = _parse_args(argv)
    params = {
        'ufs': [uf for uf in args.ufs.split(',') if uf.strip()],
        'competencia': args.competencia,
        'enrich': not args.no_enrich,
    }
    canonical = SOURCES[args.source](params, args.output_root)
    payload = {'source': args.source, 'run_id': args.run_id, 'filters': params, 'canonical': canonical}

    if args.skip_ingest or not args.ingest_url:
        json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
        sys.stdout.write('\n')
        return 0

    token = os.environ.get('INGEST_API_TOKEN', '')
    if not token:
        raise SystemExit('INGEST_API_TOKEN é obrigatório para enviar à API')
    response = post_payload(args.ingest_url, payload, token)
    json.dump(response, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write('\n')
    return 0 if response.get('status') == 'sucesso' else 1


if __name__ == '__main__':
    raise SystemExit(main())
