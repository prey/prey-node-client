// @ts-check

// Values that mean "no data" rather than a real hardware attribute. They come from
// failed or empty WMI/dmidecode reads (systeminformation resolves '' or '-') and from
// OEM firmware that never filled the field. Compared lowercase and trimmed.
const PLACEHOLDERS = [
  '',
  '-',
  'na',
  'n/a',
  'none',
  'null',
  'undefined',
  'unknown',
  'default string',
  'to be filled by o.e.m.',
  'system serial number',
];

/**
 * True when the value carries no hardware information: null/undefined or a
 * placeholder string. Booleans, numbers, objects and arrays are real values.
 * @param {*} value
 * @returns {boolean}
 */
const isPlaceholder = (value) => {
  if (value === null || typeof value === 'undefined') return true;
  if (typeof value !== 'string') return false;
  return PLACEHOLDERS.includes(value.trim().toLowerCase());
};

module.exports = { isPlaceholder };
