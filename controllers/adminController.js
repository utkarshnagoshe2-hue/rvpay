const mongoose = require('mongoose');
const Account = require('../models/Account');
const AuditLog = require('../models/AuditLog');
const Beneficiary = require('../models/Beneficiary');
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

const getUserDetails = async (request, response) => {
  const { id } = request.params;
  if (!mongoose.isValidObjectId(id)) return response.status(400).json({ error: 'Invalid user ID.' });

  try {
    const user = await User.findById(id)
      .select('name email phone role isBlocked createdAt')
      .lean();
    if (!user) return response.status(404).json({ error: 'User not found.' });

    const [accounts, transactions, beneficiaries] = await Promise.all([
      Account.countDocuments({ user: id }),
      Transaction.countDocuments({ user: id }),
      Beneficiary.countDocuments({ user: id }),
    ]);
    return response.json({ user, summary: { accounts, transactions, beneficiaries } });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to load user details.' });
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
      .populate('statusHistory.changedBy', 'name email')
      .sort({ date: -1, createdAt: -1 })
      .lean();
    return response.json({ transactions });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to load transactions.' });
  }
};

const getOverview = async (request, response) => {
  try {
    const [users, accounts, transactionGroups] = await Promise.all([
      User.countDocuments(),
      Account.countDocuments(),
      Transaction.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, volume: { $sum: '$amount' } } },
      ]),
    ]);
    const transactionStats = Object.fromEntries(transactionGroups.map((group) => [group._id, group]));
    const transactions = transactionGroups.reduce((total, group) => total + group.count, 0);
    const transactionVolume = transactionGroups.reduce((total, group) => total + group.volume, 0);
    return response.json({
      users,
      accounts,
      transactions,
      transactionVolume,
      successfulTransactions: transactionStats.Success?.count || 0,
      pendingTransactions: transactionStats.Pending?.count || 0,
    });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to load admin overview.' });
  }
};

const getActivity = async (request, response) => {
  try {
    const activity = await AuditLog.find()
      .populate('actor', 'name email')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    return response.json({ activity: activity.map((entry) => ({
      id: String(entry._id),
      actor: entry.actor ? { name: entry.actor.name, email: entry.actor.email } : null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      createdAt: entry.createdAt,
    })) });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to load admin activity.' });
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
      Beneficiary.deleteMany({ user: user.id }),
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

module.exports = { deleteUser, getAccounts, getActivity, getOverview, getTransactions, getUserDetails, getUsers, setUserBlocked };
