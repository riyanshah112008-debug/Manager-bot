FROM node:22.12.0-bookworm-slim

# Keep the Discord bot and the audio engine in one paid Render service.
# Lavalink handles source decoding and Opus output separately from the Node event loop.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    ca-certificates \
    curl \
    openjdk-17-jre-headless \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp at build time for local-development fallback tooling.
RUN python3 -m pip install --no-cache-dir --break-system-packages yt-dlp

# Pin the audio engine release; do not download or update it during service startup.
ARG LAVALINK_VERSION=4.2.2
RUN mkdir -p /opt/lavalink/plugins \
    && curl --fail --location --silent --show-error --retry 4 --retry-delay 2 \
       "https://github.com/lavalink-devs/Lavalink/releases/download/${LAVALINK_VERSION}/Lavalink.jar" \
       --output /opt/lavalink/Lavalink.jar \
    && test -s /opt/lavalink/Lavalink.jar

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY . .
COPY infra/lavalink/application.yml /opt/lavalink/application.yml

RUN chown -R node:node /app /opt/lavalink \
    && chmod 755 /app/scripts/start-services.sh \
    && chmod 755 /opt/lavalink

EXPOSE 10000

ENV NODE_ENV=production
ENV PORT=10000
ENV JAVA_TOOL_OPTIONS="-XX:+UseG1GC -XX:MaxGCPauseMillis=150"

USER node

# Start the local Lavalink process first, wait for its health endpoint, then
# start the Discord bot. Either process exiting causes the service to restart.
CMD ["/app/scripts/start-services.sh"]
