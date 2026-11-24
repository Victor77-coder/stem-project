# Produção: HTTPS, backup e checagem do servidor (RS002)

O RS002 pede tráfego HTTPS, senhas com hash, anonimização na inativação e nenhum prontuário guardado. A parte de código está pronta: senhas com hash (Django), anonimização em `participants.services.anonymize`, nenhum dado clínico de API e as configurações abaixo. O que depende do servidor só pode ser confirmado no deploy, com a lista do fim deste documento.

## Variáveis do `.env` do servidor

| Variável | Valor em produção | Por quê |
|---|---|---|
| `DJANGO_DEBUG` | `0` (ou ausente) | Liga as proteções de produção abaixo. |
| `SECRET_KEY` | 50+ caracteres aleatórios | Sem ela a API não sobe. Gere com `python -c "import secrets; print(secrets.token_urlsafe(60))"`. |
| `ALLOWED_HOSTS` | `api.<domínio>,localhost,api` | `localhost` é o healthcheck do Docker; `api` é o nome que os coletores do Prefect usam na rede interna. |
| `CORS_ALLOWED_ORIGINS` | endereço HTTPS do painel | O app não usa CORS; o painel web usa. |
| `PUBLIC_API_URL` | `https://api.<domínio>` | Link "parar de receber" dos e-mails. |
| `SECURE_HSTS_SECONDS` | `31536000` (padrão) | Um ano de HSTS: o navegador não volta a tentar HTTP. |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | `1` só se todos os subdomínios tiverem HTTPS | Com subdomínio sem HTTPS, ele para de abrir nos navegadores. |
| `SECURE_SSL_REDIRECT` | `1` (padrão) | Desligue só se o proxy já redirecionar e houver laço de redirecionamento. |
| `EMAIL_*`, `DEFAULT_FROM_EMAIL`, `EMAIL_DAILY_LIMIT` | ver `docs/notificacoes.md` | Brevo com o domínio da liga. |
| `POSTGRES_PASSWORD`, `INGEST_API_TOKEN`, `PREFECT_AUTH` | segredos fortes | Nunca reaproveite os valores do `.env.example`. |

## HTTPS

A API não termina TLS: um proxy na frente (Caddy, que emite o certificado sozinho, ou Nginx com Certbot) recebe em 443 e repassa para `api:8000` com o cabeçalho `X-Forwarded-Proto: https`. Com `DJANGO_DEBUG=0` (`backend/config/settings.py`):

- toda requisição HTTP é redirecionada para HTTPS (`SECURE_SSL_REDIRECT`) e o HSTS vale por um ano;
- cookies de sessão e CSRF só trafegam por HTTPS;
- ficam em HTTP, de propósito, só `/api/v1/health/` (healthcheck do Docker) e `/api/internal/ingest/` (carga dos coletores pela rede interna). Essas duas rotas não devem ser publicadas no proxy: o `/api/internal/` exige o `INGEST_API_TOKEN`, mas não precisa estar na internet.

Exemplo de Caddyfile:

```
api.<domínio> {
    @internal path /api/internal/*
    respond @internal 404
    reverse_proxy api:8000
}
```

Para conferir as configurações antes do deploy:

```
DJANGO_DEBUG=0 SECRET_KEY=... ALLOWED_HOSTS=api.<domínio> python manage.py check --deploy --tag security
```

Os avisos W004 (HSTS) e W008 (redirecionamento) não aparecem mais. O W021 (pré-carga do HSTS) só some se a liga inscrever o domínio em hstspreload.org, o que é opcional e difícil de desfazer.

## Backup do banco

`scripts/backup-db.sh` faz o `pg_dump` do Postgres do compose (formato custom, comprimido), confere se a cópia abre no `pg_restore` e guarda 7 cópias diárias e 4 semanais (a de domingo). As cópias ficam em `./backups` (fora do git).

No servidor, no `crontab` do usuário que roda o compose:

```
30 3 * * * cd /srv/stem-project && scripts/backup-db.sh >> backups/backup.log 2>&1
```

- **Cópia fora do servidor.** Um backup no mesmo disco some junto com ele. Sincronize `backups/` com um armazenamento externo (por exemplo `rclone` para um bucket com retenção) logo depois do script.
- **Restaurar** (apaga e recria as tabelas do banco atual):

  ```
  docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' < backups/diario/stem_AAAA-MM-DD_HHMMSS.dump
  ```

- **Teste de restauração.** Uma vez por mês, restaure a cópia mais recente num banco de teste e abra o painel. Backup nunca restaurado não conta como backup.
- Os anexos do painel ficam no volume `media-data`: inclua esse volume na cópia externa.

## Outros pontos do servidor

- Um único `celery-beat`: duas réplicas disparariam avisos e o prazo do convidado em dobro.
- Prefect: as coletas seguem pelo `prefect-worker` (ver `workers/prefect/README.md`).
- Push: credenciais FCM (Android) e APNs (iPhone) no EAS, como em `docs/notificacoes.md`.

## Checagem do RS002 no servidor

- [ ] `https://api.<domínio>/api/v1/health/` responde, e `http://` redireciona para `https://`.
- [ ] `https://api.<domínio>/api/internal/ingest/` responde 404 de fora (bloqueado no proxy).
- [ ] `check --deploy --tag security` sem W004 e W008.
- [ ] O cron gerou a cópia do dia em `backups/diario` e ela foi para o armazenamento externo.
- [ ] O teste de restauração do mês foi feito.
- [ ] O `.env` do servidor não tem nenhum valor do `.env.example`.
