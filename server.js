require('dotenv').config();

const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const accountRoutes = require('./routes/accountRoutes');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const healthRoutes = require('./routes/healthRoutes');
const profileRoutes = require('./routes/profileRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const PasswordReset = require('./models/PasswordReset');
const User = require('./models/User');
const Account = require('./models/Account');
const Transaction = require('./models/Transaction');
const AuditLog = require('./models/AuditLog');
const { encryptAccountNumber, getEncryptionKey, isEncryptedAccountNumber } = require('./services/accountEncryption');
const { apiLimiter } = require('./middleware/rateLimits');

const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const mongoUri = process.env.MONGODB_URI || (isProduction ? '' : 'mongodb://127.0.0.1:27017/rvpay');
const frontendOrigin = process.env.FRONTEND_ORIGIN || '';

if (isProduction) app.set('trust proxy', 1);

if (isProduction && (!/^mongodb(?:\+srv)?:\/\//i.test(mongoUri) || /[<>]/.test(mongoUri))) {
  console.error('MONGODB_URI must be configured with a MongoDB connection string in production.');
  process.exit(1);
}

if (isProduction) {
  try {
    const parsedFrontendOrigin = new URL(frontendOrigin);
    if (parsedFrontendOrigin.protocol !== 'https:'
      || parsedFrontendOrigin.origin !== frontendOrigin
      || /your-project|<|>/i.test(frontendOrigin)) {
      throw new Error();
    }
  } catch (error) {
    console.error('FRONTEND_ORIGIN must be the exact HTTPS origin of the production frontend.');
    process.exit(1);
  }
}

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || /^(?:replace[-_]|<)/i.test(process.env.JWT_SECRET)) {
  console.error('JWT_SECRET must be configured with at least 32 characters.');
  process.exit(1);
}

try {
  getEncryptionKey();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (isProduction) return callback(null, origin === frontendOrigin);

    try {
      const parsedOrigin = new URL(origin);
      const isLocalhost = parsedOrigin.protocol === 'http:'
        && ['localhost', '127.0.0.1'].includes(parsedOrigin.hostname);
      return callback(null, isLocalhost);
    } catch (error) {
      return callback(null, false);
    }
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use('/api', apiLimiter);

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/transactions', transactionRoutes);

const ensureCollections = async () => {
  const existingCollections = await mongoose.connection.db
    .listCollections({}, { nameOnly: true })
    .toArray();
  const existingNames = new Set(existingCollections.map((collection) => collection.name));

  const models = [User, Account, Transaction, PasswordReset, AuditLog];
  await Promise.all(models
    .filter((model) => !existingNames.has(model.collection.collectionName))
    .map((model) => model.createCollection()));

  await Promise.all(models.map((model) => model.init()));
};

const migratePlaintextAccountNumbers = async () => {
  const accounts = await Account.find({ accountNumber: { $not: /^enc:v1:/ } });
  for (const account of accounts) {
    account.accountNumber = encryptAccountNumber(account.accountNumber);
    await account.save();
  }
};

mongoose.connect(mongoUri)
  .then(ensureCollections)
  .then(migratePlaintextAccountNumbers)
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  });
