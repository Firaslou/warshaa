export function normalizeCallablePhone(phone: string | null | undefined) {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!/^[+0-9().\s-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 15) return null;
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export function isValidContactPhone(phone: string | null | undefined) {
  return normalizeCallablePhone(phone) !== null;
}
