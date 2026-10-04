const express = require('express');
const { authLimiter } = require('../middleware/rateLimits');
const { requestPasswordReset, resetPassword } = require('../controllers/passwordResetController');

const router = express.Router();

router.post('/request', authLimiter, requestPasswordReset);
router.post('/confirm', authLimiter, resetPassword);

module.exports = router;