const SENSITIVE_ENV_KEY = /(TOKEN|KEY|SECRET|PASSWORD|AUTH|SESSION)/i;

export function sanitizeMessage(value: unknown, env: NodeJS.ProcessEnv = process.env): string {
  const text = value instanceof Error ? value.message : String(value ?? "알 수 없는 오류");
  let sanitized = text
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[redacted-api-key]")
    .replace(/(api[_-]?key|token|secret|password|authorization)\s*[:=]\s*["']?[^"',\s]+/gi, "$1=[redacted]")
    .replace(/C:\\Users\\[^\\\s]+/gi, "C:\\Users\\[redacted]")
    .replace(/\/Users\/[^/\s]+/g, "/Users/[redacted]");

  for (const [key, envValue] of Object.entries(env)) {
    if (!SENSITIVE_ENV_KEY.test(key) || !envValue || envValue.length < 8) {
      continue;
    }
    sanitized = sanitized.split(envValue).join("[redacted-env]");
  }

  return sanitized.replace(/\s+/g, " ").trim().slice(0, 300) || "알 수 없는 오류";
}
