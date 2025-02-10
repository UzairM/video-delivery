# Build stage
FROM node:18-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Production stage
FROM node:18-slim

# Install latest FFmpeg
RUN apt-get update && \
    apt-get install -y wget xz-utils && \
    wget https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && \
    tar xvf ffmpeg-release-amd64-static.tar.xz && \
    mv ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ && \
    mv ffmpeg-*-amd64-static/ffprobe /usr/local/bin/ && \
    rm -rf ffmpeg-* && \
    apt-get remove -y wget xz-utils && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

# Environment
ENV NODE_ENV=production
ENV PORT=3000
ENV API_DOMAIN=http://vp.bydallas:3000

EXPOSE 3001

# Print environment variables for debugging
CMD ["sh", "-c", "env && node dist/index.js"] 