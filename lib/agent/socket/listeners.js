const api = require('../control-panel/api');
const network = require('../providers/network');
const permissionFile = require('../../utils/permissionfile');

const logger = require('../common').logger.prefix('listener');

const reactToCheckLocationPerms = (data) => {
  logger.info(JSON.stringify(data));
  permissionFile.setData('nativeLocation', data[1].result, () => {
    network.isWifiPermissionActive((output) => {
      permissionFile.setData('wifiLocation', output.toString(), () => {
        // eslint-disable-next-line max-len
        api.push.event({ wifi_location: output.toString(), native_location: data[1].result }, { json: true });
      });
    });
  });
};

const reactToWdutil = (data) => {
  console.log('[][][][][][][][][][][][][][][][][][][]');
  console.log('-------------------------------------');
  const dataObj = data[1];
  const callback = data[2];
  const ap = {
    ssid: dataObj.wdutil.WIFI.SSID,
    mac_address: dataObj.wdutil.WIFI['MAC Address'],
    signal_strength: 10, //dataObj.wdutil.RSSI,
    channel: 10, //dataObj.wdutil.Channel,
    security: dataObj.wdutil.WIFI.Security,
  };
  console.log(`AP IS: ${JSON.stringify(ap)}`);
  callback(null, ap);
};

exports.reactToCheckLocationPerms = reactToCheckLocationPerms;
exports.reactToWdutil = reactToWdutil;
