const { getDataDbKey, saveToDbKey, setKey } = require('./configutil');

const keyValue = 'permissions';

// Callers (listeners.js, geo/index.js, request_permission/index.js) treat
// permission values as strings via .localeCompare(); coerce booleans so a
// raw boolean written by any source (past or present) never reaches them.
const toPermissionString = (value) => (typeof value === 'boolean' ? value.toString() : value);

class PermissionData {
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

  // eslint-disable-next-line class-methods-use-this
  load = (cb) => {
    // eslint-disable-next-line consistent-return
    getDataDbKey(keyValue, (error, stored) => {
      if (error) return;
      if (!stored) {
        setKey(keyValue, JSON.stringify(this.permissionData), () => {
          cb();
        });
      } else {
        const data = JSON.parse(stored[0].value);
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
