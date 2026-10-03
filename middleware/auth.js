const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured.');
  return process.env.JWT_SECRET;
};

const authenticate = async (request, response, next) => {
  const authorization = request.get('authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '').trim();

  if (!token) return response.status(401).json({ error: 'Authentication required.' });

  try {
    const payload = jwt.verify(token, getJwtSecret());
    const user = await User.findById(payload.sub);

    if (!user) return response.status(401).json({ error: 'Authentication required.' });
    if (user.isBlocked) return response.status(403).json({ error: 'This account has been blocked.' });

    request.user = user;
    return next();
  } catch (error) {
    return response.status(401).json({ error: 'Invalid or expired token.' });
  }
};

module.exports = authenticate;
