const plist = require('plist');
const sudoer = require('sudoer');

const searchTerm = 'com.preypatchmojave';


/**
 * Get the location permission from the provided XML data and
 * invoke the callback with the permission object.
 *
 * @param {string} xmlDataStr - The XML data string to parse
 * @param {function} cb - The callback function to invoke with the permission object
 * @return {void}
 */
// eslint-disable-next-line consistent-return
const extractPermissions = (xmlDataStr, cb) => {
  const permission = { exists: false, value: null };
  try {
    const xmlLocationPlist = plist.parse(xmlDataStr);
    let searchedData;
    // eslint-disable-next-line no-restricted-syntax
    for (const key in xmlLocationPlist) {
      if (key.includes(searchTerm)) {
        searchedData = xmlLocationPlist[key];
      }
    }
    if (!searchedData) return cb(null, permission);

    permission.exists = true;
    permission.value = searchedData.Authorized || false;
    cb(null, permission);
  } catch (error) {
    cb(error, permission);
  }
};
/**
 * Generates location permission by copying clients.plist file,
 * converting it to xml1 format, and extracting permissions.
 *
 * @param {function} cb - Callback function to handle errors or return location permissions.
 * @return {void}
 */
const getLocationPermission = (cb) => {
  sudoer('/bin/cp', ['/var/db/locationd/clients.plist', '/tmp/clients.plist'], (errorCopy) => {
    if (errorCopy) return cb(errorCopy);
    sudoer('plutil', ['-convert', 'xml1', '/tmp/clients.plist'], (errorPlutil) => {
      if (errorPlutil) return cb(errorPlutil);
      sudoer('/bin/cat', ['/tmp/clients.plist'], (errorCat, outCat) => {
        extractPermissions(outCat, cb);
      });
    });
  });
};

exports.getLocationPermission = getLocationPermission;
