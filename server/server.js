import 'dotenv/config'; // ✅ replaces dotenv.config() — loads instantly at import time

import express from 'express';
import cors from 'cors';
import { clerkMiddleware } from '@clerk/express';
import aiRouter from './routes/aiRoutes.js';
import userRouter from './routes/userRoutes.js';

console.log("CLIPDROP =", process.env.CLIPDROP_API_KEY);

const app = express();

app.use(cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(clerkMiddleware());

app.get('/', (req, res) => {
  res.send('Server is Live!');
});

app.use('/api/ai', aiRouter);
app.use('/api/user', userRouter);

// 404 Route
app.use((req, res) => {
  console.log('[404]', req.method, req.originalUrl);
  res.status(404).json({ success: false, message: 'Route Not Found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.log("SERVER ERROR:", err);
  const status = err?.status || err?.statusCode || err?.response?.status || 500;
  res.status(status).json({
    success: false,
    message: err?.response?.data?.message || err?.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));