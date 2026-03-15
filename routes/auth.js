const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../models/database');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect(`/${req.session.user.role}/dashboard`);
  }
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('login', { error: 'Username and password are required.' });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.render('login', { error: 'Invalid username or password.' });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
    full_name: user.full_name
  };

  res.redirect(`/${user.role}/dashboard`);
});

router.get('/register', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect(`/${req.session.user.role}/dashboard`);
  }
  res.render('register', { error: null });
});

router.post('/register', (req, res) => {
  const { username, password, confirm_password, full_name, role } = req.body;

  if (!username || !password || !full_name || !role) {
    return res.render('register', { error: 'All fields are required.' });
  }

  if (password !== confirm_password) {
    return res.render('register', { error: 'Passwords do not match.' });
  }

  if (password.length < 6) {
    return res.render('register', { error: 'Password must be at least 6 characters.' });
  }

  if (!['teacher', 'student'].includes(role)) {
    return res.render('register', { error: 'Invalid role selected.' });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

  if (existing) {
    return res.render('register', { error: 'Username already taken.' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)'
  ).run(username, hashedPassword, role, full_name);

  res.redirect('/login');
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

router.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect(`/${req.session.user.role}/dashboard`);
  }
  res.redirect('/login');
});

module.exports = router;
