FROM node:20-alpine
WORKDIR /app
COPY contract-service/package*.json ./
RUN npm install --omit=dev
COPY contract-service/server.js ./
COPY shared /shared
EXPOSE 5003
CMD ["node", "server.js"]
