const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  recipient: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01,
  },
  date: {
    type: Date,
    required: true,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['Pending', 'Success', 'Failed', 'Cancelled'],
    required: true,
    default: 'Pending',
  },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
