require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const compression = require('compression');
const passport = require('./config/passport');

// Connect to database
require('./config/database');

// Initialize Cron Jobs
const { initCronJobs } = require('./services/cron.service');
initCronJobs();

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middlewares
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://*"],
        mediaSrc: ["'self'", "blob:", "https://*"],
        connectSrc: ["'self'", "https://*"],
      },
    }
  })
);

// Rate Limiting (Prevent Brute Force / DDoS)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all /api/ routes
app.use('/api/', apiLimiter);

// Prevent HTTP Parameter Pollution
app.use(hpp());

// Compress all responses for performance
app.use(compression());

app.use(cors({ origin: true, credentials: true }));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Initialize Passport
app.use(passport.initialize());

// Logger
app.use(morgan('dev'));

// Static assets with Caching (1 day for general static assets)
app.use(express.static('src/public', { maxAge: '1d' }));
app.use(express.static('src/views'));

const expressLayouts = require('express-ejs-layouts');

// View engine
app.set('view engine', 'ejs');
app.set('views', './src/views');
app.use(expressLayouts);
app.set('layout', 'layouts/main'); // default layout

// Apply optional auth globally for view templates
const { optionalAuth } = require('./middleware/auth.middleware');
app.use(optionalAuth);

// Healthcheck route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Temporary Env Test Route
app.get('/test-env', (req, res) => {
  const dbUrl = process.env.DATABASE_URL || 'NOT_SET';
  res.status(200).json({ 
    dbUrl: dbUrl.substring(0, 50) + '...',
    isDotenvLoaded: !!process.env.PORT
  });
});

// API Routes
const authRoutes = require('./modules/auth/auth.routes');
const publicRoutes = require('./routes/public.routes');
const coursesRoutes = require('./modules/courses/courses.routes');
const instructorRoutes = require('./routes/instructor.routes');
const studentRoutes = require('./routes/student.routes');
const adminRoutes = require('./routes/admin.routes');
const paymentsRoutes = require('./modules/payments/payments.routes');
const quizzesRoutes = require('./modules/quizzes/quizzes.routes');
const gamificationRoutes = require('./modules/gamification/gamification.routes');
const analyticsRoutes = require('./modules/analytics/analytics.routes');
const complianceRoutes = require('./modules/compliance/compliance.routes');
const supportRoutes = require('./modules/support/support.routes');
const notificationsRoutes = require('./modules/notifications/notifications.routes');
const cmsRoutes = require('./modules/cms/cms.routes');
const aiRoutes = require('./modules/ai/ai.routes');

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/courses', coursesRoutes);
app.use('/api/v1/payments', paymentsRoutes);
app.use('/api/v1/quizzes', quizzesRoutes);
app.use('/api/v1/gamification', gamificationRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/compliance', complianceRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/cms', cmsRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/instructor', instructorRoutes);
app.use('/student', studentRoutes);
app.use('/wp-admin', adminRoutes);
app.use('/', publicRoutes);

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;
