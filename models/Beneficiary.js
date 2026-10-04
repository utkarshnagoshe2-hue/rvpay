const mongoose = require('mongoose');

const beneficiarySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  destination: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
    match: /^(?:[6-9]\d{9}|[a-z0-9][a-z0-9._-]{1,100}@[a-z0-9][a-z0-9.-]{1,90})$/i,
  },
}, { timestamps: true });

beneficiarySchema.index({ user: 1, destination: 1 }, { unique: true });

module.exports = mongoose.model('Beneficiary', beneficiarySchema);