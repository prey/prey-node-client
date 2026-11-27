// @ts-check
const { getDataDbKey, saveToDbKey, setKey } = require('./configutil');
const common = require('../agent/common');

const logger = common.logger.prefix('permissionfile');

const keyValue = 'permissions';

// Callers (listeners.js, geo/index.js, request_permission/index.js) treat
// permission values as strings via .localeCompare(); coerce booleans so a
// raw boolean written by any source (past or present) never reaches them.
const toPermissionString = (value) => (typeof value === 'boolean' ? value.toString() : value);

class PermissionData {
  /** @type {any} singleton, set once load() finishes */
  static instance;

  permissionData = {
    nativeLocation: '',
    wifiLocation: '',
  };

  constructor() {
    // eslint-disable-next-line no-constructor-return
    if (PermissionData.instance instanceof PermissionData) return PermissionData.instance;
    this.load(() => {
      PermissionData.instance = this;
    });
  }

  /**
   * Loads the permissions row, creating it with the defaults when missing. An
   * unreadable row is rewritten with the defaults: this runs when the module is first
   * required, so a throw here would crash the agent on every boot.
   * @param {() => void} cb
   * @returns {void}
   */
  // eslint-disable-next-line class-methods-use-this
  load = (cb) => {
    // eslint-disable-next-line consistent-return
    getDataDbKey(keyValue, (error, stored) => {
      if (error) return;
      let data = null;
      if (stored) {
        try {
          data = JSON.parse(stored[0].value);
        } catch (e) {
          logger.warn(`Rewriting unreadable ${keyValue} row: ${e.message}`);
        }
      }
      if (!data) {
        setKey(keyValue, JSON.stringify(this.permissionData), () => {
          cb();
        });
      } else {
        Object.keys(this.permissionData).forEach((key) => {
          if (data[key]) this.permissionData[key] = toPermissionString(data[key]);
        });
        cb();
      }
    });
  };

  all = () => this.permissionData;

  getData = (key) => toPermissionString(this.permissionData[key]);

  setData = (key, value, cb) => {
    this.permissionData[key] = toPermissionString(value);
    saveToDbKey(keyValue, this.permissionData, () => {
      if (cb && typeof cb === 'function') cb();
    });
  };

  update = (key, value, cb) => {
    this.permissionData[key] = toPermissionString(value);
    saveToDbKey(keyValue, this.permissionData, () => {
      if (cb && typeof cb === 'function') cb();
    });
  };

  setFullFromData = (data, cb) => {
    Object.keys(this.permissionData).forEach((key) => {
      if (data[key]) {
        this.permissionData[key] = toPermissionString(data[key]);
      }
    });
    saveToDbKey(keyValue, this.permissionData, () => {
      if (cb && typeof cb === 'function') cb();
    });
  };

  setFull = (cb) => {
    saveToDbKey(keyValue, this.permissionData, () => {
      if (cb && typeof cb === 'function') cb();
    });
  };
}

const instance = new PermissionData();
Object.freeze(instance);

module.exports = instance;
