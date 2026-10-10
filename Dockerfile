# Construction
FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Serveur Web
FROM nginx:alpine

COPY --from=build /app/dist/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.d/99-astreintes-runtime-config.sh

RUN chmod +x /docker-entrypoint.d/99-astreintes-runtime-config.sh

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
