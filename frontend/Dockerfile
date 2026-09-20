FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
# Runs at every container start and writes /config.js from environment variables.
COPY docker/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-runtime-config.sh && chmod +x /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
