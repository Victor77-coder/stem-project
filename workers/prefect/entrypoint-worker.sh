#!/bin/sh
set -eu

if ! prefect work-pool inspect stem-docker >/dev/null 2>&1; then
  prefect work-pool create stem-docker --type process
fi
exec prefect worker start --pool stem-docker --type process --limit 2
