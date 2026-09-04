# Build stage
FROM node:24-alpine AS build-stage
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_URL=http://localhost:5000/api
ARG VITE_KEYCLOAK_ENABLED=false
ARG VITE_KEYCLOAK_URL=http://localhost:8081
ARG VITE_KEYCLOAK_REALM=tritux-helpdesk
ARG VITE_KEYCLOAK_CLIENT_ID=tritux-frontend
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_KEYCLOAK_ENABLED=$VITE_KEYCLOAK_ENABLED
ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID
RUN npm run build

# Production stage
FROM nginx:stable-alpine AS production-stage
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY 40-env-config.sh /docker-entrypoint.d/40-env-config.sh
RUN chmod +x /docker-entrypoint.d/40-env-config.sh
COPY --from=build-stage /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
