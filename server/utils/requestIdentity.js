const GUEST_PREFIX = "guest_";

export function resolveRequestIdentity(req, payload = {}) {
  if (req.user && req.user._id) {
    return {
      userId: req.user._id,
      isGuest: false,
      isAuthenticated: true,
    };
  }

  const rawUserId = String(payload.userId || "").trim();
  if (!rawUserId || !rawUserId.startsWith(GUEST_PREFIX)) {
    return {
      error: {
        status: 400,
        code: "GUEST_ID_REQUIRED",
        message: "Guest userId is required",
      },
    };
  }

  return {
    userId: rawUserId,
    isGuest: true,
    isAuthenticated: false,
  };
}

export function resolveMode(value) {
  return value === "private" ? "private" : "save";
}
