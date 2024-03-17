const storage = require('../agent/utils/storage');
/**
 * Retrieves data from the database based on the specified key.
 *
 * @param {string} whatToGet - The key to search for in the database
 * @param {Function} callback - The callback function to handle the retrieved data or errors
 * @return {void}
 */
const getDataDbKey = (whatToGet, callback) => {
  try {
    storage.do('query', { type: 'keys', column: 'id', data: whatToGet }, (err, stored) => {
      if (err) {
        return callback(err, null);
      }
      if (stored && stored.length > 0) {
        return callback(null, stored);
      }
      return callback(null, null);
    });
  } catch (e) {
    callback(e, null);
  }
};
/**
 * Sets the value of a key in the storage.
 *
 * @param {string} whatToGet - the key to set the value for
 * @param {any} valuetoSet - the value to set for the key
 * @param {function} cb - the callback function to be called after the value is set
 * @return {void}
 */
const setKey = (whatToGet, valuetoSet, cb) => {
  storage.do(
    'set',
    { type: 'keys', id: whatToGet, data: { value: JSON.stringify(valuetoSet) } },
    () => { cb(); },
  );
};
/**
 * Sets the value of a key in the storage.
 *
 * @param {string} whatToGet - the key to set the value for
 * @param {any} valuetoSet - the value to set for the key
 * @param {function} cb - the callback function to be called after the value is set
 * @return {void}
 */
const updateKey = (whatToGet, valuetoSet, cb) => {
  storage.do('update', {
    type: 'keys', id: whatToGet, columns: 'value', values: JSON.stringify(valuetoSet),
  }, () => { cb(); });
};
/**
 * Save a value to the database based on a key, either updating
 * an existing key or setting a new key.
 *
 * @param {string} whatToGet - the key to retrieve from the database
 * @param {any} valuetoSet - the value to set or update in the database
 * @param {function} cb - a callback function to handle the result of the database operation
 * @return {void}
 */
const saveToDbKey = (whatToGet, valuetoSet, cb) => {
  getDataDbKey(whatToGet, (err, stored) => {
    if (err) return;
    if (stored) {
      updateKey(whatToGet, valuetoSet, cb);
    } else {
      setKey(whatToGet, valuetoSet, cb);
    }
  });
};

exports.setKey = setKey;
exports.updateKey = updateKey;
exports.saveToDbKey = saveToDbKey;
exports.getDataDbKey = getDataDbKey;
