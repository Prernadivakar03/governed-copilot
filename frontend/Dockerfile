# Multi-stage Dockerfile for React+Vite Frontend
# Stage 1: Build static assets
FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
ARG VITE_API_URL="http://localhost:8000"
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Stage 2: Serve with non-root unprivileged Nginx
FROM nginxinc/nginx-unprivileged:1.27-alpine-slim AS final

COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html
COPY --chown=nginx:nginx frontend/nginx.conf /etc/nginx/conf.d/default.conf

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=5s --timeout=3s --retries=3 \
    CMD wget -qO- http://localhost:8080/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
