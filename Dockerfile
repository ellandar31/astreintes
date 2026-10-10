# Construction
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci --ignore-scripts

COPY . .

RUN npm run build

# Serveur Web
FROM nginxinc/nginx-unprivileged:stable-alpine

COPY --from=build --chown=nginx:nginx /app/dist/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.d/99-astreintes-runtime-config.sh

USER root
# Normalize Windows checkouts before executing the script in Alpine.
# Runtime config and Nginx templates must remain writable without root privileges.
RUN sed -i 's/\r$//' /docker-entrypoint.d/99-astreintes-runtime-config.sh \
    && chmod +x /docker-entrypoint.d/99-astreintes-runtime-config.sh \
    && chown nginx:nginx /usr/share/nginx/html /etc/nginx/conf.d
USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
