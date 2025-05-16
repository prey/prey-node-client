/* eslint-disable consistent-return */
/* eslint-disable global-require */
// this provider provides relevant network info that by definition may change
// at any given moment (IP address, Wifi network, etc), so we should not
// use memoize on them, unlike the function from the hardware provider.

const network = require('network');
const needle = require('needle');
const common = require('../../common');
const status = require('../../triggers/status');

const logger = common.logger.prefix('network');
const config = require('../../../utils/configfile');

let apListCallbacks = [];
let gettingApList = false;
const exp = module.exports;

const osName = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
let osFunctions;
switch (osName) {
  case 'mac':
    osFunctions = require('./mac');
    break;
  case 'windows':
    osFunctions = require('./windows');
    break;
  case 'linux':
    osFunctions = require('./linux');
    break;
  default:
    throw new Error(`Unsupported OS: ${osName}`);
}

/// //////////////////////////////////////////////////////////////
// getters
/// //////////////////////////////////////////////////////////////

try {
  exp.get_public_ip = network.get_public_ip;
} catch (error) {
  exp.get_public_ip = (options, cb) => cb(new Error(`Failed to retrieve public IP: ${error}`));
}

try {
  exp.get_private_ip = network.get_private_ip;
} catch (error) {
  exp.get_private_ip = (cb) => cb(new Error(`Failed to retrieve private IP: ${error}`));
}

try {
  exp.get_gateway_ip = network.get_gateway_ip;
} catch (error) {
  exp.get_gateway_ip = (cb) => cb(new Error(`Failed to retrieve gateway IP: ${error}`));
}

// For macOS Catalina cmd output changed
try {
  if (osName === 'mac' && common.os_release >= '10.15') {
    exp.get_active_network_interface = osFunctions.get_active_interface;
  } else {
    exp.get_active_network_interface = network.get_active_interface;
  }
} catch (errorNic) {
  exp.get_active_network_interface = (cb) => cb(new Error(`Failed to retrieve network interface: ${errorNic}`));
}

/// //////////////////////////////////////////////////////////////
// wifi getters
/// //////////////////////////////////////////////////////////////

/**
 * Callsback an array of wireless interface names
 * */
try {
  exp.get_wireless_interfaces_list = osFunctions.get_wireless_interfaces_list;
} catch (error) {
  exp.get_wireless_interfaces_list = () => { throw new Error(`Error in get_wireless_interfaces_list: ${error}`); };
}

try {
  exp.get_active_access_point_mac = osFunctions.get_active_access_point_mac;
} catch (error) {
  exp.get_active_access_point_mac = () => { throw new Error(`Error in get_active_access_point_mac: ${error}`); };
}

try {
  exp.isWifiPermissionActive = osFunctions.isWifiPermissionActive;
} catch (error) {
  exp.isWifiPermissionActive = () => { throw new Error(`Error in isWifiPermissionActive: ${error}`); };
}

exp.get_access_points_list = (callback) => {
  const fireCallbacks = (err, list) => {
    const callbacksList = apListCallbacks;
    apListCallbacks = [];
    callbacksList.forEach((fn) => {
      fn(err, list);
    });
  };

  if (callback) apListCallbacks.push(callback);
  if (gettingApList) return;

  const done = (err, list) => {
    if (apListCallbacks.length >= 1) {
      fireCallbacks(err, list);
    }
    gettingApList = false;
  };

  gettingApList = true;
  osFunctions.get_access_points_list((err, list) => {
    if (err || !list) { return done(err || new Error('No access points found.')); }

    // sort them from the nearest to the farthest
    list.sort((a, b) => b.signal_strength - a.signal_strength);

    return done(null, list);
  });
};

/**
 * Callsback an AP object of the one that the device is connected to.
 * For now on we're not consulting the entire AP list to get the active AP.
 * (except for linux because there's not other way)
 * */
exp.get_active_access_point = (callback) => {
  osFunctions.get_active_access_point((err, stdout) => {
    if (err) {
      status.set_status('active_access_point', null);
      // Don't need to fill the log with AP errors
      return callback();
    }
    // Update network status
    status.set_status('active_access_point', stdout);
    return callback(null, stdout);
  });
};

exp.get_active_access_point_name = (callback) => {
  exp.get_active_access_point((err, ap) => {
    if (err || !ap || !ap.ssid || ap.ssid.trim() === '') { return callback(err || new Error('No active access point found.')); }
    callback(null, ap.ssid);
  });
};

/**
 * Callback an array of open access points, sorted by signal strength.
 * If none exist, return the empty array.
 * */
exp.get_open_access_points_list = (callback) => {
  exp.get_access_points_list((err, list) => {
    if (err || !list) { return callback(err || new Error('No access points detected.')); }

    const openAps = list.filter((ap) => ap.security === false || ap.security == null);
    if (openAps.length === 0) { return callback(null, []); }
    callback(null, openAps);
  });
};

exp.get_connection_status = (cb) => {
  const data = config.all();
  const configData = data;
  const proxy = configData.try_proxy;
  const protocol = configData['control-panel.protocol'];
  const host = configData['control-panel.host'];
  const opts = {};

  if (proxy) opts.proxy = proxy;

  logger.debug('Getting connection status');

  function connect(protocolConnect, hostConnect, optsConnect, callback) {
    needle.get(`${protocolConnect}://${hostConnect}`, optsConnect, callback);
  }

  const returnStatus = (err, res) => {
    const disconnected = (errDisconnected) => {
      logger.debug('Device cannot connect to host');
      if (errDisconnected) {
        logger.error(`Connection error: ${errDisconnected}`);
      }
      return cb('disconnected');
    };
    if (err) {
      if (opts.proxy) {
        logger.debug('Getting connection status without proxy');
        delete opts.proxy;
        return connect(protocol, host, opts, returnStatus);
      }
      disconnected(err);
    }

    if (res && res.statusCode) {
    // 301 and 302 codes are in case the server redirects regular requests,
    // but is still able to receive connections
      const statusCodes = [200, 301, 302];
      if (statusCodes.indexOf(res.statusCode) !== -1) {
        return cb('connected');
      }
      logger.info('Checking with google host');
      connect('https', 'www.google.com', opts, (errConnect, resConnect) => {
        if (errConnect || !resConnect || !resConnect.statusCode || resConnect.statusCode !== 200) {
          disconnected();
        } else {
          return cb('connected');
        }
      });
    }
  };
  connect(protocol, host, opts, returnStatus);
};
