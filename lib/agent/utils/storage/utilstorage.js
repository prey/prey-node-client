const storage = require('../storage');

const saveDataWifi = (dataWifi) => {
  storage.do('query', { type: 'keys', column: 'id', data: 'wifiDataStored' }, (err, stored) => {
    if (err) return;
    if (stored && stored.length > 0) {
      let storedData = stored[0].value;

      if (typeof storedData === 'string') storedData = JSON.parse(storedData);
      if (!storedData.dataWifi) return;
      storedData.dataWifi.push(dataWifi);
      if (storedData.dataWifi.length > 20) {
        storedData.dataWifi = storedData.dataWifi.slice(1);
      }
      storage.do('update', {
        type: 'keys', id: 'wifiDataStored', columns: 'value', values: JSON.stringify(storedData),
      }, () => {
      });
    } else {
      storage.do('set', { type: 'keys', id: 'wifiDataStored', data: { value: JSON.stringify({ dataWifi: [dataWifi] }) } }, () => {
      });
    }
  });
};

const retrieveDataWifi = (cb) => {
  storage.do('query', { type: 'keys', column: 'id', data: 'wifiDataStored' }, (err, stored) => {
    if (err) return cb('');
    if (stored && stored.length > 0) {
      const storedData = stored[0].value;
      // eslint-disable-next-line consistent-return
      return cb(storedData);
    }
    // eslint-disable-next-line consistent-return
    return cb('');
  });
};

exports.saveDataWifi = saveDataWifi;
exports.retrieveDataWifi = retrieveDataWifi;
exports.storage = storage;
