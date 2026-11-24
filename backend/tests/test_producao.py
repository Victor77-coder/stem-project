"""RS002: em produção, HTTPS obrigatório, sem quebrar o healthcheck nem a carga interna dos coletores."""

import os
import subprocess
import sys
from pathlib import Path

from django.conf import settings
from django.test import override_settings

BACKEND = Path(__file__).resolve().parent.parent


@override_settings(SECURE_SSL_REDIRECT=True, SECURE_REDIRECT_EXEMPT=settings.SSL_REDIRECT_EXEMPT)
def test_http_is_redirected_except_health_and_internal_ingest(api, db):
    response = api.get('/api/v1/conteudos/')
    assert response.status_code == 301 and response['Location'].startswith('https://')
    assert api.get('/api/v1/health/').status_code == 200, 'o healthcheck do Docker usa HTTP'
    ingest = api.post('/api/internal/ingest/', {}, format='json')
    assert ingest.status_code != 301, 'os coletores chegam por HTTP na rede interna'


def test_deploy_check_has_no_https_warnings():
    env = {
        **os.environ,
        'DJANGO_SETTINGS_MODULE': 'config.settings',
        'DJANGO_DEBUG': '0',
        'SECRET_KEY': 'x' * 60 + 'producao-de-teste',
        'ALLOWED_HOSTS': 'api.exemplo.org',
        'SECURE_HSTS_INCLUDE_SUBDOMAINS': '1',
    }
    result = subprocess.run(
        [sys.executable, 'manage.py', 'check', '--deploy', '--tag', 'security'],
        cwd=BACKEND, env=env, capture_output=True, text=True, check=False,
    )
    output = result.stdout + result.stderr
    assert result.returncode == 0, output
    # W004 (HSTS) e W008 (redirecionar para HTTPS) são os do RS002. W021 (preload) depende de inscrever o domínio.
    assert 'security.W004' not in output and 'security.W008' not in output, output
