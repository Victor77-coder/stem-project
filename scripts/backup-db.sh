#!/usr/bin/env bash
# RS002: cópia do Postgres com pg_dump, para rodar uma vez por dia (cron) no servidor.
# Guarda 7 cópias diárias e 4 semanais (a de domingo) e confere se cada cópia abre no pg_restore.
#
# Uso, na raiz do projeto e com o compose no ar:
#   scripts/backup-db.sh [pasta]        # padrão: ./backups (fora do git)
# Restaurar (apaga e recria as tabelas): ver docs/producao.md.
set -euo pipefail

cd "${PROJECT_DIR:-$(dirname "$0")/..}"
dir="${1:-${BACKUP_DIR:-./backups}}"
keep_daily="${KEEP_DAILY:-7}"
keep_weekly="${KEEP_WEEKLY:-4}"
mkdir -p "$dir/diario" "$dir/semanal"

file="$dir/diario/stem_$(date +%Y-%m-%d_%H%M%S).dump"
trap 'rm -f "$file.tmp"' EXIT
# Formato custom (-Fc): comprimido e restaurável por tabela. Usuário e banco vêm do próprio contêiner.
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$file.tmp"
mv "$file.tmp" "$file"

# Cópia que não abre não é cópia: falha aqui, e o cron avisa.
docker compose exec -T db pg_restore --list < "$file" > /dev/null

if [ "$(date +%u)" = 7 ]; then
  cp "$file" "$dir/semanal/"
fi

# O nome tem data e hora, então a ordem alfabética é a cronológica. find não falha com a pasta vazia.
prune() {
  local folder="$1" keep="$2"
  find "$folder" -maxdepth 1 -type f -name 'stem_*.dump' | sort -r | tail -n +"$((keep + 1))" | while read -r old; do
    rm -f "$old"
  done
}
prune "$dir/diario" "$keep_daily"
prune "$dir/semanal" "$keep_weekly"

echo "backup ok: $file ($(du -h "$file" | cut -f1))"
