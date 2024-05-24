const api = require('../control-panel/api');
const network = require('../providers/network');
const permissionFile = require('../../utils/permissionfile');
const { getInformationChannel, stringBooleanOrEmpty } = require('../utils/utilsprey');
/**
 * Function to react to check location permissions by updating native and wifi location data.
 *
 * @param {Array} data - The data containing location information
 */
const reactToCheckLocationPerms = (data) => {
  permissionFile.setData('nativeLocation', data[1].result, () => {
    network.isWifiPermissionActive((output) => {
      permissionFile.setData('wifiLocation', stringBooleanOrEmpty(output), () => {
        // eslint-disable-next-line max-len
        const dataToSend = {
          name: 'list_permission',
          info: {
            wifi_location: output.toString(),
            native_location: data[1].result,
          },
        };
        api.push.event(dataToSend, { json: true });
        try {
          const callback = data[2];
          if (typeof callback === 'function') callback();
        } catch (errorCallback) {
          console.log(errorCallback);
        }
      });
    });
  });
};
/**
 * Process data to extract WiFi information and callback with the result.
 *
 * @param {Array} data - The data array containing WiFi information
 * @return {void}
 */
const reactToWdutil = (data) => {
  const dataObj = data[1];
  const callback = data[2];
  const regex = /-?\d+/g;
  const matches = dataObj.wdutil.WIFI.RSSI.match(regex);
  const RSSI = matches[0];
  const ap = {
    ssid: dataObj.wdutil.WIFI.SSID,
    mac_address: dataObj.wdutil.WIFI['MAC Address'],
    signal_strength: parseInt(RSSI, 10),
    channel: parseInt(getInformationChannel(dataObj.wdutil.WIFI.Channel), 10),
    security: dataObj.wdutil.WIFI.Security,
  };
  if (typeof callback === 'function') callback(null, ap);
};

const getLocationMacSVC = (data) => {
  const dataObj = data[1];
  const callback = data[2];
  if (typeof callback === 'function') callback(null, dataObj);
};

exports.reactToCheckLocationPerms = reactToCheckLocationPerms;
exports.reactToWdutil = reactToWdutil;
exports.getLocationMacSVC = getLocationMacSVC;
