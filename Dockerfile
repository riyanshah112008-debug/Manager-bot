FROM node:20-bullseye-slim

# Install system dependencies (Python for stream resolver & build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    ca-certificates \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package specifications
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev --legacy-peer-deps

# Copy entire application codebase
COPY . .

# Expose Web Dashboard port
EXPOSE 10000

ENV NODE_ENV=production
ENV PORT=10000

# Start Starry Bot
CMD ["node", "src/index.js"]
