# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:22-slim

# Install Python + pip
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies (production only)
COPY package*.json ./
RUN npm ci --omit=dev

# Install Python dependencies
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Copy built frontend and server files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY server.ts generatePdf.ts types.ts ./
COPY fill_a1_pdf.py ./

# Port exposed (Northflank injects PORT env var)
EXPOSE 3000

ENV NODE_ENV=production

CMD ["npm", "run", "start"]
