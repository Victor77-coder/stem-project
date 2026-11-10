from __future__ import annotations

import hashlib
import json
import logging
import os
import tempfile
from dataclasses import asdict, dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

# O DATASUS publica uma vez por mês; no mesmo dia, coletas repetidas reaproveitam o arquivo.
REVALIDATE_AFTER = timedelta(hours=24)
CHUNK_SIZE_BYTES = 1024 * 1024

STATUS_FRESH = 'fresh'
STATUS_DOWNLOADED = 'downloaded'
STATUS_STALE = 'stale'


@dataclass(frozen=True)
class RemoteFile:
    path: Path
    url: str
    status: str
    sha256: str
    size: int

    def describe(self) -> dict[str, Any]:
        data = asdict(self)
        data['name'] = self.path.name
        data.pop('path')
        return data


def sha256_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as file_obj:
        for chunk in iter(lambda: file_obj.read(CHUNK_SIZE_BYTES), b''):
            digest.update(chunk)
    return digest.hexdigest()


def _metadata_path(path: Path) -> Path:
    return path.with_name(f'{path.name}.meta.json')


def _checked_at(path: Path) -> datetime:
    try:
        raw = json.loads(_metadata_path(path).read_text(encoding='utf-8'))['checked_at']
        return datetime.fromisoformat(raw)
    except (OSError, ValueError, KeyError):
        return datetime.fromtimestamp(path.stat().st_mtime, UTC)


def _download(url: str, path: Path, timeout: int, headers: dict[str, str] | None, data: bytes | None) -> None:
    fd, temp_name = tempfile.mkstemp(prefix=f'.{path.stem}.', suffix='.part', dir=path.parent)
    temp_path = Path(temp_name)
    try:
        with os.fdopen(fd, 'wb') as file_obj, urlopen(Request(url, data=data, headers=headers or {}), timeout=timeout) as response:
            for chunk in iter(lambda: response.read(CHUNK_SIZE_BYTES), b''):
                file_obj.write(chunk)
        if temp_path.stat().st_size == 0:
            raise RuntimeError(f'arquivo vazio em {url}')
        os.replace(temp_path, path)
    finally:
        temp_path.unlink(missing_ok=True)
    _metadata_path(path).write_text(
        json.dumps({'url': url, 'checked_at': datetime.now(UTC).isoformat(timespec='seconds')}),
        encoding='utf-8',
    )


def fetch_remote_file(
    path: Path,
    url: str,
    *,
    timeout: int = 120,
    headers: dict[str, str] | None = None,
    max_age: timedelta = REVALIDATE_AFTER,
    data: bytes | None = None,
) -> RemoteFile:
    """Baixa ``url`` para ``path`` (HTTP ou FTP). Se a fonte falhar e houver cópia local, usa a cópia.

    Com ``data``, a requisição é um POST (consultas do Tabnet); ``path`` deve identificar a consulta.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    status = STATUS_FRESH
    if not path.exists() or datetime.now(UTC) - _checked_at(path) >= max_age:
        try:
            _download(url, path, timeout, headers, data)
            status = STATUS_DOWNLOADED
        except Exception as exc:  # noqa: BLE001
            if not path.exists():
                raise RuntimeError(f'falha ao baixar {url}: {exc}') from exc
            logger.warning('Fonte indisponível para %s; usando cópia local: %s', path.name, exc)
            status = STATUS_STALE
    return RemoteFile(path=path, url=url, status=status, sha256=sha256_of(path), size=path.stat().st_size)
