const { getDataDbKey, saveToDbKey, setKey } = require('./configutil');

const keyValue = 'permissions';

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
          if (data[key]) this.permissionData[key] = data[key];
        });
        cb();
      }
    });
  };

  all = () => this.permissionData;

  getData = (key) => this.permissionData[key];

  setData = (key, value, cb) => {
    this.permissionData[key] = value;
    saveToDbKey(keyValue, this.permissionData, () => {
      if (cb && typeof cb === 'function') cb();
    });
  };

  update = (key, value, cb) => {
    this.permissionData[key] = value;
    saveToDbKey(keyValue, this.permissionData, () => {
      if (cb && typeof cb === 'function') cb();
    });
  };

  setFullFromData = (data, cb) => {
    Object.keys(this.permissionData).forEach((key) => {
      if (data[key]) {
        this.permissionData[key] = data[key];
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
