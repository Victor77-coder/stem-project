# Coletas (Prefect + Celery)

Mesma divisão do controlegov-platform:

- **Prefect** é dono do agendamento, dos retries e da execução dos coletores (`workers/flows/collect.py`).
- **Celery** executa o que a API dispara, por exemplo "coletar agora" no painel (`backend/ingestion/tasks.py`).
- **Coletores** são funções puras em `workers/collectors/`; a imagem `stem-collectors` roda `python -m workers` e envia o payload canônico para `POST /api/internal/ingest/` com `INGEST_API_TOKEN`.

```
Prefect (cron ou painel via Celery) -> prefect-worker -> container stem-collectors -> FTP DATASUS / site do CNES / Tabnet / REDOME
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

```bash
# Estatísticas de transplante de medula (Tabnet + REDOME), últimos 5 anos completos
docker compose exec prefect-worker prefect deployment run 'stem.collect/tcth-estatisticas'

# Anos completos até uma competência específica
docker compose exec prefect-worker prefect deployment run 'stem.collect/tcth-estatisticas' --param competencia=2412
```

Pelo painel (administrador): `POST /api/v1/staff/collections/` com `{"source": "cnes"}` ou `{"source": "tcth"}` coleta o Brasil inteiro. O histórico de cargas fica em `GET /api/v1/staff/collections/`.

## Rodar um coletor sem Prefect

```bash
python -m workers --source cnes --ufs AL --competencia 2609 --skip-ingest
python -m workers --source tcth --skip-ingest
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

## Estatísticas de transplante de medula (`tcth`)

Fontes, ambas públicas e sem login:

| Fonte | O que vem | Como |
|---|---|---|
| DataSUS/Tabnet, SIH/SUS ("Procedimentos hospitalares do SUS - por local de residência") | Internações por TCTH por UF de residência do paciente e ano de processamento | `POST` no `tabcgi.exe?sih/cnv/qruf.def` com saída `prn` (colunas separadas por `;`) |
| REDOME/INCA, painel Power BI "Acesse os dados de doadores" (linkado em "REDOME em números") | Doadores cadastrados por UF em cada ano, a mesma contagem do painel com o filtro "Ano" | Consulta agregada à API pública do visualizador do Power BI (`workers/collectors/powerbi.py`) |

Recorte do Tabnet:

- Procedimentos SIGTAP 05.05.01.001-1 a 05.05.01.008-9 (alogênico aparentado e não aparentado de medula, cordão e sangue periférico; autogênico de medula e sangue periférico). Córnea e outros tecidos da mesma forma de organização ficam de fora.
- Conteúdo "Internações", que não conta AIH de continuação: cada transplante entra uma vez.
- Por residência do paciente, o mesmo critério dos doadores: o morador de Alagoas transplantado em Pernambuco conta para Alagoas (AL 2025: 51 por residência, 0 por local de internação). O total do Brasil é o mesmo nos dois recortes.
- Só anos com os 12 meses publicados; padrão: os 5 últimos. Cada carga recoleta a janela inteira porque o SIH revisa os últimos meses.
- Os valores das opções do formulário do Tabnet são índices internos; o coletor lê o formulário a cada carga e acha cada procedimento pelo código SIGTAP.

Como a carga vira indicador (`catalog.Statistic`):

- `transplantes` com recorte `BR` e com recorte de cada UF; `transplantes_regiao` por região, todos por ano. Regiões são a soma das UFs; o Brasil soma também quem está sem UF de residência válida (ignorada ou exterior), que gera aviso na carga. Se o total não bater com o do Tabnet, a carga registra aviso.
- `doadores` com recorte `BR`, de cada UF e de cada região, por ano de cadastro, nos mesmos anos dos transplantes. O Brasil inclui quem está sem UF informada, por isso pode ser maior que a soma das UFs.

Recorte do REDOME:

- A mesma contagem que o painel mostra ("Total de doadores" e o gráfico por estado) com o filtro "Ano" (`DIM_CALENDARIO.Ano`): quantos se cadastraram naquele ano. Qualquer pessoa confere no Power BI (ex.: Alagoas, 2025: 2.454; Brasil, 2025: 148.618). Conta todos os cadastros do ano, inclusive de quem depois foi afastado, saiu por idade ou faleceu. Para contar só ativos, filtre `FT_DOADORES.DS_SITUACAO_DOADOR` em `redome_query`.
- O total acumulado do painel (com "Ano" em "Todos", ex.: AL 71.794) não é coletado: o filtro de ano do app não tem "Todos".
- O contador "5,9 milhões" do site usa outra definição e não é usado, nem como reserva: se o painel falhar, a carga segue sem doadores e a API mantém a última extração.
- Em `GET /api/v1/estatisticas/`, os dois cartões (`headline.donors` e `headline.transplants`) seguem os filtros de Estado e de Ano do app. `uf=BR` (padrão) é o Brasil (2025: 148.618 cadastros, inclui quem está sem UF; 3.258 transplantes) e `uf=AL` é Alagoas (2025: 2.454 cadastros; 51 transplantes). Os valores vão em número completo, como no painel. Com `uf=BR` não há tempo de espera (só existe por região) nem região destacada.
- O modelo público do painel tem uma linha por doador (data de nascimento, sexo, raça, UF, hemocentro). **Só consultas agregadas**; nunca peça linhas individuais.
- A API do visualizador não é documentada pela Microsoft. Mudança de formato vira erro explícito na carga (UF faltando, total fora da faixa, consulta recusada), nunca número adivinhado.
- Cada carga grava uma extração datada; a API pública lê a mais recente e o histórico fica no banco. A carga conta `novos`, `alterados` (revisões do SIH) e `inalterados`.
- Os números de exemplo do `seed_mvp` saem do indicador assim que ele recebe dado coletado, e o seed não os recria.

Limites conhecidos:

- O SIH conta só transplantes pagos pelo SUS. Os da rede privada não aparecem, por isso o aviso de subnotificação.
- O tempo médio de busca de doador (`espera`) não tem fonte pública aberta e continua com os números de exemplo do seed.
- O painel do REDOME também tem os novos cadastros por ano de cadastro (página "Evolução"), por UF. Ainda não é coletado: exige um indicador novo.
