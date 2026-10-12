# Deployment guide

Production runs on one Hetzner server (Ubuntu LTS, x86) with Docker Compose.
Caddy serves HTTPS in front of the API and the frontend, a container serving
the built [web app](frontend.md). The scheduler, Postgres and Redis run
next to it, reachable only inside Docker's network, along with an OpenTelemetry
Collector that sends container metrics to Logfire. Replace `example.com` with
your domain throughout.

## How a release works

Pushing a `vX.Y.Z` tag runs [`release.yml`](../.github/workflows/release.yml):

1. **check-tag**: checks that the tagged commit is on `main`. The workflow only
   runs for `vX.Y.Z` tags.
2. **ci**: [`ci.yml`](../.github/workflows/ci.yml) for the tagged commit, the
   same checks every pull request gets. Lint and tests for the API and the
   frontend, then the `image` job builds both images and rehearses a deploy
   with them: it starts the prod compose stack with placeholder settings the
   job writes to `.env`, runs the migrations, fails if the models need a
   migration that doesn't exist, waits for the app and frontend to report
   healthy (the app's check reaches Postgres and Redis), calls `/healthz` and
   the frontend through Caddy and checks the crontab. Only on a release does
   it then push those same images as `ghcr.io/mekanbaymyradov/ai-hub:<tag>` and
   `ghcr.io/mekanbaymyradov/ai-hub-frontend:<tag>`, so production runs the
   exact images that passed. Pull requests and `main` push nothing.
3. **deploy**: uploads [`deploy/`](../deploy) to `/opt/ai-hub/incoming/` and
   runs [`deploy.sh`](../deploy/deploy.sh) from there. It runs migrations with
   the new image, and only when they pass copies the files into place,
   restarts the app, scheduler and frontend on the new images, reloads Caddy
   and restarts the collector. A failed migration leaves the live files
   untouched.

The API and the frontend share one version: a release ships both, so the
frontend never runs against an API it wasn't tested with.

`/opt/ai-hub` holds the compose file, `Caddyfile` and `otel-collector.yaml`
from [`deploy/`](../deploy), plus `.env` and `incoming/`, the last release's
upload, where `deploy.sh` runs from.

## Before you start

| Service | Set up |
|---|---|
| Cloudflare DNS | **A** records `api` and `ai-hub` → the server's IPv4, DNS only (grey cloud). No AAAA records: IPv6 clients would reach the app from Docker's gateway address and share one rate-limit bucket. Both names must be on one domain: the refresh cookie is `SameSite=Lax`, so the browser only sends it to the API from a page on the same site. |
| Resend | Verify your domain, and set `EMAIL_FROM` to an address on it. The test sender only delivers to your own account. |
| R2 | Two production buckets, separate from dev. Turn public access off on the private one. Connect a custom domain to the public bucket for `S3_PUBLIC_BASE_URL`, because r2.dev is rate-limited. Create an API token with Object Read & Write on those two buckets only. |
| Logfire | A write token for `LOGFIRE_TOKEN`. |
| LLM providers | Production keys, each with a monthly spend limit, since anyone who signs up spends them. |

## Set up the server (once)

1. **Firewall.** In Hetzner Cloud, create a firewall allowing inbound TCP 22,
   80 and 443, UDP 443 and ICMP, and apply it to the server. It filters traffic
   before it reaches the host, so Docker can't bypass it the way it bypasses ufw.

2. **Deploy user.** As root:

   ```bash
   apt update && apt upgrade -y
   adduser --disabled-password --gecos "" deploy
   install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
   install -m 600 -o deploy -g deploy ~/.ssh/authorized_keys /home/deploy/.ssh/
   install -d -o deploy -g deploy /opt/ai-hub
   ```

3. **SSH: keys only, no root.** sshd keeps the first value it reads, and
   `50-cloud-init.conf` may allow passwords, so this file must sort before it:

   ```bash
   printf 'PermitRootLogin no\nPasswordAuthentication no\n' > /etc/ssh/sshd_config.d/00-hardening.conf
   sshd -T | grep -E '^(permitrootlogin|passwordauthentication)'   # both "no"
   systemctl reload ssh
   ```

   Check that `ssh deploy@<ip>` works from a second terminal before you close
   the root session.

4. **Security updates.** Ubuntu installs them by itself. Check with
   `systemctl status unattended-upgrades`.

5. **Docker.** Install Docker Engine and the Compose plugin from
   [Docker's apt repository](https://docs.docker.com/engine/install/ubuntu/), then:

   ```bash
   usermod -aG docker deploy
   echo '{"log-driver": "local"}' > /etc/docker/daemon.json
   systemctl restart docker
   ```

   The `docker` group is root-equivalent, so keep the `deploy` account for you
   and CD only. The `local` log driver rotates logs; the default one grows until
   the disk is full.

6. **`.env`.** From your laptop, copy the template, then fill it in on the server:

   ```bash
   scp .env.example deploy@<ip>:/opt/ai-hub/.env
   ssh deploy@<ip> chmod 600 /opt/ai-hub/.env
   ```

   | Variable | Value |
   |---|---|
   | `JWT_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD` | `openssl rand -hex 32`, one each. Hex, because the database and Redis URLs are built without escaping. |
   | `CORS_ORIGINS` | `["https://ai-hub.example.com"]`, the frontend's origin |
   | `API_DOMAIN` | `api.example.com`. The frontend's [`.env.production`](../frontend/.env.production) must point at it. |
   | `WEB_DOMAIN` | `ai-hub.example.com` |
   | `IMAGE_TAG` | Leave empty. The release workflow sets it. |
   | `LOGFIRE_TOKEN` | Your write token. Without it the app still runs, but sends nothing to Logfire. |
   | `RESEND_API_KEY`, `EMAIL_FROM`, `S3_*`, LLM keys | The production values from [Before you start](#before-you-start) |

   Leave `ENVIRONMENT`, `POSTGRES_HOST` and `REDIS_HOST` alone: the compose
   file sets them.

## Set up GitHub (once)

1. **CD key.** On your laptop:

   ```bash
   ssh-keygen -t ed25519 -f ai-hub-cd -N '' -C ai-hub-cd
   ssh-copy-id -i ai-hub-cd.pub deploy@<ip>
   ```

2. **Host key.** `ssh-keyscan -t ed25519 <ip>` prints the line for
   `SSH_KNOWN_HOSTS`. Check that its fingerprint
   (`ssh-keyscan -t ed25519 <ip> | ssh-keygen -lf -`) matches the one on the
   server (`ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`).

3. **Environment.** Settings → Environments → New environment `production`:
   - **Deployment branches and tags:** Selected, with the tag rule `v*`, so its
     secrets only reach release runs.
   - **Secret** `SSH_PRIVATE_KEY`: the contents of `ai-hub-cd`. Delete the
     local file afterwards.
   - **Variables** `SSH_HOST` (the server's IP), `SSH_USER` (`deploy`) and
     `SSH_KNOWN_HOSTS` (the line from step 2).

4. **Tag ruleset.** Pushing a tag deploys, so only you should be able to push
   one. Settings → Rules → Rulesets → New tag ruleset: target `v*`, enforcement
   Active, with "Restrict creations", "Restrict updates" and "Restrict
   deletions" checked. Bypass list: Repository admin. Check that no one else
   has the Admin role.

## Release

```bash
git switch main && git pull
git tag v1.0.0
git push origin v1.0.0
```

Follow it under Actions → Release.

On the **first release**, the deploy job can fail when the server pulls the
images, because new GHCR packages start private. Make both packages,
`ai-hub` and `ai-hub-frontend`, public (the repo already is) under each
Package settings → Change visibility, then re-run the deploy job.

**Migrations** must keep the previous release working. They run while the old
app is still serving, and a rollback doesn't undo them. To rename a column, for
example, add the new one in one release and drop the old one in a later one.

## Check a fresh server

After the first deploy:

- `docker compose ps` in `/opt/ai-hub` shows every service up, with the app
  `healthy`.
- `curl -I https://api.example.com/healthz` returns 200 with a
  `strict-transport-security` header. `/docs` returns 404.
- `curl -I https://ai-hub.example.com/chats/1` returns 200 with
  `strict-transport-security` and `content-security-policy` headers.
- In the browser, sign in, then reload the page: you stay signed in, which
  means the refresh cookie reaches the API. Send a message and upload an
  avatar. The DevTools console shows no Content-Security-Policy reports.
- After you request a sign-in code from your laptop,
  `docker compose exec redis redis-cli --scan --pattern 'ratelimit:global:ip:*'`
  shows your public IP. If it shows `172.30.0.x` instead, everyone shares one
  rate-limit bucket.
- From your laptop, `nc -zv <ip> 5432`, `6379` and `8000` time out or are
  refused, and `ssh root@<ip>` is rejected.

## Roll back

Re-run the deploy job of the previous release: Actions → Release → the run for
the old tag → re-run `deploy`.

If a migration was added since that release, the job fails at the migrate
step, because the old image doesn't know the newer revision. Nothing on the
server changes. Roll back by hand instead, skipping migrations:

```bash
cd /opt/ai-hub
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=v1.0.0/' .env
docker compose pull app scheduler frontend
docker compose up -d --wait
```

## Operate

Run these in `/opt/ai-hub`:

| Task | Command |
|---|---|
| Status | `docker compose ps` |
| Logs | `docker compose logs -f app` |
| Run a job by hand | `docker compose exec scheduler python -m src.chat.schedule` |
| Database shell | `docker compose exec postgres psql -U <POSTGRES_USER> <POSTGRES_DB>` |
| Resume a deploy, e.g. after the job lost its connection | `bash incoming/deploy.sh <tag>` |

Every image, action and Python package is pinned to an exact version, so
nothing changes on the server between releases. Dependabot
([`.github/dependabot.yml`](../.github/dependabot.yml)) opens weekly pull
requests to bump them; merge one once CI passes, and the next release ships it.

Dependabot never proposes a new Postgres major version, because moving to one
needs a dump and restore, not just a tag change.

### Change the Caddy or collector config

Edit [`deploy/Caddyfile`](../deploy/Caddyfile) or
[`deploy/otel-collector.yaml`](../deploy/otel-collector.yaml) and release. The
deploy reloads Caddy gracefully, without dropping connections, and restarts the
collector. On every pull request, CI validates the collector config and serves
requests through Caddy.

The frontend's security headers live there too. Its Content-Security-Policy
only lets the page load images from the R2 hosts (`S3_PUBLIC_BASE_URL` and
`S3_ENDPOINT_URL`), so a markdown image in an LLM reply can't send chat
content to another host. If the frontend starts loading from a new host, add
it there. The policy ships as `Content-Security-Policy-Report-Only`: once a
release shows no reports in the browser console, rename the header to
`Content-Security-Policy` to enforce it.

Running the prod compose file on your laptop needs `-p <other-name>`: it is
named `ai-hub`, like the dev stack, and would otherwise act on the dev
containers, network and volumes.

## Known gaps

- **No backups.** Postgres lives on the server's disk, so losing the disk loses
  every user and chat. R2 files aren't backed up either. Add backups before
  real users arrive.
- **One server.** If it's down, the API and the frontend are down.
- **Short pause on deploy.** Requests pause for a few seconds while the app
  restarts. Caddy holds them for up to 30 seconds instead of failing them, and
  running SSE streams get 30 seconds to finish.
