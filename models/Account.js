const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  bankName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  accountHolder: {
    type: String,
    required: true,
    trim: true,
    maxlength: 150,
  },
  accountNumber: {
    type: String,
    required: true,
    trim: true,
    match: /^enc:v1:[a-f0-9]{24}:[a-f0-9]{32}:[a-f0-9]+$/i,
  },
  ifsc: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    match: /^[A-Z]{4}0[A-Z0-9]{6}$/,
  },
}, { timestamps: true });

module.exports = mongoose.model('Account', accountSchema);
