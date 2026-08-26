// @ts-check

/**
 * Returns true when `schedule` is a non-null, non-empty plain object.
 *
 * @param {unknown} schedule
 * @returns {boolean}
 */
exports.isValidSchedule = (schedule) => (
  schedule !== null
  && schedule !== undefined
  && typeof schedule === 'object'
  && !Array.isArray(schedule)
  && Object.keys(/** @type {object} */ (schedule)).length > 0
);
