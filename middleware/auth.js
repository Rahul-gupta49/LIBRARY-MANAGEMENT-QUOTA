function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function requireTeacher(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'teacher') {
    return res.status(403).render('error', {
      message: 'Access denied. Teachers only.',
      user: req.session.user
    });
  }
  next();
}

function requireStudent(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'student') {
    return res.status(403).render('error', {
      message: 'Access denied. Students only.',
      user: req.session.user
    });
  }
  next();
}

module.exports = { requireLogin, requireTeacher, requireStudent };
