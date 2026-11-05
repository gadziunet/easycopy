# EasyCopy – one image: panel (8080), archive server (8081), worker and the "easycopy" command.
FROM node:22-alpine

LABEL org.opencontainers.image.title="EasyCopy" \
      org.opencontainers.image.description="Prosty archiwizator stron WWW do homelabu" \
      org.opencontainers.image.licenses="AGPL-3.0-only"

ENV NODE_ENV=production \
    DATA_DIR=/data \
    ARCHIVE_DIR=/data/archiwa \
    PANEL_PORT=8080 \
    ARCHIVE_PORT=8081 \
    HOST=0.0.0.0 \
    ARCHIVE_HOST=0.0.0.0 \
    PUID=1000 \
    PGID=1000

WORKDIR /app

# EasyCopy has no npm dependencies – copying the code is enough
# (LICENS[E] – copies LICENSE if it exists)
COPY package.json README.md LICENS[E] ./
COPY src ./src

RUN chmod +x src/cli.js \
 && ln -s /app/src/cli.js /usr/local/bin/easycopy \
 && mkdir -p /data/archiwa

VOLUME ["/data"]
EXPOSE 8080 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "Promise.all([process.env.PANEL_PORT, process.env.ARCHIVE_PORT].filter((p) => Number(p) > 0).map((p) => fetch('http://127.0.0.1:' + p + '/healthz'))).then((rs) => rs.every((r) => r.ok)).then((ok) => process.exit(ok ? 0 : 1), () => process.exit(1))"]

# The process starts as root only to prepare /data and switch to PUID/PGID
ENTRYPOINT ["node", "/app/src/cli.js"]
CMD ["start"]
