const nodemailer = require('nodemailer');

const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  if (!host || !from) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const auth = process.env.SMTP_USER && process.env.SMTP_PASS
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined;
  return nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true' || (process.env.SMTP_SECURE !== 'false' && port === 465),
    ...(auth ? { auth } : {}),
  });
};

const sendPasswordResetEmail = async ({ email, name, resetUrl }) => {
  const transporter = createTransporter();
  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP_HOST and SMTP_FROM must be configured to send password reset email.');
    }
    console.info(`Development password reset link for ${email}: ${resetUrl}`);
    return;
  }

  const safeName = escapeHtml(name || 'there');
  const safeUrl = escapeHtml(resetUrl);
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Reset your RVPay password',
    text: `Hello ${name || 'there'},\n\nUse this link to reset your RVPay password. It expires in 30 minutes:\n${resetUrl}\n\nIf you did not request a reset, you can ignore this email.`,
    html: `<p>Hello ${safeName},</p><p>Use the link below to reset your RVPay password. It expires in 30 minutes.</p><p><a href="${safeUrl}">Reset password</a></p><p>If you did not request a reset, you can ignore this email.</p>`,
  });
};

module.exports = sendPasswordResetEmail;