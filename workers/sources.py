from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Any

from workers.collectors.cnes.collector import UFS, collect as collect_cnes
from workers.collectors.tcth.collector import collect as collect_tcth


def _cnes(params: dict[str, Any], output_root: Path) -> dict[str, Any]:
    return collect_cnes(
        params.get('ufs') or UFS,
        params.get('competencia') or None,
        output_root,
        enrich=params.get('enrich', True),
    )


def _tcth(params: dict[str, Any], output_root: Path) -> dict[str, Any]:
    # Sempre nacional: região e Brasil saem da soma de todas as UFs, então o filtro de UFs não se aplica.
    return collect_tcth(params.get('competencia') or None, output_root)


# Cada fonte recebe parâmetros simples e devolve o payload canônico que a API do STEM ingere.
SOURCES: dict[str, Callable[[dict[str, Any], Path], dict[str, Any]]] = {
    'cnes': _cnes,
    'tcth': _tcth,
}
