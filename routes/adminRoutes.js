const express = require('express');
const authenticate = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const {
  deleteUser,
  getAccounts,
  getOverview,
  getTransactions,
  getUsers,
  setUserBlocked,
} = require('../controllers/adminController');

const router = express.Router();

router.use(authenticate, requireAdmin);
router.get('/overview', getOverview);
router.get('/users', getUsers);
router.get('/accounts', getAccounts);
router.get('/transactions', getTransactions);
router.patch('/users/:id/block', setUserBlocked);
router.delete('/users/:id', deleteUser);

module.exports = router;
