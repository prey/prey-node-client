// @ts-check

/**
 * Normalizes a needle response body into an object.
 * With { json: true }, needle auto-parses JSON responses and hands back an
 * already-parsed object; on other content types it returns the raw string.
 * Parsing an object with JSON.parse throws, so only parse when it's a string.
 * @param {any} bodyResp
 * @returns {any} the parsed object (throws if a string cannot be parsed)
 */
exports.parseNeedleBody = (bodyResp) => {
  if (bodyResp && typeof bodyResp === 'object') return bodyResp;
  return JSON.parse(bodyResp);
};
