const mongoose = require('mongoose');
const Account = require('../models/Account');
const PasswordReset = require('../models/PasswordReset');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { decryptAccountNumber } = require('../services/accountEncryption');
const writeAuditLog = require('../services/auditLogger');

const getUsers = async (request, response) => {
  try {
    const users = await User.find()
      .select('name email phone role isBlocked createdAt')
      .sort({ createdAt: -1 })
      .lean();
    return response.json({ users });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to load users.' });
  }
};

const getAccounts = async (request, response) => {
  try {
    const accounts = await Account.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .lean();
    return response.json({
      accounts: accounts.map((account) => ({
        id: String(account._id),
        user: account.user ? { id: String(account.user._id), name: account.user.name, email: account.user.email } : null,
        bankName: account.bankName,
        accountHolder: account.accountHolder,
        accountNumberMasked: `****${decryptAccountNumber(account.accountNumber).slice(-4)}`,
        ifsc: account.ifsc,
        createdAt: account.createdAt,
      })),
    });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to load linked accounts.' });
  }
};

const getTransactions = async (request, response) => {
  try {
    const transactions = await Transaction.find()
      .populate('user', 'name email')
      .sort({ date: -1, createdAt: -1 })
      .lean();
    return response.json({ transactions });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to load transactions.' });
  }
};

const getOverview = async (request, response) => {
  try {
    const [users, accounts, transactions] = await Promise.all([
      User.countDocuments(),
      Account.countDocuments(),
      Transaction.countDocuments(),
    ]);
    return response.json({ users, accounts, transactions });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to load admin overview.' });
  }
};

const setUserBlocked = async (request, response) => {
  const { id } = request.params;
  const { blocked } = request.body || {};
  if (!mongoose.isValidObjectId(id)) return response.status(400).json({ error: 'Invalid user ID.' });
  if (typeof blocked !== 'boolean') return response.status(400).json({ error: 'blocked must be a boolean.' });
  if (String(request.user.id) === id && blocked) return response.status(400).json({ error: 'You cannot block your own admin account.' });

  try {
    const user = await User.findByIdAndUpdate(id, { $set: { isBlocked: blocked } }, { new: true })
      .select('name email phone role isBlocked createdAt');
    if (!user) return response.status(404).json({ error: 'User not found.' });
    await writeAuditLog({
      request,
      actorId: request.user.id,
      action: blocked ? 'admin.user_blocked' : 'admin.user_unblocked',
      entityType: 'User',
      entityId: user.id,
      metadata: { changedFields: ['isBlocked'] },
    });
    return response.json({ user });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to update user status.' });
  }
};

const deleteUser = async (request, response) => {
  const { id } = request.params;
  if (!mongoose.isValidObjectId(id)) return response.status(400).json({ error: 'Invalid user ID.' });
  if (String(request.user.id) === id) return response.status(400).json({ error: 'You cannot delete your own admin account.' });

  try {
    const user = await User.findById(id);
    if (!user) return response.status(404).json({ error: 'User not found.' });

    await Promise.all([
      Account.deleteMany({ user: user.id }),
      Transaction.deleteMany({ user: user.id }),
      PasswordReset.deleteMany({ user: user.id }),
    ]);
    await user.deleteOne();
    await writeAuditLog({
      request,
      actorId: request.user.id,
      action: 'admin.user_deleted',
      entityType: 'User',
      entityId: user.id,
    });
    return response.status(204).end();
  } catch (error) {
    return response.status(500).json({ error: 'Unable to delete user and related records.' });
  }
};

module.exports = { deleteUser, getAccounts, getOverview, getTransactions, getUsers, setUserBlocked };
