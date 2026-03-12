'use strict';

/**
 * Validates a URL string. Only http:// and https:// are accepted.
 * Private/local addresses are rejected.
 * @param {string} urlStr
 * @returns {{ valid: boolean, error?: string, message?: string }}
 */
function validateUrl(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { valid: false, error: 'INVALID_URL', message: 'Ugyldig URL-format. URL-en må starte med http:// eller https://' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'INVALID_URL', message: 'Berre http:// og https:// er støtta.' };
  }
  const hostname = parsed.hostname.toLowerCase();
  const privatePatterns = [
    /^localhost$/,
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^::1$/,
    /^0\.0\.0\.0$/,
  ];
  if (privatePatterns.some(p => p.test(hostname))) {
    return { valid: false, error: 'PRIVATE_URL', message: 'Private eller lokale adresser er ikkje tillate.' };
  }
  return { valid: true };
}

module.exports = { validateUrl };
