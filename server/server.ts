import 'dotenv/config';
import express, { Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { initDB, run, query } from './db.js';
import { validateEmailConfig } from './services/emailService.js';
import authRouter from './routes/auth.js';
import transactionRouter from './routes/transactions.js';
import savingsRouter from './routes/savings.js';
import budgetRouter from './routes/budgets.js';
import reportsRouter from './routes/reports.js';
import adminRouter from './routes/admin.js';
import assetsRouter from './routes/assets.js';
import debtsRouter from './routes/debts.js';
import { authMiddleware, AuthenticatedRequest } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://lh3.googleusercontent.com"]
    }
  }
}));

const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? (allowedOrigin.includes(',') ? allowedOrigin.split(',') : allowedOrigin) 
    : true,
  credentials: true
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' })); // Support base64 image note attachments
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Rate Limiter to prevent brute-force attacks and abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // limit each IP to 300 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', apiLimiter);

// Auth Route definitions
app.use('/api/auth', authRouter);
app.use('/api/transactions', transactionRouter);
app.use('/api/savings', savingsRouter);
app.use('/api/budgets', budgetRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/debts', debtsRouter);

// Dedicated Notifications Endpoints
app.get('/api/notifications', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const items = await query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [userId]);
    res.json({ notifications: items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/notifications/:id/read', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const notifId = req.params.id;
    await run('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [notifId, userId]);
    res.json({ message: 'Notification marked as read' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/notifications/read-all', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await run('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    res.json({ message: 'All notifications marked as read' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend assets in production build mode
const distPath = join(__dirname, '../dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

// Boot the database and start server listening
async function startServer() {
  validateEmailConfig();
  try {
    await initDB();
    console.log('Normalized database initialized successfully.');
    
    // Background interval to clean up expired reset codes hourly
    setInterval(async () => {
      try {
        const deleted = await run('DELETE FROM password_resets WHERE expires_at < ?', [new Date().toISOString()]);
        if (deleted.changes > 0) {
          console.log(`[CLEANUP] Automatically pruned ${deleted.changes} expired password reset records.`);
        }
      } catch (err) {
        console.error('[CLEANUP ERROR] Failed to prune expired password resets:', err);
      }
    }, 60 * 60 * 1000); // 1 hour

    app.listen(PORT, () => {
      console.log(`==========================================================`);
      console.log(`  ELRAWDA Wealth Management Backend Server Active`);
      console.log(`  Listening on port: ${PORT} (API Proxy Target)`);
      console.log(`==========================================================`);
    });
  } catch (err) {
    console.error('Error starting server database layer:', err);
    process.exit(1);
  }
}

startServer();
