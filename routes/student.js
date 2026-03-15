const express = require('express');
const { requireStudent } = require('../middleware/auth');
const { getDb } = require('../models/database');

const router = express.Router();

router.use(requireStudent);

// Student Dashboard
router.get('/dashboard', (req, res) => {
  const db = getDb();
  const borrowedBooks = db.prepare(`
    SELECT b.*, bk.title as book_title, bk.author as book_author, bk.isbn
    FROM borrowings b
    JOIN books bk ON b.book_id = bk.id
    WHERE b.user_id = ? AND b.status = 'borrowed'
    ORDER BY b.borrow_date DESC
  `).all(req.session.user.id);

  const totalAvailableBooks = db.prepare('SELECT COUNT(*) as count FROM books WHERE available_copies > 0').get().count;

  res.render('student/dashboard', {
    user: req.session.user,
    borrowedBooks,
    totalAvailableBooks
  });
});

// Browse Available Books
router.get('/books', (req, res) => {
  const db = getDb();
  const search = req.query.search || '';
  const category = req.query.category || '';
  let books;

  if (search && category) {
    books = db.prepare(
      'SELECT * FROM books WHERE (title LIKE ? OR author LIKE ?) AND category = ? ORDER BY title'
    ).all(`%${search}%`, `%${search}%`, category);
  } else if (search) {
    books = db.prepare(
      'SELECT * FROM books WHERE title LIKE ? OR author LIKE ? ORDER BY title'
    ).all(`%${search}%`, `%${search}%`);
  } else if (category) {
    books = db.prepare('SELECT * FROM books WHERE category = ? ORDER BY title').all(category);
  } else {
    books = db.prepare('SELECT * FROM books ORDER BY title').all();
  }

  const categories = db.prepare('SELECT DISTINCT category FROM books ORDER BY category').all().map(c => c.category);

  res.render('student/books', { user: req.session.user, books, search, category, categories });
});

// Borrow a Book
router.post('/books/borrow/:id', (req, res) => {
  const db = getDb();
  const bookId = req.params.id;
  const userId = req.session.user.id;

  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
  if (!book || book.available_copies <= 0) {
    return res.redirect('/student/books?error=Book+not+available');
  }

  // Check if student already has this book borrowed
  const alreadyBorrowed = db.prepare(
    "SELECT id FROM borrowings WHERE book_id = ? AND user_id = ? AND status = 'borrowed'"
  ).get(bookId, userId);

  if (alreadyBorrowed) {
    return res.redirect('/student/books?error=You+already+have+this+book');
  }

  // Check borrowing limit (max 3 books at a time)
  const currentBorrowings = db.prepare(
    "SELECT COUNT(*) as count FROM borrowings WHERE user_id = ? AND status = 'borrowed'"
  ).get(userId).count;

  if (currentBorrowings >= 3) {
    return res.redirect('/student/books?error=Borrowing+limit+reached+(max+3+books)');
  }

  // Create borrowing (14-day loan period)
  db.prepare(
    "INSERT INTO borrowings (book_id, user_id, due_date) VALUES (?, ?, datetime('now', '+14 days'))"
  ).run(bookId, userId);

  db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?').run(bookId);

  res.redirect('/student/dashboard');
});

// Return a Book
router.post('/books/return/:borrowingId', (req, res) => {
  const db = getDb();
  const borrowingId = req.params.borrowingId;
  const userId = req.session.user.id;

  const borrowing = db.prepare(
    "SELECT * FROM borrowings WHERE id = ? AND user_id = ? AND status = 'borrowed'"
  ).get(borrowingId, userId);

  if (!borrowing) {
    return res.redirect('/student/dashboard?error=Borrowing+not+found');
  }

  db.prepare(
    "UPDATE borrowings SET status = 'returned', return_date = datetime('now') WHERE id = ?"
  ).run(borrowingId);

  db.prepare('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?').run(borrowing.book_id);

  res.redirect('/student/dashboard');
});

// Borrowing History
router.get('/history', (req, res) => {
  const db = getDb();
  const borrowings = db.prepare(`
    SELECT b.*, bk.title as book_title, bk.author as book_author, bk.isbn
    FROM borrowings b
    JOIN books bk ON b.book_id = bk.id
    WHERE b.user_id = ?
    ORDER BY b.borrow_date DESC
  `).all(req.session.user.id);

  res.render('student/history', { user: req.session.user, borrowings });
});

module.exports = router;
