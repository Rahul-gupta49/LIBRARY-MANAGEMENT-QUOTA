const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const { doubleCsrf } = require('csrf-csrf');
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
  const isProduction = process.env.NODE_ENV === 'production';
  app.use(session({
    secret: process.env.SESSION_SECRET || 'library-management-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: isProduction,
      httpOnly: true,
      sameSite: 'lax'
    }
  }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use(limiter);

  // Stricter rate limit for auth routes
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/login', authLimiter);
  app.use('/register', authLimiter);

  // CSRF protection
  const csrfSecret = process.env.CSRF_SECRET || 'library-csrf-secret-key';
  const { generateToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => csrfSecret,
    cookieName: '_csrf',
    cookieOptions: {
      secure: isProduction,
      sameSite: 'lax'
    },
    getTokenFromRequest: (req) => req.body._csrf
  });

  app.use(doubleCsrfProtection);

  // Make CSRF token available to all views
  app.use((req, res, next) => {
    res.locals.csrfToken = generateToken(req, res);
    next();
  });

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
