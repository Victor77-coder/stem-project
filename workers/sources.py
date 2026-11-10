from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Any

from workers.collectors.cnes.collector import UFS, collect as collect_cnes


def _cnes(params: dict[str, Any], output_root: Path) -> dict[str, Any]:
    return collect_cnes(
        params.get('ufs') or UFS,
        params.get('competencia') or None,
        output_root,
        enrich=params.get('enrich', True),
    )


# Cada fonte recebe parâmetros simples e devolve o payload canônico que a API do STEM ingere.
SOURCES: dict[str, Callable[[dict[str, Any], Path], dict[str, Any]]] = {
    'cnes': _cnes,
}
