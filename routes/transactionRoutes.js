const express = require('express');
const authenticate = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { createTransaction, getTransactions, updateTransactionStatus } = require('../controllers/transactionController');

const router = express.Router();

router.use(authenticate);
router.get('/', getTransactions);
router.post('/', createTransaction);
router.patch('/:id/status', requireAdmin, updateTransactionStatus);

module.exports = router;
