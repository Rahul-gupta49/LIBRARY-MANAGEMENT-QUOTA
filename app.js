const express = require('express');
const session = require('express-session');
const path = require('path');
const { initializeDb } = require('./models/database');

function createApp() {
  const app = express();

  // View engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Static files
  app.use(express.static(path.join(__dirname, 'public')));

  // Body parsing
  app.use(express.urlencoded({ extended: false }));

  // Session
  app.use(session({
    secret: process.env.SESSION_SECRET || 'library-management-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
  }));

  // Initialize database
  initializeDb();

  // Routes
  app.use('/', require('./routes/auth'));
  app.use('/teacher', require('./routes/teacher'));
  app.use('/student', require('./routes/student'));

  // 404 handler
  app.use((req, res) => {
    res.status(404).render('error', {
      message: 'Page not found',
      user: req.session ? req.session.user : null
    });
  });

  return app;
}

module.exports = createApp;
