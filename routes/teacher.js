const express = require('express');
const { requireTeacher } = require('../middleware/auth');
const { getDb } = require('../models/database');
const bcrypt = require('bcryptjs');

const router = express.Router();

router.use(requireTeacher);

// Teacher Dashboard
router.get('/dashboard', (req, res) => {
  const db = getDb();
  const totalBooks = db.prepare('SELECT COUNT(*) as count FROM books').get().count;
  const totalStudents = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get().count;
  const activeBorrowings = db.prepare("SELECT COUNT(*) as count FROM borrowings WHERE status = 'borrowed'").get().count;
  const overdueBorrowings = db.prepare(
    "SELECT COUNT(*) as count FROM borrowings WHERE status = 'borrowed' AND due_date < datetime('now')"
  ).get().count;

  res.render('teacher/dashboard', {
    user: req.session.user,
    stats: { totalBooks, totalStudents, activeBorrowings, overdueBorrowings }
  });
});

// Manage Books
router.get('/books', (req, res) => {
  const db = getDb();
  const search = req.query.search || '';
  let books;

  if (search) {
    books = db.prepare(
      'SELECT * FROM books WHERE title LIKE ? OR author LIKE ? OR isbn LIKE ? ORDER BY title'
    ).all(`%${search}%`, `%${search}%`, `%${search}%`);
  } else {
    books = db.prepare('SELECT * FROM books ORDER BY title').all();
  }

  res.render('teacher/books', { user: req.session.user, books, search });
});

router.get('/books/add', (req, res) => {
  res.render('teacher/add-book', { user: req.session.user, error: null });
});

router.post('/books/add', (req, res) => {
  const { title, author, isbn, total_copies, category } = req.body;

  if (!title || !author || !isbn) {
    return res.render('teacher/add-book', {
      user: req.session.user,
      error: 'Title, Author, and ISBN are required.'
    });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM books WHERE isbn = ?').get(isbn);
  if (existing) {
    return res.render('teacher/add-book', {
      user: req.session.user,
      error: 'A book with this ISBN already exists.'
    });
  }

  const copies = parseInt(total_copies, 10) || 1;
  db.prepare(
    'INSERT INTO books (title, author, isbn, total_copies, available_copies, category, added_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(title, author, isbn, copies, copies, category || 'General', req.session.user.id);

  res.redirect('/teacher/books');
});

router.post('/books/delete/:id', (req, res) => {
  const db = getDb();
  const bookId = req.params.id;

  const activeBorrowing = db.prepare(
    "SELECT id FROM borrowings WHERE book_id = ? AND status = 'borrowed'"
  ).get(bookId);

  if (activeBorrowing) {
    return res.redirect('/teacher/books?error=Cannot+delete+book+with+active+borrowings');
  }

  db.prepare('DELETE FROM borrowings WHERE book_id = ?').run(bookId);
  db.prepare('DELETE FROM books WHERE id = ?').run(bookId);
  res.redirect('/teacher/books');
});

// View Borrowings
router.get('/borrowings', (req, res) => {
  const db = getDb();
  const borrowings = db.prepare(`
    SELECT b.*, bk.title as book_title, bk.author as book_author, bk.isbn,
           u.full_name as student_name, u.username as student_username
    FROM borrowings b
    JOIN books bk ON b.book_id = bk.id
    JOIN users u ON b.user_id = u.id
    ORDER BY b.borrow_date DESC
  `).all();

  res.render('teacher/borrowings', { user: req.session.user, borrowings });
});

// Manage Students
router.get('/students', (req, res) => {
  const db = getDb();
  const students = db.prepare(`
    SELECT u.*,
      (SELECT COUNT(*) FROM borrowings WHERE user_id = u.id AND status = 'borrowed') as active_borrowings
    FROM users u WHERE u.role = 'student' ORDER BY u.full_name
  `).all();

  res.render('teacher/students', { user: req.session.user, students });
});

router.get('/students/add', (req, res) => {
  res.render('teacher/add-student', { user: req.session.user, error: null });
});

router.post('/students/add', (req, res) => {
  const { username, password, full_name } = req.body;

  if (!username || !password || !full_name) {
    return res.render('teacher/add-student', {
      user: req.session.user,
      error: 'All fields are required.'
    });
  }

  if (password.length < 6) {
    return res.render('teacher/add-student', {
      user: req.session.user,
      error: 'Password must be at least 6 characters.'
    });
  }

  const db = getDb();
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.render('teacher/add-student', {
      user: req.session.user,
      error: 'Username already taken.'
    });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO users (username, password, role, full_name) VALUES (?, ?, ?, ?)'
  ).run(username, hashedPassword, 'student', full_name);

  res.redirect('/teacher/students');
});

module.exports = router;
