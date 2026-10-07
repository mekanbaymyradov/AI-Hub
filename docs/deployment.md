# Deployment guide

Production runs on one Hetzner server (Ubuntu LTS, x86) with Docker Compose.
Caddy serves HTTPS in front of the API. The scheduler, Postgres and Redis run
next to it, reachable only inside Docker's network. Replace `example.com` with
your domain throughout.

## How a release works

Pushing a `vX.Y.Z` tag runs [`release.yml`](../.github/workflows/release.yml):

1. **ci**: lint and tests from [`ci.yml`](../.github/workflows/ci.yml), for the tagged commit.
2. **publish**: checks that the tag is `vX.Y.Z` on a commit in `main`, then
   pushes `ghcr.io/mekanbaymyradov/ai-hub:<tag>`.
3. **deploy**: copies [`docker-compose.prod.yaml`](../docker-compose.prod.yaml)
   to the server, runs migrations with the new image, then restarts the app
   and scheduler on it.

The server holds only `/opt/ai-hub/docker-compose.yaml` and `/opt/ai-hub/.env`.

## Before you start

| Service | Set up |
|---|---|
| Cloudflare DNS | An **A** record `api` → the server's IPv4, DNS only (grey cloud). No AAAA record: IPv6 clients would reach the app from Docker's gateway address and share one rate-limit bucket. |
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
   | `CORS_ORIGINS` | `["https://ai-hub.example.com"]` |
   | `API_DOMAIN` | `api.example.com` |
   | `IMAGE_TAG` | Leave empty. The release workflow sets it. |
   | `LOGFIRE_TOKEN`, `LOGFIRE_ENVIRONMENT` | Your write token, `production` |
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
image, because new GHCR packages start private. Make the package public (the
repo already is) under its Package settings → Change visibility, then re-run
the deploy job.

**Migrations** must keep the previous release working. They run while the old
app is still serving, and a rollback doesn't undo them. To rename a column, for
example, add the new one in one release and drop the old one in a later one.

## Check a fresh server

After the first deploy:

- `docker compose ps` in `/opt/ai-hub` shows every service up, with the app
  `healthy`.
- `curl -I https://api.example.com/healthz` returns 200 with a
  `strict-transport-security` header. `/docs` returns 404.
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
docker compose pull app scheduler
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
| Update Caddy, Postgres and Redis | `docker compose pull caddy postgres redis && docker compose up -d` |

The Postgres image is pinned to major version 18. Moving to a new major
version needs a dump and restore, not just a tag change.

### Change the Caddy config

The Caddy config lives inside `docker-compose.prod.yaml`. Compose doesn't
recreate Caddy when only that config changes, so after the release that
changes it, run:

```bash
docker compose up -d --force-recreate caddy
```

This drops open connections for a moment, which is why deploys don't do it
every time.

## Known gaps

- **No backups.** Postgres lives on the server's disk, so losing the disk loses
  every user and chat. R2 files aren't backed up either. Add backups before
  real users arrive.
- **One server.** If it's down, the API is down.
- **Short pause on deploy.** Requests pause for a few seconds while the app
  restarts. Caddy holds them for up to 30 seconds instead of failing them, and
  running SSE streams get 30 seconds to finish.
