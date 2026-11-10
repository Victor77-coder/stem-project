# Coletas (Prefect + Celery)

Mesma divisão do controlegov-platform:

- **Prefect** é dono do agendamento, dos retries e da execução dos coletores (`workers/flows/collect.py`).
- **Celery** executa o que a API dispara, por exemplo "coletar agora" no painel (`backend/ingestion/tasks.py`).
- **Coletores** são funções puras em `workers/collectors/`; a imagem `stem-collectors` roda `python -m workers` e envia o payload canônico para `POST /api/internal/ingest/` com `INGEST_API_TOKEN`.

```
Prefect (cron ou painel via Celery) -> prefect-worker -> container stem-collectors -> FTP DATASUS / site do CNES
                                                                    |
                                                                    v
                                          API Django /api/internal/ingest/ -> CollectionRun + Center
```

## Serviços do compose

| Serviço | Papel |
|---|---|
| `broker` | Redis da fila do Celery (`noeviction`, separado do `cache`) |
| `celery-worker` | Tarefas da API (`-Q celery`) |
| `prefect-db` | Postgres do Prefect |
| `prefect-server` | API e UI do Prefect, em `http://127.0.0.1:4200` (login em `PREFECT_AUTH`) |
| `prefect-worker` | Pool `stem-docker`; inicia um container de coletor por execução (precisa de `docker.sock`) |
| `collectors` | Só constrói a imagem `stem-collectors:local` |

## Primeira vez

```bash
docker compose up -d --build
docker compose exec prefect-worker /app/workers/prefect/deploy.sh
```

## Disparo manual

```bash
# CNES, competência mais recente, todo o Brasil (padrão do deployment)
docker compose exec prefect-worker prefect deployment run 'stem.collect/cnes-centros'

# Competência e UFs específicas
docker compose exec prefect-worker prefect deployment run 'stem.collect/cnes-centros' \
  --param competencia=2609 --param 'ufs=["AL","PE"]'
```

Pelo painel (administrador): `POST /api/v1/staff/collections/` com `{"source": "cnes"}` coleta o Brasil inteiro. O histórico de cargas fica em `GET /api/v1/staff/collections/`.

## Rodar um coletor sem Prefect

```bash
python -m workers --source cnes --ufs AL --competencia 2609 --skip-ingest
```

## Nova fonte

1. Coletor em `workers/collectors/<fonte>/` e registro em `workers/sources.py`.
2. Aplicação do payload em `backend/ingestion/sources/<fonte>.py`, registrada em `APPLIERS` e `DEPLOYMENTS`.
3. Deployment em `deployments/prefect.yaml` e `deploy.sh` de novo.

## Política da coleta de centros (CNES)

- Novo estabelecimento entra publicado (`CNES_AUTO_PUBLISH=1`, padrão). Com `CNES_AUTO_PUBLISH=0`, entra como rascunho e a equipe aprova no painel.
- Centro publicado recebe só mudanças seguras (fonte, data, código IBGE, telefone ausente).
- Coordenada a mais de 1 km, tipo diferente ou habilitações alteradas: o centro continua publicado e fica com `revisar=true` e o motivo.
- Saiu do recorte: vai para inativo.
- Centros com `origem=manual` (campanhas, unidades sem CNES próprio) nunca são alterados.
