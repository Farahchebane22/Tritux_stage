FROM node:20-alpine
WORKDIR /app
COPY report-service/package*.json ./
RUN npm install --omit=dev
COPY report-service/server.js ./
COPY shared /shared
EXPOSE 5004
CMD ["node", "server.js"]
