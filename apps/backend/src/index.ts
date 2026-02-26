import express, { Application } from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { rateLimiter } from './middleware/rateLimiter';

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import studentRoutes from './routes/student.routes';
import teacherRoutes from './routes/teacher.routes';
import courseRoutes from './routes/course.routes';
import lessonRoutes from './routes/lesson.routes';
import paymentRoutes from './routes/payment.routes';
import organizationRoutes from './routes/organization.routes';
import notificationRoutes from './routes/notification.routes';
import dashboardRoutes from './routes/dashboard.routes';
import alertRoutes from './routes/alert.routes';
import materialRoutes from './routes/material.routes';
import fileRoutes from './routes/file.routes';
import attendanceRoutes from './routes/attendance.routes';
import userProfileRoutes from './routes/userProfile.routes';
import mailingRoutes from './routes/mailing.routes';
import googleCalendarRoutes from './routes/google-calendar.routes';
import reportRoutes from './routes/report.routes';
import substitutionRoutes from './routes/substitution.routes';
import settlementRoutes from './routes/settlement.routes';
import payoutRoutes from './routes/payout.routes';
import balanceRoutes from './routes/balance.routes';
import courseApplicationRoutes from './routes/courseApplication.routes';

// Import scheduler and jobs
import scheduler from './utils/scheduler';
import { initializeStorage } from './utils/supabase';
import { startExchangeRateJob } from './jobs/exchange-rate.job';
import { startPurgeArchivedStudentsJob } from './jobs/purge-archived-students.job';

// Load environment variables
dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================

// Security
app.use(helmet());

// Compression - reduces response size by 60-80%
app.use(compression({
  level: 6, // Balance between compression ratio and CPU usage
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress if client doesn't accept it
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// CORS
app.use((req, res, next) => {
  const origin = process.env.FRONTEND_URL;
  
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  return next();
});

// Rate limiting
app.use('/api/', rateLimiter);

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/materials', materialRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/profile', userProfileRoutes);
app.use('/api/mailings', mailingRoutes);
app.use('/api/google-calendar', googleCalendarRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/substitutions', substitutionRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/balance', balanceRoutes);
app.use('/api/applications', courseApplicationRoutes);

// ============================================
// ERROR HANDLING
// ============================================

app.use(notFoundHandler);
app.use(errorHandler as any);

// ============================================
// START SERVER
// ============================================

app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API: http://localhost:${PORT}`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);

  // Initialize Supabase Storage
  await initializeStorage();

  // Start scheduled tasks
  if (process.env.NODE_ENV !== 'test') {
    scheduler.start();
    // Start exchange rate updates
    startExchangeRateJob();
    startPurgeArchivedStudentsJob();
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  scheduler.stop();
  process.exit(0);
});

export default app;
