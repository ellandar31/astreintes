# Construction
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci --ignore-scripts

COPY . .

RUN npm run build

# Serveur Web
FROM nginxinc/nginx-unprivileged:stable-alpine

COPY --from=build /app/dist/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.d/99-astreintes-runtime-config.sh

USER root
# Normalize Windows checkouts before executing the script in Alpine.
# Static application assets remain root-owned; only runtime configuration is writable.
RUN sed -i 's/\r$//' /docker-entrypoint.d/99-astreintes-runtime-config.sh \
    && chmod +x /docker-entrypoint.d/99-astreintes-runtime-config.sh \
    && touch /tmp/astreintes-app-config.js \
    && chown nginx:nginx /tmp/astreintes-app-config.js /etc/nginx/conf.d
USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
