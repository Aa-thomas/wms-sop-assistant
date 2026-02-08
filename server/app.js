const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const routes = require('./routes/ask');
const authRouter = require('./routes/auth');
const onboardingRouter = require('./routes/onboarding');
const gapsRouter = require('./routes/gaps');
const pickErrorsRouter = require('./routes/pick-errors');
const usersRouter = require('./routes/users');
const modulesRouter = require('./routes/modules');
const anonymousFeedbackRouter = require('./routes/feedback');
const briefingRouter = require('./routes/briefing');
const { authMiddleware, supervisorMiddleware } = require('./lib/auth');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration - restrict origins in production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : false)
    : true,
  credentials: true
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '1mb' })); // Limit payload size

// Rate limiting for login (prevent brute force)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: { error: 'Too many login attempts. Try again in 1 minute.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting for LLM calls (prevent abuse)
const askLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 20,
  message: { error: 'Rate limit exceeded. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Serve slide images as static files
app.use('/images', express.static(path.join(__dirname, '..', 'data', 'images')));

// Public routes
app.use('/auth/login', loginLimiter);
app.use('/auth', authRouter);

// Apply auth and rate limiting to /ask
app.use('/ask', askLimiter, authMiddleware);
app.use('/', routes);

// Protected routes
app.use('/onboarding', authMiddleware, onboardingRouter);

// Supervisor-only routes
app.use('/gaps', supervisorMiddleware, gapsRouter);
app.use('/pick-errors', supervisorMiddleware, pickErrorsRouter);
app.use('/users', supervisorMiddleware, usersRouter);
app.use('/modules', modulesRouter);

// Anonymous feedback (submit requires auth, manage requires supervisor)
app.use('/feedback', authMiddleware, anonymousFeedbackRouter);

// Daily briefing (supervisor only)
app.use('/briefing', supervisorMiddleware, briefingRouter);

// In production, serve the React build and handle client-side routing
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

module.exports = app;
