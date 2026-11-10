from __future__ import annotations

import tempfile
from collections.abc import Iterable
from pathlib import Path


def read_dbc(path: Path, fields: Iterable[str] | None = None) -> list[dict[str, str]]:
    """Lê um .dbc do DATASUS (DBF compactado). Devolve as linhas como texto, sem espaços nas pontas."""
    import pyreaddbc
    from dbfread import DBF

    wanted = set(fields) if fields else None
    with tempfile.TemporaryDirectory() as tmp:
        dbf_path = Path(tmp) / f'{path.stem}.dbf'
        pyreaddbc.dbc2dbf(str(path), str(dbf_path))
        table = DBF(str(dbf_path), encoding='latin1', char_decode_errors='replace')
        return [
            {key: str(value).strip() if value is not None else '' for key, value in record.items() if wanted is None or key in wanted}
            for record in table
        ]
