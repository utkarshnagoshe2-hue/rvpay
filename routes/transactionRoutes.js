const express = require('express');
const authenticate = require('../middleware/auth');
const { createTransaction, getTransactions, updateTransactionStatus } = require('../controllers/transactionController');

const router = express.Router();

router.use(authenticate);
router.get('/', getTransactions);
router.post('/', createTransaction);
router.patch('/:id/status', updateTransactionStatus);

module.exports = router;
