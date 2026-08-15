FROM node:20-alpine
WORKDIR /app
COPY ticket-service/package*.json ./
RUN npm install --omit=dev
COPY ticket-service/ ./
COPY shared /shared
EXPOSE 5002
CMD ["node", "server.js"]
