import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.PORT || 5000;

// Service URL configurations (can be overridden via env vars in Docker Compose)
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:5001';
const TICKET_SERVICE_URL = process.env.TICKET_SERVICE_URL || 'http://localhost:5002';
const CONTRACT_SERVICE_URL = process.env.CONTRACT_SERVICE_URL || 'http://localhost:5003';
const REPORT_SERVICE_URL = process.env.REPORT_SERVICE_URL || 'http://localhost:5004';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id']
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

app.use('/api/contracts', createProxyMiddleware({
  target: CONTRACT_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/contracts': '' },
  logger: console
}));

app.use('/api/reports', createProxyMiddleware({
  target: REPORT_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/reports': '' },
  logger: console
}));

app.use('/api/ai', createProxyMiddleware({
  target: AI_SERVICE_URL,
  changeOrigin: true,
  pathRewrite: { '^/api/ai': '' },
  proxyTimeout: 90000,
  timeout: 90000,
  logger: console
}));

// Notifications are handled by the ticket-service (CDC 7.8)
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
      contractService: CONTRACT_SERVICE_URL,
      reportService: REPORT_SERVICE_URL,
      aiService: AI_SERVICE_URL
    }
  });
});

app.listen(PORT, () => {
  console.log(`[API Gateway] running on port ${PORT}`);
});
