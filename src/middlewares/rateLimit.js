// ── IN-MEMORY RATE LIMITER MIDDLEWARE ──
const requestCounts = new Map();

function rateLimit({ windowMs = 15 * 60 * 1000, max = 10, message = 'Muitas tentativas. Tente novamente em alguns minutos.' } = {}) {
  // Limpeza periódica
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of requestCounts.entries()) {
      if (now - record.startTime > windowMs) {
        requestCounts.delete(key);
      }
    }
  }, windowMs);

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
    const key = `${req.path}_${ip}`;
    const now = Date.now();

    let record = requestCounts.get(key);
    if (!record || (now - record.startTime > windowMs)) {
      record = { count: 1, startTime: now };
      requestCounts.set(key, record);
      return next();
    }

    record.count++;
    if (record.count > max) {
      return res.status(429).json({
        error: message,
        retryAfterMs: windowMs - (now - record.startTime)
      });
    }

    next();
  };
}

module.exports = { rateLimit };
