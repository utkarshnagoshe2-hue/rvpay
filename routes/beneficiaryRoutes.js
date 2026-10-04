const express = require('express');
const authenticate = require('../middleware/auth');
const {
  createBeneficiary,
  deleteBeneficiary,
  getBeneficiaries,
  updateBeneficiary,
} = require('../controllers/beneficiaryController');

const router = express.Router();

router.use(authenticate);
router.get('/', getBeneficiaries);
router.post('/', createBeneficiary);
router.put('/:id', updateBeneficiary);
router.delete('/:id', deleteBeneficiary);

module.exports = router;