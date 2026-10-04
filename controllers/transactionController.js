const crypto = require('crypto');
const mongoose = require('mongoose');
const Beneficiary = require('../models/Beneficiary');
const Transaction = require('../models/Transaction');
const writeAuditLog = require('../services/auditLogger');
const supportedStatuses = new Set(['Pending', 'Approved', 'Processing', 'Success', 'Failed', 'Cancelled']);
const allowedTransitions = {
  Pending: new Set(['Approved', 'Failed', 'Cancelled']),
  Approved: new Set(['Processing', 'Failed', 'Cancelled']),
  Processing: new Set(['Success', 'Failed']),
  Success: new Set(),
  Failed: new Set(),
  Cancelled: new Set(),
};

const toClientTransaction = (transaction) => ({
  id: transaction.id || String(transaction._id),
  transactionId: transaction.transactionId,
  recipientName: transaction.recipient,
  recipient: transaction.recipient,
  beneficiaryId: transaction.beneficiary ? String(transaction.beneficiary) : null,
  amount: transaction.amount,
  date: transaction.date.toLocaleDateString('en-IN'),
  time: transaction.date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  status: transaction.status,
  statusHistory: (transaction.statusHistory?.length ? transaction.statusHistory : [{
    status: transaction.status,
    changedAt: transaction.createdAt || transaction.date,
    changedBy: null,
    note: 'Initial status',
  }]).map((entry) => ({
    status: entry.status,
    changedAt: entry.changedAt,
    changedBy: entry.changedBy ? {
      id: String(entry.changedBy._id || entry.changedBy),
      name: entry.changedBy.name || null,
      email: entry.changedBy.email || null,
    } : null,
    note: entry.note || '',
  })),
  createdAt: transaction.createdAt,
});

const createTransaction = async (request, response) => {
  const { beneficiaryId, amount } = request.body || {};
  const numericAmount = Number(amount);

  if (!mongoose.isValidObjectId(beneficiaryId) || !Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 100000000) {
    return response.status(400).json({ error: 'Select a valid beneficiary and provide an amount from 0.01 to 100000000.' });
  }

  try {
    const beneficiary = await Beneficiary.findOne({ _id: beneficiaryId, user: request.user.id });
    if (!beneficiary) return response.status(404).json({ error: 'Beneficiary not found.' });

    const transaction = await Transaction.create({
      user: request.user.id,
      transactionId: `RV${Date.now()}${crypto.randomBytes(3).toString('hex')}`,
      recipient: beneficiary.name,
      beneficiary: beneficiary.id,
      amount: numericAmount,
      date: new Date(),
      status: 'Pending',
      statusHistory: [{ status: 'Pending', changedBy: request.user.id, note: 'Transaction created' }],
    });

    await writeAuditLog({
      request,
      actorId: request.user.id,
      action: 'transaction.created',
      entityType: 'Transaction',
      entityId: transaction.id,
      metadata: { transactionId: transaction.transactionId, amount: transaction.amount, status: transaction.status, beneficiaryId: beneficiary.id },
    });
    return response.status(201).json({ transaction: toClientTransaction(transaction) });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return response.status(400).json({ error: 'Please provide valid transaction details.' });
    }

    return response.status(500).json({ error: 'Unable to create transaction.' });
  }
};

const getTransactions = async (request, response) => {
  try {
    const transactions = await Transaction.find({ user: request.user.id })
      .populate('statusHistory.changedBy', 'name email')
      .sort({ date: -1, createdAt: -1 });
    return response.json({ transactions: transactions.map(toClientTransaction) });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to load transactions.' });
  }
};

const updateTransactionStatus = async (request, response) => {
  if (request.user?.role !== 'admin') {
    return response.status(403).json({ error: 'Administrator access required to change transaction status.' });
  }
  const { id } = request.params;
  const { status } = request.body || {};

  if (!supportedStatuses.has(status)) {
    return response.status(400).json({ error: 'Choose a supported transaction status.' });
  }
  const note = request.body?.note == null ? '' : String(request.body.note).trim();
  if (note.length > 500) return response.status(400).json({ error: 'Status note must be at most 500 characters.' });

  const idFilter = mongoose.isValidObjectId(id) ? { _id: id } : { transactionId: id };
  const transactionFilter = request.user.role === 'admin'
    ? idFilter
    : { ...idFilter, user: request.user.id };

  try {
    const currentTransaction = await Transaction.findOne(transactionFilter);
    if (!currentTransaction) return response.status(404).json({ error: 'Transaction not found.' });
    if (!allowedTransitions[currentTransaction.status]?.has(status)) {
      return response.status(409).json({ error: `Cannot transition a ${currentTransaction.status} transaction to ${status}.` });
    }

    const historyEntries = [];
    if (!currentTransaction.statusHistory?.length) {
      historyEntries.push({
        status: currentTransaction.status,
        changedBy: currentTransaction.user,
        changedAt: currentTransaction.createdAt || currentTransaction.date,
        note: 'Initial status',
      });
    }
    historyEntries.push({ status, changedBy: request.user.id, changedAt: new Date(), note });
    const transaction = await Transaction.findOneAndUpdate(
      { ...transactionFilter, status: currentTransaction.status },
      { $set: { status }, $push: { statusHistory: { $each: historyEntries } } },
      { new: true, runValidators: true },
    ).populate('statusHistory.changedBy', 'name email');
    if (!transaction) return response.status(409).json({ error: 'Transaction status changed. Refresh and try again.' });
    await writeAuditLog({
      request,
      actorId: request.user.id,
      action: 'transaction.status_transitioned',
      entityType: 'Transaction',
      entityId: transaction.id,
      metadata: { transactionId: transaction.transactionId, fromStatus: currentTransaction.status, toStatus: status, note },
    });
    return response.json({ transaction: toClientTransaction(transaction) });
  } catch (error) {
    if (error.name === 'ValidationError') return response.status(400).json({ error: 'Invalid transaction status.' });
    return response.status(500).json({ error: 'Unable to update transaction status.' });
  }
};

module.exports = { createTransaction, getTransactions, updateTransactionStatus };
