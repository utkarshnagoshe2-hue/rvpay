const crypto = require('crypto');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const writeAuditLog = require('../services/auditLogger');
const supportedStatuses = new Set(['Pending', 'Success', 'Failed', 'Cancelled']);

const toClientTransaction = (transaction) => ({
  id: transaction.id || String(transaction._id),
  transactionId: transaction.transactionId,
  recipientName: transaction.recipient,
  recipient: transaction.recipient,
  amount: transaction.amount,
  date: transaction.date.toLocaleDateString('en-IN'),
  time: transaction.date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  status: transaction.status,
  createdAt: transaction.createdAt,
});

const createTransaction = async (request, response) => {
  const { recipient, recipientName, amount } = request.body || {};
  const normalizedRecipient = String(recipient ?? recipientName ?? '').trim();
  const numericAmount = Number(amount);

  if (!normalizedRecipient || normalizedRecipient.length > 200 || !Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 100000000) {
    return response.status(400).json({ error: 'Provide a recipient of at most 200 characters and an amount from 0.01 to 100000000.' });
  }

  try {
    const transaction = await Transaction.create({
      user: request.user.id,
      transactionId: `RV${Date.now()}${crypto.randomBytes(3).toString('hex')}`,
      recipient: normalizedRecipient,
      amount: numericAmount,
      date: new Date(),
      status: 'Pending',
    });

    await writeAuditLog({
      request,
      actorId: request.user.id,
      action: 'transaction.created',
      entityType: 'Transaction',
      entityId: transaction.id,
      metadata: { transactionId: transaction.transactionId, amount: transaction.amount, status: transaction.status },
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
    const transactions = await Transaction.find({ user: request.user.id }).sort({ date: -1, createdAt: -1 });
    return response.json({ transactions: transactions.map(toClientTransaction) });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to load transactions.' });
  }
};

const updateTransactionStatus = async (request, response) => {
  const { id } = request.params;
  const { status } = request.body || {};

  if (!supportedStatuses.has(status)) {
    return response.status(400).json({ error: 'Status must be Pending, Success, Failed, or Cancelled.' });
  }

  const transactionFilter = mongoose.isValidObjectId(id)
    ? { _id: id, user: request.user.id }
    : { transactionId: id, user: request.user.id };

  try {
    const transaction = await Transaction.findOneAndUpdate(
      transactionFilter,
      { $set: { status } },
      { new: true, runValidators: true },
    );
    if (!transaction) return response.status(404).json({ error: 'Transaction not found.' });
    await writeAuditLog({
      request,
      actorId: request.user.id,
      action: 'transaction.status_updated',
      entityType: 'Transaction',
      entityId: transaction.id,
      metadata: { transactionId: transaction.transactionId, status },
    });
    return response.json({ transaction: toClientTransaction(transaction) });
  } catch (error) {
    if (error.name === 'ValidationError') return response.status(400).json({ error: 'Invalid transaction status.' });
    return response.status(500).json({ error: 'Unable to update transaction status.' });
  }
};

module.exports = { createTransaction, getTransactions, updateTransactionStatus };
