const LIMITS = {
  chat: 3,
  analysis: 1,
  fir: 1,
};

const GUEST_TTL_MS = 24 * 60 * 60 * 1000;
const guestUsage = new Map();

function buildEmptyRecord() {
  return { chat: 0, analysis: 0, fir: 0, updatedAt: Date.now() };
}

function getUsageRecord(userId) {
  const now = Date.now();
  const existing = guestUsage.get(userId);

  if (!existing) {
    const fresh = buildEmptyRecord();
    guestUsage.set(userId, fresh);
    return fresh;
  }

  if (now - existing.updatedAt > GUEST_TTL_MS) {
    const refreshed = buildEmptyRecord();
    guestUsage.set(userId, refreshed);
    return refreshed;
  }

  return existing;
}

export function checkAndIncrementGuestUsage(userId, type) {
  const record = getUsageRecord(userId);
  const limit = LIMITS[type] ?? 0;

  if (record[type] >= limit) {
    return { allowed: false, limit, remaining: 0 };
  }

  record[type] += 1;
  record.updatedAt = Date.now();

  return { allowed: true, limit, remaining: Math.max(0, limit - record[type]) };
}
