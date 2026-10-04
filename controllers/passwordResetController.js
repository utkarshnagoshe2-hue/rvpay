const bcrypt = require('bcrypt');
const crypto = require('crypto');
const PasswordReset = require('../models/PasswordReset');
const User = require('../models/User');
const writeAuditLog = require('../services/auditLogger');
const sendPasswordResetEmail = require('../services/passwordResetMailer');

const resetRequestedMessage = 'If an account matches, password reset instructions will be sent shortly.';
const invalidTokenMessage = 'This password reset link is invalid or has expired.';

const requestPasswordReset = async (request, response) => {
  const contact = String(request.body?.contact || '').trim();
  const normalizedEmail = contact.toLowerCase();
  const phoneDigits = contact.replace(/[()+\s-]/g, '');
  const normalizedPhone = phoneDigits.length === 12 && phoneDigits.startsWith('91')
    ? phoneDigits.slice(2)
    : phoneDigits;
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const isPhone = /^[6-9]\d{9}$/.test(normalizedPhone);

  if (!isEmail && !isPhone) {
    return response.status(400).json({ error: 'Enter a valid registered email or mobile number.' });
  }

  let user;
  try {
    user = await User.findOne(isEmail ? { email: normalizedEmail } : { phone: normalizedPhone });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to process password reset request.' });
  }
  if (!user) return response.status(202).json({ message: resetRequestedMessage });

  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
  let resetRecord;
  try {
    await PasswordReset.deleteMany({ user: user.id });
    resetRecord = await PasswordReset.create({
      user: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to process password reset request.' });
  }

  try {
    const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';
    const resetUrl = new URL('/reset-password.html', frontendOrigin);
    resetUrl.searchParams.set('token', resetToken);
    await sendPasswordResetEmail({ email: user.email, name: user.name, resetUrl: resetUrl.toString() });
  } catch (error) {
    try {
      await PasswordReset.deleteOne({ _id: resetRecord.id });
    } catch (cleanupError) {
      console.error('Password reset token cleanup failed:', cleanupError.message);
    }
    console.error('Password reset email delivery failed:', error.message);
    return response.status(202).json({ message: resetRequestedMessage });
  }

  await writeAuditLog({
    request,
    actorId: user.id,
    action: 'auth.password_reset.requested',
    entityType: 'User',
    entityId: user.id,
  });
  return response.status(202).json({ message: resetRequestedMessage });
};

const resetPassword = async (request, response) => {
  const { token, password } = request.body || {};
  if (typeof token !== 'string' || !/^[a-f\d]{64}$/i.test(token)) {
    return response.status(400).json({ error: invalidTokenMessage });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return response.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return response.status(400).json({ error: 'Password must not exceed 72 UTF-8 bytes.' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetRecord = await PasswordReset.findOneAndDelete({ tokenHash, expiresAt: { $gt: new Date() } });
    if (!resetRecord) return response.status(400).json({ error: invalidTokenMessage });

    const user = await User.findById(resetRecord.user);
    if (!user) return response.status(400).json({ error: invalidTokenMessage });
    user.passwordHash = await bcrypt.hash(password, 12);
    await user.save();
    await PasswordReset.deleteMany({ user: user.id });
    await writeAuditLog({
      request,
      actorId: user.id,
      action: 'auth.password_reset.succeeded',
      entityType: 'User',
      entityId: user.id,
    });
    return response.json({ message: 'Password has been reset.' });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to reset password.' });
  }
};

module.exports = { requestPasswordReset, resetPassword };