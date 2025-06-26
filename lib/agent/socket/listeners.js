const api = require('../control-panel/api');
const controlPanel = require('../control-panel');
const network = require('../providers/network');
const permissionFile = require('../../utils/permissionfile');
const config = require('../../utils/configfile');
const { getInformationChannel, stringBooleanOrEmpty } = require('../utils/utilsprey');

exports.osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
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

exports.setDataToPermissionFile = (dataToSet, data, cb) => {
  permissionFile.setData(dataToSet, data, () => {
    cb();
  });
};

const sendDataToEndpoint = (shouldSend, wifiLocationPermission, nativeLocationPermission, cb) => {
  // eslint-disable-next-line max-len
  const dataToSend = {
    name: 'list_permission',
    info: {
      wifi_location: wifiLocationPermission,
      native_location: nativeLocationPermission,
    },
  };
  if (shouldSend) {
    exports.callApi(dataToSend);
    // Sync config with control panel
    setTimeout(() => {
      controlPanel.sync(false)
    }, 2000)
  }
  try {
    const callback = cb;
    if (typeof callback === 'function') callback();
  } catch (errorCallback) {
    console.log(errorCallback);
  }
};

const shouldSendCallApiWindows = (dataWifiLocationConf, data) => dataWifiLocationConf.localeCompare('') === 0
  || (dataWifiLocationConf.localeCompare('false') === 0 && data[1].localeCompare('Allow') === 0)
  || (dataWifiLocationConf.localeCompare('true') === 0 && data[1].localeCompare('Allow') !== 0);

const reactToCheckLocationPerms = (data) => {
  let shouldSend = false;
  const dataNativeLocationConf = config.getData('control-panel.permissions.native_location');
  const dataWifiLocationConf = config.getData('control-panel.permissions.wifi_location');

  let dataNativeToCompare = dataNativeLocationConf;
  let dataWifiToCompare = dataWifiLocationConf;

  // In case the config data is empty
  if (!dataNativeLocationConf || !dataWifiLocationConf) {
    const dataNativeLocationBefore = permissionFile.getData('nativeLocation');
    const dataWifiLocationBefore = permissionFile.getData('wifiLocation');
    dataNativeToCompare = dataNativeLocationBefore;
    dataWifiToCompare = dataWifiLocationBefore;
  }
  let wifiLocationPermission = 'false';
  switch (exports.osName) {
    case 'windows':
      try {
        if (shouldSendCallApiWindows(dataWifiToCompare, data)) shouldSend = true;
        if (data[1].localeCompare('Allow') === 0) wifiLocationPermission = 'true';
        exports.setDataToPermissionFile('wifiLocation', wifiLocationPermission, () => {
          sendDataToEndpoint(shouldSend, wifiLocationPermission, 'false', () => {});
        });
      } catch (error) {
        console.log(error);
      }
      break;
    case 'mac':
      exports.setDataToPermissionFile('nativeLocation', data[1].result, () => {
        if (dataNativeToCompare.localeCompare(data[1].result) !== 0) shouldSend = true;
        exports.isWifiPermissionActive((output) => {
          if (dataWifiToCompare.localeCompare(output) !== 0) shouldSend = true;
          exports.setDataToPermissionFile('wifiLocation', stringBooleanOrEmpty(output), () => {
            sendDataToEndpoint(shouldSend, output.toString(), data[1].result, data[2]);
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
