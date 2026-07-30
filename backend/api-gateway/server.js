import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.PORT || 5000;

// Service URL configurations (can be overridden via env vars in Docker Compose)
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:5001';
const TICKET_SERVICE_URL = process.env.TICKET_SERVICE_URL || 'http://localhost:5002';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(morgan('dev'));

// Routing configuration — rewrite /api/<service> so backends receive their native routes
app.use('/api/users', createProxyMiddleware({
  target: USER_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/users': '' },
  logger: console
}));

app.use('/api/tickets', createProxyMiddleware({
  target: TICKET_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/tickets': '' },
  logger: console
}));

app.use('/api/ai', createProxyMiddleware({
  target: AI_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/ai': '' },
  // Gemini peut prendre plusieurs secondes
  proxyTimeout: 90000,
  timeout: 90000,
  logger: console
}));

// Notifications are handled by the ticket-service (CDC 7.8)
// Mount strips /api/notifications → rewrite back to /notifications/*
app.use('/api/notifications', createProxyMiddleware({
  target: TICKET_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: (path) => '/notifications' + (path === '/' ? '' : path),
  logger: console
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'UP',
    gateway: true,
    services: {
      userService: USER_SERVICE_URL,
      ticketService: TICKET_SERVICE_URL,
      aiService: AI_SERVICE_URL
    }
  });
});

app.listen(PORT, () => {
  console.log(`[API Gateway] running on port ${PORT}`);
});
