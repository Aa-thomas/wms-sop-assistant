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

module.exports = app;
