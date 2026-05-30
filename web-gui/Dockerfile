# syntax=docker/dockerfile:1
#
# Self-hosted web GUI for gridfinity_extended_openscad.
#
# Builds seasick/openscad-web-gui (OpenSCAD compiled to WebAssembly), patches it
# for this repo (Manifold backend + textmetrics + same-origin model loading),
# and serves it with nginx alongside the repo's self-contained `combined/` models.
#
# All rendering happens in the visitor's browser; the container only serves
# static files. Build context must be the repository root (so `combined/` is
# available) -- see web-gui/docker-compose.yml.

# ---------- Build stage ----------
FROM node:20-bookworm-slim AS build

# Pinned so the patch anchors in web-gui/patch.mjs stay valid.
ARG WEBGUI_REPO=https://github.com/seasick/openscad-web-gui.git
ARG WEBGUI_REF=759feee04f5dbf846f4608c3359d5c157256fef3
# Fallback WASM build if directory auto-discovery fails. Update if it 404s:
# https://files.openscad.org/playground/
ARG WASM_FALLBACK=OpenSCAD-2025.03.25.wasm24456-WebAssembly-web.zip

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates curl unzip \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN git clone "${WEBGUI_REPO}" . && git checkout "${WEBGUI_REF}"

# Fetch the OpenSCAD WASM "web" build. Upstream's get-openscad.sh points at a
# build that has since been rotated out, so we discover the current one (newest
# *-WebAssembly-web.zip in the playground index) and fall back to the pinned name.
RUN set -eux; \
    base="https://files.openscad.org/playground"; \
    zip="$(curl -fsSL "$base/" \
        | grep -oE 'OpenSCAD-[0-9.]+\.wasm[0-9]+-WebAssembly-web\.zip' \
        | sort -u | tail -n 1)"; \
    if [ -z "$zip" ]; then zip="${WASM_FALLBACK}"; fi; \
    echo "Using WASM build: $zip"; \
    mkdir -p src/vendor/openscad-wasm; \
    curl -fsSL "$base/$zip" -o /tmp/oscad.zip; \
    unzip -o /tmp/oscad.zip -d src/vendor/openscad-wasm; \
    rm /tmp/oscad.zip; \
    test -f src/vendor/openscad-wasm/openscad.js; \
    test -f src/vendor/openscad-wasm/openscad.wasm

# Apply gridfinity-specific patches (asserts every edit; fails build otherwise).
COPY web-gui/patch.mjs /app/patch.mjs
RUN node patch.mjs

ENV CYPRESS_INSTALL_BINARY=0
RUN npm ci --no-audit --no-fund

# Production build -> dist/. CORSPROXY unset => same-origin model fetch (patched).
ENV NODE_ENV=production
RUN node esbuild.mjs

# ---------- Runtime stage ----------
FROM nginx:alpine

# The web app.
COPY --from=build /app/dist /usr/share/nginx/html

# This repo's self-contained models (no include<> resolution needed in WASM).
COPY combined/ /usr/share/nginx/html/models/

# A simple model picker + nginx config.
COPY web-gui/gallery.html /usr/share/nginx/html/gallery.html
COPY web-gui/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
