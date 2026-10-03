const express = require('express');
const { authLimiter } = require('../middleware/rateLimits');
const { login, register, requestPasswordReset, resetPassword } = require('../controllers/authController');

const router = express.Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/forgot-password', authLimiter, requestPasswordReset);
router.post('/reset-password', authLimiter, resetPassword);

module.exports = router;
