const express = require('express');
const authenticate = require('../middleware/auth');
const { createAccount, deleteAccount, getAccounts, updateAccount } = require('../controllers/accountController');

const router = express.Router();

router.use(authenticate);
router.get('/', getAccounts);
router.post('/', createAccount);
router.put('/:id', updateAccount);
router.delete('/:id', deleteAccount);

module.exports = router;
