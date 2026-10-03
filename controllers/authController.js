const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const writeAuditLog = require('../services/auditLogger');

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured.');
  return process.env.JWT_SECRET;
};

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
});

const createToken = (user) => jwt.sign(
  { sub: user.id, email: user.email },
  getJwtSecret(),
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
);

const normalizePhone = (value) => {
  const digits = String(value || '').replace(/[()+\s-]/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone) => /^[6-9]\d{9}$/.test(phone);

const register = async (request, response) => {
  const { name, email, phone, password } = request.body || {};
  const normalizedName = String(name || '').trim();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedName || !normalizedEmail || !normalizedPhone || !password) {
    return response.status(400).json({ error: 'Name, email, phone, and password are required.' });
  }
  if (normalizedName.length > 120 || normalizedEmail.length > 254) {
    return response.status(400).json({ error: 'Name or email exceeds the maximum allowed length.' });
  }

  if (String(password).length < 8) {
    return response.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (Buffer.byteLength(String(password), 'utf8') > 72) {
    return response.status(400).json({ error: 'Password must not exceed 72 UTF-8 bytes.' });
  }

  if (!isValidEmail(normalizedEmail)) {
    return response.status(400).json({ error: 'Please provide a valid email address.' });
  }

  if (!isValidPhone(normalizedPhone)) {
    return response.status(400).json({ error: 'Please provide a valid mobile number.' });
  }

  try {
    getJwtSecret();
    const passwordHash = await bcrypt.hash(String(password), 12);
    const user = await User.create({
      name: normalizedName,
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
    });

    await writeAuditLog({ request, actorId: user.id, action: 'auth.register.succeeded', entityType: 'User', entityId: user.id });
    return response.status(201).json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({ error: 'An account with that email or phone already exists.' });
    }

    if (error.name === 'ValidationError') {
      return response.status(400).json({ error: 'Please provide valid account details.' });
    }

    return response.status(500).json({ error: 'Unable to create account.' });
  }
};

const login = async (request, response) => {
  const { contact, password } = request.body || {};
  const normalizedContact = String(contact || '').trim();
  const normalizedPhone = normalizePhone(normalizedContact);

  if (!normalizedContact || !password) {
    return response.status(400).json({ error: 'Email or phone and password are required.' });
  }

  try {
    getJwtSecret();
    const user = await User.findOne({
      $or: [
        { email: normalizedContact.toLowerCase() },
        { phone: normalizedPhone },
      ],
    }).select('+passwordHash');

    if (!user || !(await bcrypt.compare(String(password), user.passwordHash))) {
      await writeAuditLog({
        request,
        actorId: user?.id || null,
        action: 'auth.login.failed',
        entityType: 'User',
        entityId: user?.id || null,
      });
      return response.status(401).json({ error: 'Invalid login details.' });
    }

    if (user.isBlocked) {
      await writeAuditLog({ request, actorId: user.id, action: 'auth.login.blocked', entityType: 'User', entityId: user.id });
      return response.status(403).json({ error: 'This account has been blocked.' });
    }

    await writeAuditLog({ request, actorId: user.id, action: 'auth.login.succeeded', entityType: 'User', entityId: user.id });
    return response.json({ token: createToken(user), user: publicUser(user) });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to log in.' });
  }
};

const requestPasswordReset = async (request, response) => {
  const contact = String(request.body?.contact || request.body?.email || '').trim();
  if (!contact) return response.status(400).json({ error: 'Email or mobile number is required.' });

  const normalizedPhone = normalizePhone(contact);
  try {
    const user = await User.findOne({
      $or: [
        { email: contact.toLowerCase() },
        { phone: normalizedPhone },
      ],
    });

    let resetToken;
    if (user) {
      resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      await PasswordReset.deleteMany({ user: user.id });
      await PasswordReset.create({ user: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) });
    }

    const result = { message: 'If an account matches, password reset instructions will be sent shortly.' };
    if (user && process.env.NODE_ENV !== 'production' && process.env.RETURN_PASSWORD_RESET_TOKEN === 'true') {
      result.resetToken = resetToken;
    }
    return response.status(202).json(result);
  } catch (error) {
    return response.status(500).json({ error: 'Unable to process password reset request.' });
  }
};

const resetPassword = async (request, response) => {
  const { token, password } = request.body || {};
  if (!token || !password) return response.status(400).json({ error: 'Reset token and new password are required.' });
  if (String(password).length < 8) return response.status(400).json({ error: 'Password must be at least 8 characters.' });
  if (Buffer.byteLength(String(password), 'utf8') > 72) return response.status(400).json({ error: 'Password must not exceed 72 UTF-8 bytes.' });

  try {
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const resetRecord = await PasswordReset.findOneAndDelete({ tokenHash, expiresAt: { $gt: new Date() } });
    if (!resetRecord) return response.status(400).json({ error: 'Reset token is invalid or expired.' });

    const user = await User.findById(resetRecord.user);
    if (!user) return response.status(400).json({ error: 'Reset token is invalid or expired.' });
    user.passwordHash = await bcrypt.hash(String(password), 12);
    await user.save();
    await PasswordReset.deleteMany({ user: user.id });
    await writeAuditLog({ request, actorId: user.id, action: 'auth.password_reset.succeeded', entityType: 'User', entityId: user.id });
    return response.json({ message: 'Password has been reset.' });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to reset password.' });
  }
};

module.exports = { login, register, requestPasswordReset, resetPassword };
