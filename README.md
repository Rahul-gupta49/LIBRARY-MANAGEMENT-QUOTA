# Library Management System

A web-based library management system with separate **Teacher (Librarian)** and **Student** login portals. Teachers can manage books, view borrowings, and manage students. Students can browse available books, borrow/return books, and view their borrowing history.

## Features

### Teacher (Librarian) Portal
- Dashboard with statistics (total books, students, active borrowings, overdue)
- Add, search, and delete books
- View all borrowings across students
- Add and manage student accounts

### Student Portal
- Dashboard showing currently borrowed books and remaining quota
- Browse and search available books by title, author, or category
- Borrow books (max 3 at a time, 14-day loan period)
- Return borrowed books
- View full borrowing history

### Authentication
- Separate login for teachers and students
- Role-based access control
- Secure password hashing with bcrypt
- Session-based authentication

## Tech Stack
- **Backend:** Node.js, Express
- **Database:** SQLite (via better-sqlite3)
- **Templates:** EJS
- **Auth:** express-session, bcryptjs

## Getting Started

### Prerequisites
- Node.js v18+

### Installation

```bash
npm install
```

### Run the Application

```bash
npm start
```

The app will be available at `http://localhost:3000`.

### Default Teacher Account
- **Username:** `admin`
- **Password:** `admin123`

### Run Tests

```bash
npm test
```

## Project Structure

```
├── app.js                  # Express app setup
├── server.js               # Server entry point
├── models/
│   └── database.js         # SQLite database setup and initialization
├── middleware/
│   └── auth.js             # Authentication middleware
├── routes/
│   ├── auth.js             # Login, register, logout routes
│   ├── teacher.js          # Teacher dashboard and management routes
│   └── student.js          # Student dashboard and book browsing routes
├── views/
│   ├── login.ejs           # Login page
│   ├── register.ejs        # Registration page
│   ├── error.ejs           # Error page
│   ├── partials/           # Shared template partials
│   ├── teacher/            # Teacher-specific views
│   └── student/            # Student-specific views
├── public/
│   └── css/style.css       # Stylesheet
└── tests/
    └── app.test.js         # Test suite
```