const User = require('../models/User');
const writeAuditLog = require('../services/auditLogger');

const publicProfile = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
});

const getProfile = (request, response) => response.json({ user: publicProfile(request.user) });

const updateProfile = async (request, response) => {
  const { name, email, phone, mobile } = request.body || {};
  const updates = {};

  if (name !== undefined) {
    const normalizedName = String(name).trim();
    if (!normalizedName) return response.status(400).json({ error: 'Name cannot be empty.' });
    updates.name = normalizedName;
  }

  if (email !== undefined) {
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!normalizedEmail) return response.status(400).json({ error: 'Email cannot be empty.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return response.status(400).json({ error: 'Please provide a valid email address.' });
    }
    updates.email = normalizedEmail;
  }

  if (phone !== undefined || mobile !== undefined) {
    let normalizedPhone = String(phone ?? mobile).replace(/[()+\s-]/g, '');
    if (normalizedPhone.length === 12 && normalizedPhone.startsWith('91')) normalizedPhone = normalizedPhone.slice(2);
    if (!normalizedPhone) return response.status(400).json({ error: 'Mobile number cannot be empty.' });
    if (!/^[6-9]\d{9}$/.test(normalizedPhone)) {
      return response.status(400).json({ error: 'Please provide a valid mobile number.' });
    }
    updates.phone = normalizedPhone;
  }

  if (!Object.keys(updates).length) {
    return response.status(400).json({ error: 'At least one profile field is required.' });
  }

  try {
    const user = await User.findByIdAndUpdate(request.user.id, updates, {
      new: true,
      runValidators: true,
    });

    await writeAuditLog({
      request,
      actorId: user.id,
      action: 'user.profile_updated',
      entityType: 'User',
      entityId: user.id,
      metadata: { changedFields: Object.keys(updates) },
    });
    return response.json({ user: publicProfile(user) });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({ error: 'An account with that email or phone already exists.' });
    }

    if (error.name === 'ValidationError') {
      return response.status(400).json({ error: 'Please provide valid profile details.' });
    }

    return response.status(500).json({ error: 'Unable to update profile.' });
  }
};

module.exports = { getProfile, updateProfile };
