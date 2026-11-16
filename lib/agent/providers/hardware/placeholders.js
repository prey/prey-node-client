// @ts-check

// Values that mean "the read failed or came back empty", not a hardware attribute.
// systeminformation never rejects: when WMI/dmidecode does not answer it resolves
// '' (or '-' for the system serial). Firmware filler strings such as "Default string"
// or "To be filled by O.E.M." are NOT listed here on purpose: they are stable values
// the firmware really reports, so the agent sends them as read and the panel decides
// whether a transition involving them is a hardware change.
const MISSING = ['', '-'];

/**
 * True when the value carries no data because the read failed or came back empty:
 * null/undefined, an empty string or '-'. Booleans, numbers, objects and arrays are
 * real values.
 * @param {*} value
 * @returns {boolean}
 */
const isMissing = (value) => {
  if (value === null || typeof value === 'undefined') return true;
  if (typeof value !== 'string') return false;
  return MISSING.includes(value.trim());
};

module.exports = { isMissing };
