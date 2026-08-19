# Enterprise Multi-Stage Docker Build for ApexQueue Platform
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root and workspace package files
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install all dependencies including devDependencies
RUN npm install
RUN npm --prefix backend install --include=dev
RUN npm --prefix frontend install --include=dev

# Copy source code
COPY . .

# Build backend TypeScript and frontend Vite React bundle
RUN npm run build

# Production Stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy root and workspace configuration
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install production dependencies only
RUN npm install --only=production
RUN npm --prefix backend install --only=production
RUN npm --prefix frontend install --only=production

# Copy compiled build artifacts and static assets
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# Expose HTTP REST API and WebSocket ports
EXPOSE 4000

# Set environment
ENV NODE_ENV=production
ENV PORT=4000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Start enterprise single-service engine
CMD ["npm", "start"]
