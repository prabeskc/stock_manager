export function computeBackoffMs({
  attempt,
  baseMs,
  maxMs,
  retryAfterSeconds,
}: {
  attempt: number
  baseMs: number
  maxMs: number
  retryAfterSeconds?: number | null
}): number {
  if (retryAfterSeconds != null && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.max(0, Math.min(maxMs, Math.round(retryAfterSeconds * 1000)))
  }

  const safeAttempt = Math.max(0, Math.min(20, Math.floor(attempt)))
  const exp = Math.min(maxMs, baseMs * Math.pow(2, safeAttempt))
  const jitter = exp * (0.2 * Math.random())
  return Math.round(Math.min(maxMs, exp + jitter))
}

