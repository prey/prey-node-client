/// ///////////////////////////////////////
// Prey JS Network Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
/// ///////////////////////////////////////

// this provider provides relevant network info that by definition may change
// at any given moment (IP address, Wifi network, etc), so we should not
// use memoize on them, unlike the function from the hardware provider.

const network = require('network');

const os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
const osFunctions = require(`./${os_name}`);
const exp = module.exports;
const common = require('../../common');
const status = require('../../triggers/status');

const logger = common.logger.prefix('network');
const config = require('../../../utils/configfile');
const needle = require('needle');

let ap_list_callbacks = [];
let getting_ap_list = false;

/// //////////////////////////////////////////////////////////////
// getters
/// //////////////////////////////////////////////////////////////

exp.get_public_ip = network.get_public_ip;

exp.get_private_ip = network.get_private_ip;

exp.get_gateway_ip = network.get_gateway_ip;

// For macOS Catalina cmd output changed
if (os_name == 'mac' && common.os_release >= '10.15') { exp.get_active_network_interface = osFunctions.get_active_interface; } else { exp.get_active_network_interface = network.get_active_interface; }

/// //////////////////////////////////////////////////////////////
// wifi getters
/// //////////////////////////////////////////////////////////////

/**
 * Callsback an array of wireless interface names
 * */
exp.get_wireless_interfaces_list = osFunctions.get_wireless_interfaces_list;

exp.get_active_access_point_mac = osFunctions.get_active_access_point_mac;

exp.isWifiPermissionActive = osFunctions.isWifiPermissionActive;

/**
 *
 * */
exp.get_access_points_list = function (callback) {
  if (callback) ap_list_callbacks.push(callback);
  if (getting_ap_list) return;

  const done = function (err, list) {
    if (ap_list_callbacks.length >= 1) {
      fire_callbacks(err, list);
    }
    getting_ap_list = false;
  };

  var fire_callbacks = function (err, list) {
    const callbacks_list = ap_list_callbacks;
    ap_list_callbacks = [];
    callbacks_list.forEach((fn) => {
      fn(err, list);
    });
  };

  getting_ap_list = true;
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

exp.get_active_access_point_name = function (callback) {
  exp.get_active_access_point((err, ap) => {
    if (err || !ap || !ap.ssid || ap.ssid.trim() == '') { return callback(err || new Error('No active access point found.')); }

    callback(null, ap.ssid);
  });
};

/**
 * Callback an array of open access points, sorted by signal strength.
 * If none exist, return the empty array.
 * */
exp.get_open_access_points_list = function (callback) {
  exp.get_access_points_list((err, list) => {
    if (err || !list) { return callback(err || new Error('No access points detected.')); }

    const open_aps = list.filter((ap) => ap.security == false || ap.security == null);

    if (open_aps.length === 0) { return callback(null, []); }

    callback(null, open_aps);
  });
};

exp.get_connection_status = function (cb) {
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

  connect(protocol, host, opts, return_status);
  function return_status(err, res) {
    function disconnected(err) {
      logger.debug('Device cannot connect to host');
      if (err) {
        logger.error(`Connection error: ${err}`);
      }
      return cb('disconnected');
    }
    if (err) {
      if (opts.proxy) {
        logger.debug('Getting connection status without proxy');
        delete opts.proxy;
        return connect(protocol, host, opts, return_status);
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
      connect('https', 'www.google.com', opts, (err, res) => {
        if (err || !res || !res.statusCode || res.statusCode != 200) {
          disconnected();
        } else {
          return cb('connected');
        }
      });
    }
  }
};
