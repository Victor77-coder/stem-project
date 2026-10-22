from rest_framework.views import exception_handler as drf_exception_handler


def exception_handler(exc, context):
    """Garante um campo `detail` legível em pt-BR para o app e o painel exibirem."""
    response = drf_exception_handler(exc, context)
    if response is None or not isinstance(response.data, dict) or 'detail' in response.data:
        return response
    first = next(iter(response.data.values()), None)
    if isinstance(first, list) and first:
        first = first[0]
    if isinstance(first, str):
        response.data['detail'] = first
    return response
