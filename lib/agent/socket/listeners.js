const api = require('../control-panel/api');
const network = require('../providers/network');
const permissionFile = require('../../utils/permissionfile');
const { getInformationChannel, stringBooleanOrEmpty } = require('../utils/utilsprey');

const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
/**
 * Function to react to check location permissions by updating native and wifi location data.
 *
 * @param {Array} data - The data containing location information
 */
exports.callApi = (dataToSend) => api.push.event(dataToSend, { json: true });
exports.isWifiPermissionActive = (cb) => {
  network.isWifiPermissionActive((output) => {
    cb(output);
  });
};

exports.getDataFromPermissionFile = (dataToSet, data, cb) => {
  permissionFile.setData(dataToSet, data, () => {
    cb();
  });
};
const reactToCheckLocationPerms = (data) => {
  switch (osName) {
    case 'windows':
      exports.getDataFromPermissionFile('wifiLocation', stringBooleanOrEmpty(data[1].result), () => {

      });
      break;
    case 'mac':
      exports.getDataFromPermissionFile('nativeLocation', data[1].result, () => {
        exports.isWifiPermissionActive((output) => {
          exports.getDataFromPermissionFile('wifiLocation', stringBooleanOrEmpty(output), () => {
            // eslint-disable-next-line max-len
            const dataToSend = {
              name: 'list_permission',
              info: {
                wifi_location: output.toString(),
                native_location: data[1].result,
              },
            };
            exports.callApi(dataToSend);
            try {
              const callback = data[2];
              if (typeof callback === 'function') callback();
            } catch (errorCallback) {
              console.log(errorCallback);
            }
          });
        });
      });
      break;
    default:
      break;
  }
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

const getPictureMacSVC = (data) => {
  const dataObj = data[1];
  const callback = data[2];
  if (typeof callback === 'function') callback(null, dataObj);
};

const getScreenshotMacSVC = (data) => {
  const dataObj = data[1];
  const callback = data[2];
  if (typeof callback === 'function') callback(null, dataObj);
};

const getScreenshotAgentMacSVC = (data) => {
  const dataObj = data[1];
  const callback = data[2];
  if (typeof callback === 'function') callback(null, dataObj);
};

const reacToWatcher = (data) => {
  const callback = data[2];
  if (typeof callback === 'function') callback();
};

exports.reactToCheckLocationPerms = reactToCheckLocationPerms;
exports.reactToWdutil = reactToWdutil;
exports.getLocationMacSVC = getLocationMacSVC;
exports.getPictureMacSVC = getPictureMacSVC;
exports.getScreenshotMacSVC = getScreenshotMacSVC;
exports.getScreenshotAgentMacSVC = getScreenshotAgentMacSVC;
exports.reacToWatcher = reacToWatcher;
// exports.getDataFromPermissionFile = getDataFromPermissionFile;
// exports.isWifiPermissionActive = isWifiPermissionActive;
