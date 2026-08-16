const WEB_PROTOCOLS = new Set(["http:", "https:"]);
const MEDIA_PROTOCOLS = new Set(["http:", "https:", "blob:"]);

function parseUrl(value: string | null | undefined, protocols: Set<string>, assumeHttps: boolean) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const candidate = assumeHttps && !/^[a-z][a-z\d+.-]*:/i.test(trimmed)
      ? `https://${trimmed}`
      : trimmed;
    const parsed = new URL(candidate);
    return protocols.has(parsed.protocol) ? parsed.href : null;
  } catch {
    return null;
  }
}

/** Only permits ordinary web links. Blocks javascript:, data:, file:, and malformed URLs. */
export function safeExternalUrl(value: string | null | undefined) {
  return parseUrl(value, WEB_PROTOCOLS, true);
}

/** Permits web URLs and browser-created blob previews, but never executable URL schemes. */
export function safeMediaUrl(value: string | null | undefined) {
  return parseUrl(value, MEDIA_PROTOCOLS, false);
}
