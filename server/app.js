require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const routes = require('./routes/ask');
const authRouter = require('./routes/auth');
const onboardingRouter = require('./routes/onboarding');
const gapsRouter = require('./routes/gaps');
const pickErrorsRouter = require('./routes/pick-errors');
const { authMiddleware, supervisorMiddleware } = require('./lib/auth');

const app = express();

app.use(cors());
app.use(express.json());

// Serve slide images as static files
app.use('/images', express.static(path.join(__dirname, '..', 'data', 'images')));

// Public routes
app.use('/auth', authRouter);

// Apply auth to /ask and /feedback before mounting the routes router
app.use('/ask', authMiddleware);
app.use('/feedback', authMiddleware);
app.use('/', routes);

// Protected routes
app.use('/onboarding', authMiddleware, onboardingRouter);

// Supervisor-only routes
app.use('/gaps', supervisorMiddleware, gapsRouter);
app.use('/pick-errors', supervisorMiddleware, pickErrorsRouter);

// In production, serve the React build and handle client-side routing
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

module.exports = app;
