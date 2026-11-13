FROM node:22.12.0-bookworm-slim

# Install system dependencies (Python for stream resolver & build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install the resolver during the image build, not at bot startup.
RUN python3 -m pip install --no-cache-dir --break-system-packages yt-dlp

WORKDIR /app

# Copy package specifications
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev --legacy-peer-deps

# Copy entire application codebase
COPY . .

# Give the unprivileged Node.js user ownership of the application directory.
RUN chown -R node:node /app

# Expose Web Dashboard port
EXPOSE 10000

ENV NODE_ENV=production
ENV PORT=10000

# Run the bot without root privileges. npm start still executes prestart.
USER node

# Use npm start so the prestart lifecycle deploys the current Discord
# application-command payload before the bot connects to the gateway.
CMD ["npm", "start"]
