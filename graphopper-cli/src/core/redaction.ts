const secretPatterns = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/giu,
  /([?&](?:token|code|signature|credential)=[^&\s]+)/giu,
  /\b(?:access|refresh|id)_token\b\s*[:=]\s*[^\s,}]+/giu,
];

export function redact(value: string): string {
  return secretPatterns.reduce(
    (result, pattern) => result.replace(pattern, '[REDACTED]'),
    value,
  );
}
