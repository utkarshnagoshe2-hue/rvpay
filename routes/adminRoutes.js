const express = require('express');
const authenticate = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const {
  deleteUser,
  getAccounts,
  getActivity,
  getOverview,
  getTransactions,
  getUserDetails,
  getUsers,
  setUserBlocked,
} = require('../controllers/adminController');
const { updateTransactionStatus } = require('../controllers/transactionController');

const router = express.Router();

router.use(authenticate, requireAdmin);
router.get('/overview', getOverview);
router.get('/activity', getActivity);
router.get('/users', getUsers);
router.get('/users/:id', getUserDetails);
router.get('/accounts', getAccounts);
router.get('/transactions', getTransactions);
router.patch('/transactions/:id/status', updateTransactionStatus);
router.patch('/users/:id/block', setUserBlocked);
router.delete('/users/:id', deleteUser);

module.exports = router;
