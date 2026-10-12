#!/usr/bin/env bash
# Deploys a release on the server. The release workflow uploads deploy/ to
# /opt/ai-hub/incoming/ and runs this from there. To resume a deploy by hand,
# for example after a dropped connection:
#   bash /opt/ai-hub/incoming/deploy.sh vX.Y.Z
set -euo pipefail
tag=${1:?usage: deploy.sh vX.Y.Z}

cd /opt/ai-hub
grep -q '^IMAGE_TAG=' .env || { echo "IMAGE_TAG= line missing from .env" >&2; exit 1; }

# Overrides .env until the migration succeeds, so a failed one leaves .env
# naming the version that is still running.
export IMAGE_TAG="$tag"
# The new compose file, with relative paths like .env still resolving here.
incoming=(--project-directory . -f incoming/docker-compose.yaml)
docker compose "${incoming[@]}" pull app scheduler frontend
docker compose "${incoming[@]}" run --rm app alembic upgrade head

# cp, not mv: containers mount these files, and after a mv they'd keep reading
# the old ones. Not this script, which keeps running from incoming/.
cp incoming/docker-compose.yaml incoming/Caddyfile incoming/otel-collector.yaml .
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$tag/" .env

docker compose up -d --wait --wait-timeout 120 --remove-orphans
# Graceful, and a no-op when the Caddyfile hasn't changed.
docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose restart otel-collector
docker image prune -af
