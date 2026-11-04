# EasyCopy – jeden obraz: serwer archiwów + polecenie do robienia kopii.
FROM node:22-alpine

LABEL org.opencontainers.image.title="EasyCopy" \
      org.opencontainers.image.description="Prosty archiwizator stron WWW do homelabu" \
      org.opencontainers.image.licenses="AGPL-3.0-only"

ENV NODE_ENV=production \
    ARCHIVE_DIR=/data/archiwa \
    ARCHIVE_PORT=8081 \
    ARCHIVE_HOST=0.0.0.0 \
    PUID=1000 \
    PGID=1000

WORKDIR /app

# EasyCopy nie ma zależności z npm – wystarczy skopiować kod
# (LICENS[E] – kopiuje LICENSE, jeśli istnieje)
COPY package.json README.md LICENS[E] ./
COPY src ./src

RUN chmod +x src/cli.js \
 && ln -s /app/src/cli.js /usr/local/bin/easycopy \
 && mkdir -p /data/archiwa

VOLUME ["/data"]
EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.ARCHIVE_PORT + '/healthz').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

# Proces startuje jako root tylko po to, żeby przygotować /data i przejść na PUID/PGID
ENTRYPOINT ["node", "/app/src/cli.js"]
CMD ["serve"]
