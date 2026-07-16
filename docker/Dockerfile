# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=26.2.0

FROM node:${NODE_VERSION}-bookworm AS crew-builder

COPY --from=rust:1.96-bookworm /usr/local/cargo /usr/local/cargo
COPY --from=rust:1.96-bookworm /usr/local/rustup /usr/local/rustup
ENV PATH="/usr/local/cargo/bin:${PATH}"

WORKDIR /opt/rusty-crew
COPY --from=rusty_crew . .
RUN npm ci \
    && npm run build:native \
    && rm -rf target \
    && npm prune --omit=dev

FROM node:${NODE_VERSION}-bookworm AS roleplay-builder

RUN npm install --global pnpm@11.0.0
WORKDIR /opt/rusty-roleplay
COPY roleplay-frontend/package.json \
     roleplay-frontend/pnpm-lock.yaml \
     roleplay-frontend/pnpm-workspace.yaml \
     roleplay-frontend/.npmrc \
     ./
RUN pnpm install --frozen-lockfile
COPY roleplay-frontend/ .
RUN pnpm exec nx build roleplay-web --configuration production

FROM node:${NODE_VERSION}-bookworm-slim AS runtime

RUN npm install --global tsx@4.22.4

ARG CREW_REVISION=unknown
ARG ROLEPLAY_REVISION=unknown
LABEL org.opencontainers.image.title="Rusty Roleplay" \
      org.opencontainers.image.description="Rusty Crew with the Rusty Roleplay frontend" \
      org.opencontainers.image.revision="${ROLEPLAY_REVISION}" \
      io.rusty-roleplay.crew-revision="${CREW_REVISION}"

ENV NODE_ENV=production \
    RUSTY_CREW_STATIC_DIR=/opt/rusty-roleplay/site

WORKDIR /opt/rusty-crew
COPY --from=crew-builder /opt/rusty-crew/ /opt/rusty-crew/
COPY --from=roleplay-builder /opt/rusty-roleplay/dist/apps/roleplay-web/browser/ /opt/rusty-roleplay/site/

EXPOSE 9347
CMD ["sh", "-c", "npm run service:preflight && exec npm run service:start"]
