const crypto = require('crypto');

const encryptedPrefix = 'enc:v1:';

const getEncryptionKey = () => {
  const value = process.env.ACCOUNT_ENCRYPTION_KEY || '';
  if (!/^[a-f\d]{64}$/i.test(value)) {
    throw new Error('ACCOUNT_ENCRYPTION_KEY must be a 64-character hex key.');
  }
  return Buffer.from(value, 'hex');
};

const isEncryptedAccountNumber = (value) => String(value || '').startsWith(encryptedPrefix);

const encryptAccountNumber = (value) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${encryptedPrefix}${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
};

const decryptAccountNumber = (value) => {
  const storedValue = String(value || '');
  if (!isEncryptedAccountNumber(storedValue)) return storedValue;

  const [ivHex, tagHex, ciphertextHex] = storedValue.slice(encryptedPrefix.length).split(':');
  if (!ivHex || !tagHex || !ciphertextHex) throw new Error('Stored account number has an invalid encrypted format.');

  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
};

module.exports = { decryptAccountNumber, encryptAccountNumber, getEncryptionKey, isEncryptedAccountNumber };
