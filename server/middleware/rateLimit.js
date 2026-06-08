const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX || 60);

const buckets = new Map();

function buildBucket() {
  return { count: 0, resetAt: Date.now() + WINDOW_MS };
}

export function rateLimit(req, res, next) {
  const key = `${req.ip}:${req.baseUrl || req.path}`;
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    bucket = buildBucket();
    buckets.set(key, bucket);
  }

  if (bucket.count >= MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: "Too many requests. Please try again shortly.",
      error: "RATE_LIMITED",
    });
  }

  bucket.count += 1;
  const remaining = Math.max(0, MAX_REQUESTS - bucket.count);

  res.setHeader("X-RateLimit-Limit", String(MAX_REQUESTS));
  res.setHeader("X-RateLimit-Remaining", String(remaining));
  res.setHeader("X-RateLimit-Reset", String(Math.floor(bucket.resetAt / 1000)));

  return next();
}
