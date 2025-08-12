const { getDataDbKey, saveToDbKey, setKey } = require('./configutil');
const os_name = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const keyValue = 'skippedPermissions';
const tmpdir = '/tmp';

const fs = require('fs');
const path = require('path');

class SkippedPermissionsData {
  skippedPermissionsData = {
    camera: 'false',
    screenshot: 'false',
    location: 'false',
  };

  constructor() {
    if (SkippedPermissionsData.instance instanceof SkippedPermissionsData) return SkippedPermissionsData.instance;
    this.load(() => {
      SkippedPermissionsData.instance = this;
    });
  }
  
  load = (cb) => {
    if (os_name != "mac") return cb();

    getDataDbKey(keyValue, (error, stored) => {
      if (error) return;
      if (!stored) {
        try {
          // Read permissions file inside /tmp folder
          const tempPerms = fs.readFileSync(path.join(tmpdir, 'prey.perms.temp'))
          const values = tempPerms.toString().trim().split(','); // Result: ['1', '0', '1']
          const keys = Object.keys(this.skippedPermissionsData); // Result: ['camera', 'screenshot', 'location']

          keys.forEach((key, index) => {
            this.skippedPermissionsData[key] = (values[index] === '1').toString();
          });
        } catch (e) {
          console.log("No permissions file found, setting to false for all..");
        }

        setKey(keyValue, this.skippedPermissionsData, cb)
        
      } else {
        const data = JSON.parse(stored[0].value);
        Object.keys(this.skippedPermissionsData).forEach((key) => {
          if (data[key]) this.skippedPermissionsData[key] = data[key];
        });
        cb();
      }
    });
  };

  all = () => this.skippedPermissionsData;

  getData = (key) => this.skippedPermissionsData[key];

  setData = (key, value, cb) => {
    this.skippedPermissionsData[key] = value;
    saveToDbKey(keyValue, this.skippedPermissionsData, () => {
      if (cb && typeof cb === 'function') cb();
    });
  };

  update = (key, value, cb) => {
    this.skippedPermissionsData[key] = value;
    saveToDbKey(keyValue, this.skippedPermissionsData, () => {
      if (cb && typeof cb === 'function') cb();
    });
  };

}
  
const instance = new SkippedPermissionsData();
Object.freeze(instance);

module.exports = instance;
