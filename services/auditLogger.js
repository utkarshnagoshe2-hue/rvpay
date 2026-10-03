const AuditLog = require('../models/AuditLog');

const writeAuditLog = async ({ request, actorId = null, action, entityType, entityId = null, metadata = {} }) => {
  try {
    await AuditLog.create({
      actor: actorId,
      action,
      entityType,
      entityId: entityId == null ? null : String(entityId),
      ip: request?.ip || null,
      userAgent: String(request?.get('user-agent') || '').slice(0, 500) || null,
      metadata,
    });
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
};

module.exports = writeAuditLog;
