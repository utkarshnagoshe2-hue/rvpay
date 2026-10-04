const mongoose = require('mongoose');

const transactionStatuses = ['Pending', 'Approved', 'Processing', 'Success', 'Failed', 'Cancelled'];

const statusHistorySchema = new mongoose.Schema({
  status: { type: String, enum: transactionStatuses, required: true },
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  changedAt: { type: Date, required: true, default: Date.now },
  note: { type: String, trim: true, maxlength: 500, default: '' },
}, { _id: false });

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
  beneficiary: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Beneficiary',
    default: null,
    index: true,
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
    enum: transactionStatuses,
    required: true,
    default: 'Pending',
  },
  statusHistory: { type: [statusHistorySchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
