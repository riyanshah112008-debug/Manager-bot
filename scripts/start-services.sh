#!/bin/sh
set -eu

APP_DIR="/app"
LAVALINK_DIR="/opt/lavalink"
LAVALINK_JAR="$LAVALINK_DIR/Lavalink.jar"
LAVALINK_CONFIG="$LAVALINK_DIR/application.yml"

cd "$APP_DIR"

# This password is shared only by the two local processes in this container.
# Render can provide a stable LAVALINK_AUTH secret; local Docker gets an ephemeral one.
if [ -z "${LAVALINK_AUTH:-}" ]; then
    LAVALINK_AUTH="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
    export LAVALINK_AUTH
fi

export LAVALINK_URL="${LAVALINK_URL:-127.0.0.1:2333}"
export LAVALINK_NODE_NAME="${LAVALINK_NODE_NAME:-Render-Local-Lavalink}"
export LAVALINK_SECURE="${LAVALINK_SECURE:-false}"
export STARRY_REQUIRE_LAVALINK="${STARRY_REQUIRE_LAVALINK:-true}"
export STARRY_ENABLE_PUBLIC_LAVALINK_NODES="false"
export STARRY_DISABLE_STREAM_RESOLVER="1"

if [ ! -s "$LAVALINK_JAR" ] || [ ! -r "$LAVALINK_CONFIG" ]; then
    echo "[Startup] Lavalink binary or configuration is missing." >&2
    exit 1
fi

LAVALINK_PID=""
BOT_PID=""

stop_services() {
    [ -z "$BOT_PID" ] || kill -TERM "$BOT_PID" 2>/dev/null || true
    [ -z "$LAVALINK_PID" ] || kill -TERM "$LAVALINK_PID" 2>/dev/null || true
    [ -z "$BOT_PID" ] || wait "$BOT_PID" 2>/dev/null || true
    [ -z "$LAVALINK_PID" ] || wait "$LAVALINK_PID" 2>/dev/null || true
}
trap stop_services INT TERM EXIT

(
    cd "$LAVALINK_DIR"
    exec java \
        -Xms128m \
        -Xmx768m \
        -XX:+UseG1GC \
        -XX:MaxGCPauseMillis=150 \
        -jar "$LAVALINK_JAR"
) &
LAVALINK_PID=$!

# Wait for the local REST endpoint before starting the bot. This avoids a
# startup race where users can issue music commands while the audio node is cold.
attempt=0
while [ "$attempt" -lt 180 ]; do
    if ! kill -0 "$LAVALINK_PID" 2>/dev/null; then
        echo "[Startup] Lavalink exited before becoming ready." >&2
        wait "$LAVALINK_PID" || true
        exit 1
    fi
    if curl --fail --silent --max-time 2 \
        -H "Authorization: $LAVALINK_AUTH" \
        "http://127.0.0.1:2333/version" >/dev/null 2>&1; then
        echo "[Startup] Lavalink is ready on 127.0.0.1:2333."
        break
    fi
    attempt=$((attempt + 1))
    sleep 1
done

if [ "$attempt" -ge 180 ]; then
    echo "[Startup] Lavalink did not become ready within 180 seconds." >&2
    exit 1
fi

npm start &
BOT_PID=$!

# If either critical process exits, stop the other one and let Render restart
# the complete service. Never silently run the bot without its required audio node.
while kill -0 "$LAVALINK_PID" 2>/dev/null && kill -0 "$BOT_PID" 2>/dev/null; do
    sleep 2
done

if ! kill -0 "$LAVALINK_PID" 2>/dev/null; then
    echo "[Supervisor] Lavalink exited; stopping Starry." >&2
    wait "$LAVALINK_PID" || STATUS=$?
    exit "${STATUS:-1}"
fi

if ! kill -0 "$BOT_PID" 2>/dev/null; then
    echo "[Supervisor] Starry exited; stopping Lavalink." >&2
    wait "$BOT_PID" || STATUS=$?
    exit "${STATUS:-1}"
fi
