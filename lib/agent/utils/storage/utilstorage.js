const storage = require('../storage');

const updateDataDbKey = (typeDb, idName, columName, data, callback) => {
  try {
    storage.do('update', {
      type: typeDb, id: idName, columns: columName, values: data,
    }, (err) => {
      if (err) callback(err, null);
    });
  } catch (e) {
    callback(e, null);
  }
};

const saveDataDbKey = (typeDb, columName, data, callback) => {
  try {
    storage.do('set', {
      type: typeDb,
      id: columName,
      data: {
        value: data,
      },
    }, (err) => {
      if (err) callback(err, null);
    });
  } catch (e) {
    callback(e, null);
  }
};

const getDataDbKey = (whatToGet, callback) => {
  try {
    storage.do('query', { type: 'keys', column: 'id', data: whatToGet }, (err, stored) => {
      if (err) {
        return callback(err, null);
      }
      if (stored && stored.length > 0) {
        return callback(null, stored);
      }
      return callback(null, null);
    });
  } catch (e) {
    callback(e, null);
  }
};

const saveDataWifi = (dataWifi) => {
  storage.do('query', { type: 'keys', column: 'id', data: 'wifiDataStored' }, (err, stored) => {
    if (err) return;
    if (stored && stored.length > 0) {
      let storedData = stored[0].value;

      if (typeof storedData === 'string') storedData = JSON.parse(storedData);
      if (!storedData.dataWifi) return;
      storedData.dataWifi.push(dataWifi);
      if (storedData.dataWifi.length > 200) {
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

const deleteDbKey = (whatToGet, callback) => {
  try {
    storage.do('del', { type: 'keys', id: whatToGet }, (errDel) => {
      if (errDel) return callback(errDel);
      return callback(null);
    });
  } catch (e) {
    callback(e);
  }
};

exports.deleteDbKey = deleteDbKey;
exports.saveDataWifi = saveDataWifi;
exports.getDataDbKey = getDataDbKey;
exports.saveDataDbKey = saveDataDbKey;
exports.updateDataDbKey = updateDataDbKey;
exports.storage = storage;
