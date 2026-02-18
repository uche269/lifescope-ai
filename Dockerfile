# Stage 1: Build Frontend
FROM node:20-alpine as frontend-build
WORKDIR /app/frontend
COPY package*.json ./
RUN npm ci
COPY . .
# Pass env vars as build args so Vite bakes them into the bundle
ARG VITE_GEMINI_API_KEY
ARG VITE_API_URL
ENV VITE_GEMINI_API_KEY=$VITE_GEMINI_API_KEY
ENV VITE_API_URL=$VITE_API_URL
# Build Vite app to /app/frontend/dist
RUN npm run build

# Stage 2: Build Backend & Serve
FROM node:20-alpine
WORKDIR /app

# Copy backend definitions
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --omit=dev

# Copy backend source code
COPY backend/ ./

# Copy built frontend assets from Stage 1
COPY --from=frontend-build /app/frontend/dist ../dist

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
