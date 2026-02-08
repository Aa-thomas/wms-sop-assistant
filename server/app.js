require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const routes = require('./routes/ask');
const onboardingRouter = require('./routes/onboarding');

const app = express();

app.use(cors());
app.use(express.json());

// Serve slide images as static files
app.use('/images', express.static(path.join(__dirname, '..', 'data', 'images')));

// Routes
app.use('/', routes);
app.use('/onboarding', onboardingRouter);

// In production, serve the React build and handle client-side routing
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'client', 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
  });
}

module.exports = app;
