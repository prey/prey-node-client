/**
 * Sanitize HTTP header value to comply with RFC 7230
 * Removes characters that are not VCHAR (0x21-0x7E), SP (0x20), or HTAB (0x09)
 * @param {string} value - The header value to sanitize
 * @returns {string} Sanitized header value with invalid characters removed
 */
exports.sanitizeHeaderValue = (value) => {
  if (typeof value !== 'string') return '';

  // RFC 7230: header field values must only contain VCHAR (0x21-0x7E), SP (0x20), and HTAB (0x09)
  // Newlines, control characters, and non-ASCII characters are not allowed
  return value
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      // Allow: VCHAR (0x21-0x7E), SP (0x20), HTAB (0x09)
      return (code >= 0x21 && code <= 0x7E) || code === 0x20 || code === 0x09;
    })
    .join('');
};
