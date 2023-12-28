const { join } = require('path');

const base_path = join(__dirname, '..', '..');
const hooks = require(join(base_path, 'hooks'));
const network = require(join(base_path, 'providers', 'network'));
const reconnect = require('./reconnect');
const common = require('../../common');

const os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
const config = require('../../../utils/configfile');

const logger = common.logger.prefix('auto-connect');
const Emitter = require('events').EventEmitter;

let emitter;
let reconnect_time = 30000;
let was_disconnected = false;
timer = null;

let connected = false;

const restart_reconnection = function () {
  stop_waiting();
  reconnect_time = 1000 * 60 * 3; // Three minutes
  wait_normal_reconnection();
};

const check_err = function (err) {
  logger.info(err);
  if (err.message.includes('Already connected')) {
    logger.info(`${err.message}. Autoconnect disengaged for now :)`);
    stop_waiting();
  } else restart_reconnection();
};

var wait_normal_reconnection = function () {
  logger.info('Device disconnected! Waiting for reconnection...');
  reconnect.enable_wifi(() => {
    timer = setTimeout(() => {
      logger.info("Nothing happened, let's try connecting to the nearest access points...");
      reconnect.get_open_ap_list((err, list) => {
        if (err) return check_err(err);
        reconnect.try_connecting_to(list, (err, stdout) => {
          if (err) return check_err(err);
          return wait_normal_reconnection();
        });
      });
    }, reconnect_time);
  });
};

var stop_waiting = function () {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
};

exports.start = function (opts, cb) {
  hooks.on('connected', () => {
    network.get_active_access_point((err, ap) => {
      if (was_disconnected) {
        logger.info(`Connection achieved! ${ap ? ap.ssid || '' : ''}`);
        was_disconnected = false;
      }
      connected = ap;
      reconnect.connected(ap);
    });
    stop_waiting();
  });

  hooks.on('disconnected', () => {
    was_disconnected = true;
    connected = false;
    if (config.get('auto_connect') && os_name != 'linux') {
      reconnect.connected(null);
      wait_normal_reconnection();
    }
  });

  emitter = new Emitter();
  cb(null, emitter);
};

exports.stop = function () {
  hooks.remove('connected');
  hooks.remove('disconnected');

  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.events = [];
