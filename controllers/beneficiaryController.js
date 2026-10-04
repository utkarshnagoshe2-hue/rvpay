const mongoose = require('mongoose');
const Beneficiary = require('../models/Beneficiary');
const writeAuditLog = require('../services/auditLogger');

const toClientBeneficiary = (beneficiary) => ({
  id: String(beneficiary._id),
  name: beneficiary.name,
  destination: beneficiary.destination,
  createdAt: beneficiary.createdAt,
});

const parseBeneficiary = (input = {}) => {
  const body = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const name = String(body.name || '').trim();
  const rawDestination = String(body.destination || '').trim();
  const phoneDigits = rawDestination.replace(/[()+\s-]/g, '');
  const normalizedPhone = phoneDigits.length === 12 && phoneDigits.startsWith('91')
    ? phoneDigits.slice(2)
    : phoneDigits;

  if (!name || name.length > 120) return { error: 'Name is required and must be at most 120 characters.' };
  if (/^[6-9]\d{9}$/.test(normalizedPhone)) {
    return { values: { name, destination: normalizedPhone } };
  }

  const destination = rawDestination.toLowerCase();
  const isUpiId = destination.length <= 200
    && /^[a-z0-9][a-z0-9._-]{1,100}@[a-z0-9][a-z0-9.-]{1,90}$/.test(destination);
  if (!isUpiId) return { error: 'Enter a valid mobile number or UPI ID.' };
  return { values: { name, destination } };
};

const getBeneficiaries = async (request, response) => {
  try {
    const beneficiaries = await Beneficiary.find({ user: request.user.id }).sort({ name: 1, createdAt: -1 });
    return response.json({ beneficiaries: beneficiaries.map(toClientBeneficiary) });
  } catch (error) {
    return response.status(500).json({ error: 'Unable to load beneficiaries.' });
  }
};

const createBeneficiary = async (request, response) => {
  const { values, error } = parseBeneficiary(request.body);
  if (error) return response.status(400).json({ error });

  try {
    const beneficiary = await Beneficiary.create({ user: request.user.id, ...values });
    await writeAuditLog({
      request,
      actorId: request.user.id,
      action: 'beneficiary.created',
      entityType: 'Beneficiary',
      entityId: beneficiary.id,
    });
    return response.status(201).json({ beneficiary: toClientBeneficiary(beneficiary) });
  } catch (createError) {
    if (createError.code === 11000) return response.status(409).json({ error: 'This destination is already saved.' });
    if (createError.name === 'ValidationError') return response.status(400).json({ error: 'Please provide valid beneficiary details.' });
    return response.status(500).json({ error: 'Unable to add beneficiary.' });
  }
};

const updateBeneficiary = async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ error: 'Invalid beneficiary ID.' });
  const { values, error } = parseBeneficiary(request.body);
  if (error) return response.status(400).json({ error });

  try {
    const beneficiary = await Beneficiary.findOneAndUpdate(
      { _id: request.params.id, user: request.user.id },
      { $set: values },
      { new: true, runValidators: true },
    );
    if (!beneficiary) return response.status(404).json({ error: 'Beneficiary not found.' });
    await writeAuditLog({
      request,
      actorId: request.user.id,
      action: 'beneficiary.updated',
      entityType: 'Beneficiary',
      entityId: beneficiary.id,
      metadata: { changedFields: Object.keys(values) },
    });
    return response.json({ beneficiary: toClientBeneficiary(beneficiary) });
  } catch (error) {
    if (error.code === 11000) return response.status(409).json({ error: 'This destination is already saved.' });
    if (error.name === 'ValidationError') return response.status(400).json({ error: 'Please provide valid beneficiary details.' });
    return response.status(500).json({ error: 'Unable to update beneficiary.' });
  }
};

const deleteBeneficiary = async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) return response.status(400).json({ error: 'Invalid beneficiary ID.' });

  try {
    const result = await Beneficiary.deleteOne({ _id: request.params.id, user: request.user.id });
    if (!result.deletedCount) return response.status(404).json({ error: 'Beneficiary not found.' });
    await writeAuditLog({
      request,
      actorId: request.user.id,
      action: 'beneficiary.deleted',
      entityType: 'Beneficiary',
      entityId: request.params.id,
    });
    return response.status(204).end();
  } catch (error) {
    return response.status(500).json({ error: 'Unable to delete beneficiary.' });
  }
};

module.exports = { createBeneficiary, deleteBeneficiary, getBeneficiaries, updateBeneficiary };