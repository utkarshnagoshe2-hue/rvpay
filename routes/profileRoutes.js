const express = require('express');
const authenticate = require('../middleware/auth');
const { getProfile, updateProfile } = require('../controllers/profileController');

const router = express.Router();

router.use(authenticate);
router.get('/', getProfile);
router.put('/', updateProfile);

module.exports = router;
