# Stage: dependencies, shared by the dev server and the production build.
FROM node:26.10.0-alpine AS deps

WORKDIR /app
# The image's own non-root user. Compose Watch syncs edits in as this user, so
# it must own /app.
RUN chown node:node /app
USER node

# Dependencies first, so editing code doesn't reinstall them.
COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
    npm ci

# Stage: the Vite dev server, for docker-compose.dev.yaml.
FROM deps AS dev
COPY --chown=node:node . .
EXPOSE 5173
# 0.0.0.0, so the published port reaches it from outside the container.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM deps AS build
COPY --chown=node:node . .
RUN npm run build

# Stage: production, the built files served by Caddy behind the edge Caddy in
# deploy/. Last, so a plain `docker build` makes it.
FROM caddy:2.11.7-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
# Caddy keeps state in /data and /config even with its admin API and HTTPS off.
RUN chown -R 10001:10001 /data /config
USER 10001:10001
EXPOSE 8080
