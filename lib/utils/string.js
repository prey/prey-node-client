// @ts-check

/**
 * Replaces all characters outside [A-Za-z0-9 ] with underscores and trims
 * whitespace. Shared sanitizer used across system modules.
 *
 * @param {string} str
 * @returns {string}
 */
exports.cleanString = (str) => str.replace(/[^A-Za-z0-9\s]/g, '_').trim();
