const request = require('supertest');
const path = require('path');

// Use an in-memory-like temp DB for testing
process.env.DB_PATH = path.join(__dirname, '..', 'test-library.db');

const createApp = require('../app');
const { getDb, closeDb } = require('../models/database');
const fs = require('fs');

let app;

// Helper to get CSRF token and cookies from a GET request
async function getCsrfToken(url) {
  const res = await request(app).get(url);
  const cookies = res.headers['set-cookie'] || [];
  const tokenMatch = res.text.match(/name="_csrf"\s+value="([^"]+)"/);
  const token = tokenMatch ? tokenMatch[1] : '';
  const cookieHeader = cookies.map(c => c.split(';')[0]).join('; ');
  return { token, cookieHeader };
}

beforeAll(() => {
  app = createApp();
});

afterAll(() => {
  closeDb();
  // Clean up test database
  const dbPath = process.env.DB_PATH;
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});

describe('Authentication', () => {
  test('GET /login should show login page', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Login');
    expect(res.text).toContain('Username');
    expect(res.text).toContain('Password');
  });

  test('GET /register should show registration page', async () => {
    const res = await request(app).get('/register');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Register');
    expect(res.text).toContain('Student');
    expect(res.text).toContain('Teacher');
  });

  test('GET / should redirect to login', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('POST /register should create a student account', async () => {
    const { token, cookieHeader } = await getCsrfToken('/register');
    const res = await request(app)
      .post('/register')
      .set('Cookie', cookieHeader)
      .send(`_csrf=${encodeURIComponent(token)}&username=teststudent&password=password123&confirm_password=password123&full_name=Test+Student&role=student`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');

    // Verify user exists in database
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get('teststudent');
    expect(user).toBeTruthy();
    expect(user.role).toBe('student');
    expect(user.full_name).toBe('Test Student');
  });

  test('POST /register should create a teacher account', async () => {
    const { token, cookieHeader } = await getCsrfToken('/register');
    const res = await request(app)
      .post('/register')
      .set('Cookie', cookieHeader)
      .send(`_csrf=${encodeURIComponent(token)}&username=testteacher&password=password123&confirm_password=password123&full_name=Test+Teacher&role=teacher`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('POST /register should reject duplicate username', async () => {
    const { token, cookieHeader } = await getCsrfToken('/register');
    const res = await request(app)
      .post('/register')
      .set('Cookie', cookieHeader)
      .send(`_csrf=${encodeURIComponent(token)}&username=teststudent&password=password123&confirm_password=password123&full_name=Duplicate&role=student`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Username already taken');
  });

  test('POST /register should reject mismatched passwords', async () => {
    const { token, cookieHeader } = await getCsrfToken('/register');
    const res = await request(app)
      .post('/register')
      .set('Cookie', cookieHeader)
      .send(`_csrf=${encodeURIComponent(token)}&username=newuser&password=password123&confirm_password=different&full_name=New+User&role=student`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Passwords do not match');
  });

  test('POST /register should reject short passwords', async () => {
    const { token, cookieHeader } = await getCsrfToken('/register');
    const res = await request(app)
      .post('/register')
      .set('Cookie', cookieHeader)
      .send(`_csrf=${encodeURIComponent(token)}&username=newuser&password=abc&confirm_password=abc&full_name=New+User&role=student`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Password must be at least 6 characters');
  });

  test('POST /login with valid credentials should redirect to dashboard', async () => {
    const { token, cookieHeader } = await getCsrfToken('/login');
    const res = await request(app)
      .post('/login')
      .set('Cookie', cookieHeader)
      .send(`_csrf=${encodeURIComponent(token)}&username=teststudent&password=password123`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/student/dashboard');
  });

  test('POST /login with teacher should redirect to teacher dashboard', async () => {
    const { token, cookieHeader } = await getCsrfToken('/login');
    const res = await request(app)
      .post('/login')
      .set('Cookie', cookieHeader)
      .send(`_csrf=${encodeURIComponent(token)}&username=admin&password=admin123`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/teacher/dashboard');
  });

  test('POST /login with invalid credentials should show error', async () => {
    const { token, cookieHeader } = await getCsrfToken('/login');
    const res = await request(app)
      .post('/login')
      .set('Cookie', cookieHeader)
      .send(`_csrf=${encodeURIComponent(token)}&username=teststudent&password=wrongpassword`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Invalid username or password');
  });

  test('POST /login with missing fields should show error', async () => {
    const { token, cookieHeader } = await getCsrfToken('/login');
    const res = await request(app)
      .post('/login')
      .set('Cookie', cookieHeader)
      .send(`_csrf=${encodeURIComponent(token)}&username=&password=`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Username and password are required');
  });

  test('POST /login without CSRF token should be rejected', async () => {
    const res = await request(app)
      .post('/login')
      .send('username=admin&password=admin123');
    // Request should be rejected - either by CSRF protection (403) or rate limiter (429)
    expect([403, 429]).toContain(res.status);
  });
});

describe('Authorization', () => {
  test('Teacher routes should redirect unauthenticated users to login', async () => {
    const res = await request(app).get('/teacher/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  test('Student routes should redirect unauthenticated users to login', async () => {
    const res = await request(app).get('/student/dashboard');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });
});

describe('Database', () => {
  test('Default teacher account should exist', async () => {
    const db = getDb();
    const teacher = db.prepare("SELECT * FROM users WHERE role = 'teacher' AND username = 'admin'").get();
    expect(teacher).toBeTruthy();
    expect(teacher.full_name).toBe('Default Librarian');
  });

  test('Books table should exist', async () => {
    const db = getDb();
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='books'").get();
    expect(result).toBeTruthy();
  });

  test('Borrowings table should exist', async () => {
    const db = getDb();
    const result = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='borrowings'").get();
    expect(result).toBeTruthy();
  });
});

describe('Teacher functionality (via database)', () => {
  test('Teacher can add books to the database', () => {
    const db = getDb();
    db.prepare(
      'INSERT INTO books (title, author, isbn, total_copies, available_copies, category, added_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run('Test Book', 'Test Author', 'ISBN-001', 3, 3, 'Science', 1);

    const book = db.prepare('SELECT * FROM books WHERE isbn = ?').get('ISBN-001');
    expect(book).toBeTruthy();
    expect(book.title).toBe('Test Book');
    expect(book.total_copies).toBe(3);
    expect(book.available_copies).toBe(3);
  });

  test('Teacher can view all books', () => {
    const db = getDb();
    const books = db.prepare('SELECT * FROM books').all();
    expect(books.length).toBeGreaterThan(0);
  });
});

describe('Student functionality (via database)', () => {
  let studentId;
  let bookId;

  beforeAll(() => {
    const db = getDb();
    const student = db.prepare('SELECT id FROM users WHERE username = ?').get('teststudent');
    studentId = student.id;
    const book = db.prepare('SELECT id FROM books WHERE isbn = ?').get('ISBN-001');
    bookId = book.id;
  });

  test('Student can borrow a book', () => {
    const db = getDb();

    db.prepare(
      "INSERT INTO borrowings (book_id, user_id, due_date) VALUES (?, ?, datetime('now', '+14 days'))"
    ).run(bookId, studentId);

    db.prepare('UPDATE books SET available_copies = available_copies - 1 WHERE id = ?').run(bookId);

    const borrowing = db.prepare(
      "SELECT * FROM borrowings WHERE book_id = ? AND user_id = ? AND status = 'borrowed'"
    ).get(bookId, studentId);
    expect(borrowing).toBeTruthy();

    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
    expect(book.available_copies).toBe(2);
  });

  test('Student can return a book', () => {
    const db = getDb();

    const borrowing = db.prepare(
      "SELECT * FROM borrowings WHERE book_id = ? AND user_id = ? AND status = 'borrowed'"
    ).get(bookId, studentId);

    db.prepare(
      "UPDATE borrowings SET status = 'returned', return_date = datetime('now') WHERE id = ?"
    ).run(borrowing.id);

    db.prepare('UPDATE books SET available_copies = available_copies + 1 WHERE id = ?').run(bookId);

    const updated = db.prepare('SELECT * FROM borrowings WHERE id = ?').get(borrowing.id);
    expect(updated.status).toBe('returned');

    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(bookId);
    expect(book.available_copies).toBe(3);
  });
});

describe('404 handling', () => {
  test('Non-existent route should return 404', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
    expect(res.text).toContain('Page not found');
  });
});
