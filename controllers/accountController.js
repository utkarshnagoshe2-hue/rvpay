const mongoose = require('mongoose');
const Account = require('../models/Account');
const { decryptAccountNumber, encryptAccountNumber } = require('../services/accountEncryption');
const writeAuditLog = require('../services/auditLogger');

const isValidAccountDetails = ({ bankName, accountHolder, accountNumber, ifsc }) => (
  bankName.length <= 100
  && accountHolder.length <= 150
  && /^\d{6,34}$/.test(accountNumber)
  && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)
);

const toClientAccount = (account) => ({
  id: account.id || String(account._id),
  bank: account.bankName,
  holder: account.accountHolder,
  number: decryptAccountNumber(account.accountNumber).slice(-4),
  ifsc: account.ifsc,
});

const getAccounts = async (request, response) => {
  try {
    const accounts = await Account.find({ user: request.user.id }).sort({ createdAt: -1 });
    return response.json({ accounts: accounts.map(toClientAccount) });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to load linked accounts.' });
  }
};

const createAccount = async (request, response) => {
  const { bank, bankName, holder, accountHolder, number, accountNumber, ifsc } = request.body || {};
  const normalizedBank = String(bankName ?? bank ?? '').trim();
  const normalizedHolder = String(accountHolder ?? holder ?? '').trim();
  const normalizedNumber = String(accountNumber ?? number ?? '').trim();
  const normalizedIfsc = String(ifsc || '').trim().toUpperCase();

  if (!normalizedBank || !normalizedHolder || !normalizedNumber || !normalizedIfsc) {
    return response.status(400).json({ error: 'Bank name, account holder, account number, and IFSC are required.' });
  }
  if (!isValidAccountDetails({ bankName: normalizedBank, accountHolder: normalizedHolder, accountNumber: normalizedNumber, ifsc: normalizedIfsc })) {
    return response.status(400).json({ error: 'Please provide a valid bank name, account holder, account number, and IFSC.' });
  }

  try {
    const account = await Account.create({
      user: request.user.id,
      bankName: normalizedBank,
      accountHolder: normalizedHolder,
      accountNumber: encryptAccountNumber(normalizedNumber),
      ifsc: normalizedIfsc,
    });
    await writeAuditLog({ request, actorId: request.user.id, action: 'account.created', entityType: 'Account', entityId: account.id });
    return response.status(201).json({ account: toClientAccount(account) });
  } catch (error) {
    if (error.name === 'ValidationError') return response.status(400).json({ error: 'Please provide valid account details.' });
    return response.status(500).json({ error: 'Unable to add linked account.' });
  }
};

const updateAccount = async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid account ID.' });
  }

  const { bank, bankName, holder, accountHolder, number, accountNumber, ifsc } = request.body || {};
  const updates = {};

  if (bank !== undefined || bankName !== undefined) {
    updates.bankName = String(bankName ?? bank).trim();
    if (!updates.bankName) return response.status(400).json({ error: 'Bank name cannot be empty.' });
  }
  if (holder !== undefined || accountHolder !== undefined) {
    updates.accountHolder = String(accountHolder ?? holder).trim();
    if (!updates.accountHolder) return response.status(400).json({ error: 'Account holder cannot be empty.' });
  }
  if (number !== undefined || accountNumber !== undefined) {
    const normalizedNumber = String(accountNumber ?? number).trim();
    if (!normalizedNumber) return response.status(400).json({ error: 'Account number cannot be empty.' });
    updates.accountNumber = encryptAccountNumber(normalizedNumber);
  }
  if (ifsc !== undefined) {
    updates.ifsc = String(ifsc).trim().toUpperCase();
    if (!updates.ifsc) return response.status(400).json({ error: 'IFSC cannot be empty.' });
  }
  if (!Object.keys(updates).length) {
    return response.status(400).json({ error: 'At least one account field is required.' });
  }
  const currentAccount = await Account.findOne({ _id: request.params.id, user: request.user.id });
  if (!currentAccount) return response.status(404).json({ error: 'Linked account not found.' });
  const candidate = {
    bankName: updates.bankName ?? currentAccount.bankName,
    accountHolder: updates.accountHolder ?? currentAccount.accountHolder,
    accountNumber: updates.accountNumber ? String(accountNumber ?? number).trim() : decryptAccountNumber(currentAccount.accountNumber),
    ifsc: updates.ifsc ?? currentAccount.ifsc,
  };
  if (!isValidAccountDetails(candidate)) return response.status(400).json({ error: 'Please provide valid account details.' });

  try {
    const account = await Account.findOneAndUpdate(
      { _id: request.params.id, user: request.user.id },
      { $set: updates },
      { new: true, runValidators: true },
    );
    if (!account) return response.status(404).json({ error: 'Linked account not found.' });
    await writeAuditLog({
      request,
      actorId: request.user.id,
      action: 'account.updated',
      entityType: 'Account',
      entityId: account.id,
      metadata: { changedFields: Object.keys(updates).filter((field) => field !== 'accountNumber') },
    });
    return response.json({ account: toClientAccount(account) });
  } catch (error) {
    if (error.name === 'ValidationError') return response.status(400).json({ error: 'Please provide valid account details.' });
    return response.status(500).json({ error: 'Unable to update linked account.' });
  }
};

const deleteAccount = async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid account ID.' });
  }

  try {
    const result = await Account.deleteOne({ _id: request.params.id, user: request.user.id });
    if (!result.deletedCount) return response.status(404).json({ error: 'Linked account not found.' });
    return response.status(204).end();
  } catch (error) {
    return response.status(500).json({ error: 'Unable to delete linked account.' });
  }
};

module.exports = { createAccount, deleteAccount, getAccounts, updateAccount };
