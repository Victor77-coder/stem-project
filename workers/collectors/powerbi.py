"""Consulta a relatórios Power BI publicados na web ("Publicar na Web"), sem login.

É a mesma API que o visualizador público usa, sem documentação oficial: se a Microsoft mudar o formato,
a coleta falha com erro explícito em vez de devolver número errado. Use só consultas agregadas (contagens),
nunca linhas individuais, mesmo quando o modelo do relatório tiver registros por pessoa.
"""

from __future__ import annotations

import base64
import gzip
import json
import re
from dataclasses import dataclass
from typing import Any

VIEW_URL = 'https://app.powerbi.com/view?r={token}'


@dataclass(frozen=True)
class PublicReport:
    resource_key: str
    api: str  # https://wabi-<região>-api.analysis.windows.net
    model_id: int
    dataset_id: str
    report_id: str

    @property
    def headers(self) -> dict[str, str]:
        return {'X-PowerBI-ResourceKey': self.resource_key, 'Accept': 'application/json', 'Content-Type': 'application/json'}

    @property
    def query_url(self) -> str:
        return f'{self.api}/public/reports/querydata?synchronous=true'


def load_json(raw: bytes) -> Any:
    """A API responde em gzip mesmo sem Accept-Encoding; o arquivo bruto fica como veio."""
    return json.loads(gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw)


def view_url(resource_key: str, tenant_id: str) -> str:
    token = json.dumps({'k': resource_key, 't': tenant_id}, separators=(',', ':')).encode()
    return VIEW_URL.format(token=base64.b64encode(token).decode())


def models_url(api: str, resource_key: str) -> str:
    return f'{api}/public/reports/{resource_key}/modelsAndExploration?preferReadOnlySession=true'


def api_from_view(view_html: str) -> str:
    """O visualizador recebe o host de redirecionamento e chama a variante "-api" dele."""
    match = re.search(r"resolvedClusterUri\s*=\s*'(https://[^']+)'", view_html)
    if not match or '-redirect.' not in match.group(1):
        raise RuntimeError('página pública do Power BI sem cluster de dados (resolvedClusterUri)')
    return match.group(1).rstrip('/').replace('-redirect.', '-api.')


def report_from(models: dict[str, Any], resource_key: str, api: str) -> PublicReport:
    try:
        model = models['models'][0]
        return PublicReport(resource_key, api, int(model['id']), str(model['dbName']), str(models['exploration']['report']['objectId']))
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise RuntimeError(f'resposta de modelo do Power BI em formato inesperado ({exc!r})') from exc


def column(source: str, prop: str) -> dict[str, Any]:
    return {'Column': {'Expression': {'SourceRef': {'Source': source}}, 'Property': prop}}


def measure(source: str, prop: str) -> dict[str, Any]:
    return {'Measure': {'Expression': {'SourceRef': {'Source': source}}, 'Property': prop}}


def _literal(value: int | str) -> str:
    if isinstance(value, bool) or not isinstance(value, int | str):
        raise TypeError(f'literal sem suporte na consulta do Power BI: {value!r}')
    return f'{value}L' if isinstance(value, int) else "'" + value.replace("'", "''") + "'"


def is_in(expression: dict[str, Any], values: list[int | str]) -> dict[str, Any]:
    """Filtro "valor está na lista". Inteiros viram literal Int64 (2025L), textos ficam entre aspas."""
    literals = [[{'Literal': {'Value': _literal(value)}}] for value in values]
    return {'Condition': {'In': {'Expressions': [expression], 'Values': literals}}}


def query_body(
    report: PublicReport,
    entities: dict[str, str],
    select: list[dict[str, Any]],
    where: list[dict[str, Any]] | None = None,
    max_rows: int = 1000,
) -> bytes:
    """Consulta agregada: agrupa pelas colunas de ``select`` e calcula as medidas."""
    query = {
        'Version': 2,
        'From': [{'Name': alias, 'Entity': entity, 'Type': 0} for alias, entity in entities.items()],
        'Select': [{**item, 'Name': f'c{index}'} for index, item in enumerate(select)],
        'Where': where or [],
    }
    command = {
        'SemanticQueryDataShapeCommand': {
            'Query': query,
            'Binding': {
                'Primary': {'Groupings': [{'Projections': list(range(len(select)))}]},
                'DataReduction': {'DataVolume': 4, 'Primary': {'Window': {'Count': max_rows}}},
                'Version': 1,
            },
        }
    }
    body = {
        'version': '1.0.0',
        'queries': [
            {
                'Query': {'Commands': [command]},
                'QueryId': '',
                'ApplicationContext': {'DatasetId': report.dataset_id, 'Sources': [{'ReportId': report.report_id}]},
            }
        ],
        'cancelQueries': [],
        'modelId': report.model_id,
    }
    return json.dumps(body, ensure_ascii=False).encode('utf-8')


def decode(response: dict[str, Any]) -> list[list[Any]]:
    """Linhas do formato DSR: "R" marca colunas repetidas da linha anterior, "Ø" marca nulas e "DN"
    aponta para o dicionário de valores (textos comprimidos)."""
    try:
        data = response['results'][0]['result']['data']
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f'resposta do Power BI sem dados: {json.dumps(response)[:300]}') from exc
    dsr = data.get('dsr') or {}
    errors = [shape for shape in dsr.get('DataShapes', []) if 'odata.error' in shape]
    if errors or not dsr.get('DS'):
        raise RuntimeError(f'consulta recusada pelo Power BI: {json.dumps(errors or dsr)[:300]}')
    dataset = dsr['DS'][0]
    if dataset.get('IC') is False or dataset.get('RT'):
        raise RuntimeError('resposta do Power BI truncada; aumente max_rows')
    dicts = dataset.get('ValueDicts', {})
    rows: list[list[Any]] = []
    schema: list[dict[str, Any]] = []
    previous: list[Any] = []
    for row in dataset['PH'][0].get('DM0', []):
        schema = row.get('S', schema)
        repeated, nulls = row.get('R', 0), row.get('Ø', 0)
        values = iter(row.get('C', []))
        current = []
        for index, spec in enumerate(schema):
            if repeated >> index & 1:
                current.append(previous[index])
            elif nulls >> index & 1:
                current.append(None)
            else:
                value = next(values)
                current.append(dicts[spec['DN']][value] if 'DN' in spec and isinstance(value, int) else value)
        rows.append(current)
        previous = current
    return rows
