const requireAdmin = (request, response, next) => {
  if (request.user?.role !== 'admin') {
    return response.status(403).json({ error: 'Administrator access required.' });
  }
  return next();
};

module.exports = requireAdmin;