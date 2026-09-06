FROM node:20-alpine
WORKDIR /app
COPY ticket-service/package*.json ./
RUN npm install --omit=dev && ln -s /app/node_modules /node_modules
COPY ticket-service/ ./
COPY shared /shared
RUN rm -rf /shared/node_modules && ln -s /app/node_modules /shared/node_modules
EXPOSE 5002
CMD ["node", "server.js"]

