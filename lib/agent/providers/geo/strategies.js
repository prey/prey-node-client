const { join } = require('path');
const needle = require('needle');

// eslint-disable-next-line import/no-dynamic-require
const platform = require(join(__dirname, process.platform));
const common = require('../../common');
const providers = require('../../providers');
const keys = require('../../plugins/control-panel/api/keys');
const logger = require('../../common').logger.prefix('geo');
const storage = require('../../utils/storage');

const { config } = common;

const GEO_ENDPOINT = 'https://solid.preyproject.com/geo';
let proxy;
/**
 * Retrieves the user's location using the geoip service.
 *
 * @param {function} cb - The callback function to handle the result.
 * @return {void} The function does not return anything.
 */
const geoip = (cb) => {
  logger.info('Getting location via geoip');
  // eslint-disable-next-line consistent-return
  needle.get('http://ipinfo.io/geo', (err, resp, body) => {
    if (!body || !body.loc) {
      return cb(err || new Error('Unable to get location from IP.'));
    }
    logger.debug('Got location via geoip');
    const res = {
      lat: parseFloat(body.loc.split(',')[0]),
      lng: parseFloat(body.loc.split(',')[1]),
      method: 'geoip',
    };
    cb(null, res);
  });
};
/**
 * Saves the provided data to the storage.
 *
 * @param {Object} data - The data to be saved.
 * @return {undefined} No return value.
 */
const saveData = (data) => {
  storage.do('set', { type: 'keys', id: 'last_wifi_location', data: { value: JSON.stringify(data) } }, (err) => {
    if (err) logger.error('Unable to save last_wifi_location data');
  });
};
/**
 * Parses the response body and returns it in the callback function.
 *
 * @param {object|string} body - The response body to parse.
 * @param {function} cb - The callback function to handle the parsed body.
 * @return {null|object|string} - Returns the parsed body in the callback function or an
 * error if parsing fails.
 */
const checkResponse = (body, cb) => {
  let output;

  if (typeof body === 'object') {
    output = body;
  } else {
    try {
      output = JSON.parse(body);
    } catch (e) {
      return cb(e);
    }
  }
  return cb(null, output);
};
/**
 * Processes the response received from the API.
 *
 * @param {Object} coords - The coordinates data received from the API.
 * @param {function} cb - The callback function to be called after processing the response.
 * @return {Object} The processed data object containing latitude, longitude, accuracy, and method.
 */
function processResponse(coords, cb) {
  logger.info('Processing wifi data response');
  if (!coords.location || (!coords.location.lat && !coords.location.latitude)) {
    return cb(new Error('Couldnt get any geoposition data. Try moving around a bit.'));
  }
  const data = {
    lat: coords.location.lat || coords.location.latitude,
    lng: coords.location.lng || coords.location.longitude,
    accuracy: coords.accuracy || coords.location.accuracy,
    method: 'wifi',
  };
  storage.do('query', { type: 'keys', column: 'id', data: 'last_wifi_location' }, (err, storedData) => {
    if (err) logger.error('Unable to read last_wifi_location data');
    if (storedData && storedData.length === 0) saveData(data);
    storage.do('del', { type: 'keys', id: 'last_wifi_location' }, (errStorageDo) => {
      if (errStorageDo) logger.error('Unable to delete last_wifi_location data');
      saveData(data);
    });
  });
  return cb(null, data);
}
/**
 * Sends data to the location service.
 *
 * @param {Array} list - The list of data to be sent.
 * @param {Function} cb - The callback function to be called after sending the data.
 * @return {undefined}
 */
const sendData = (list, cb) => {
  logger.debug('Sending AP data to location service');
  let sortedList;
  if (list && Array.isArray(list) && list.length > 1) {
    sortedList = list.sort((a, b) => a.signal_strength - b.signal_strength);
  }
  // eslint-disable-next-line no-bitwise
  const filteredList = sortedList.filter((m) => (2 & Number.parseInt(m.mac_address[1], 16)) === 0 && m.mac_address.substr(0, 8).toUpperCase() !== '00:00:5E');
  const dataWifiAccessPoints = {
    wifiAccessPoints: filteredList,
  };
  proxy = config.get('try_proxy');

  const opts = {
    user_agent: common.system.user_agent,
    username: keys.get().device,
    password: keys.get().api,
    json: true,
  };
  if (proxy) opts.proxy = proxy;

  // eslint-disable-next-line consistent-return
  needle.post(GEO_ENDPOINT, dataWifiAccessPoints, opts, (err, resp, body) => {
    if (err) return cb(err);
    if (resp && resp.statusCode === 429) {
      storage.do('query', { type: 'keys', column: 'id', data: 'last_wifi_location' }, (errorStorage, storedData) => {
        if (errorStorage) return cb(new Error('Unable to read geo data'));
        if (storedData && storedData.length === 0) return cb(new Error('There is no geo data in DB'));
        try {
          return cb(null, JSON.parse(storedData[0].value));
        } catch (e) {
          return cb(new Error('Couldnt get data in sqlite storage geo'));
        }
      });
    }
    // eslint-disable-next-line consistent-return
    checkResponse(body, (errCheckResponse, stdout) => {
      if (errCheckResponse) return cb(errCheckResponse);

      // If the response includes the location already it's immediately processed
      if (stdout.geolocation) return processResponse(stdout.geolocation, cb);

      if (!stdout.endpoint) return cb(new Error('No location endpoint available'));
      const { url } = stdout.endpoint.url;
      const { provider } = stdout.endpoint.provider;

      const options = {
        user_agent: stdout.endpoint['user-agent'],
        json: true,
      };
      if (proxy) opts.proxy = proxy;
      // Get the location using the url and mac addresses data;
      // eslint-disable-next-line consistent-return
      needle.post(url, dataWifiAccessPoints, options, (errorPostUrl, _resp, bodyPostUrl) => {
        if (errorPostUrl) {
          logger.info(`strategies err: ${JSON.stringify(errorPostUrl)}`);
          return cb(errorPostUrl);
        }
        if (bodyPostUrl && bodyPostUrl.error) {
          logger.info(`strategies err: ${JSON.stringify(bodyPostUrl)}`);
          return cb(errorPostUrl);
        }
        // eslint-disable-next-line consistent-return
        checkResponse(bodyPostUrl, (errorCheckResponse, stdoutCheckResponse) => {
          if (errorCheckResponse) return cb(errorCheckResponse);
          const geolocation = stdoutCheckResponse;
          const locData = {
            geolocation,
            wifiAccessPoints: filteredList,
            provider,
          };
          const optsPut = {
            user_agent: common.system.user_agent,
            json: true,
            username: keys.get().device,
            password: keys.get().api,
          };
          if (proxy) optsPut.proxy = proxy;
          // Send the new location info and process it
          // eslint-disable-next-line consistent-return
          needle.put(GEO_ENDPOINT, locData, optsPut, (errPut) => {
            logger.debug('Sending location data to prey service');
            if (errPut) {
              logger.info(`error service ${GEO_ENDPOINT}  PUT: ${JSON.stringify(errPut)}`);
              return cb(errPut);
            }
            processResponse(geolocation, cb);
          });
        });
      });
    });
  });
};
/**
* Retrieves location information using the wifi strategy.
*
* @param {function} cb - The callback function to be executed after retrieving the
location information.
* @return {type} description of return value
*/
const wifi = (cb) => {
  logger.info('Getting location via wifi strategy');

  // eslint-disable-next-line consistent-return
  providers.get('access_points_list', (err, list) => {
    if (err) return cb(err);
    sendData(list, cb);
  });
};
/**
 * Retrieves the user's location using the native geolocation method.
 *
 * @param {function} cb - The callback function to be executed after retrieving the location.
 * @return {void}
 */
const geonative = (cb) => {
  logger.info('Getting location via native geoloc');
  platform.get_location((err, res) => {
    if (err) {
      return cb(err);
    }
    logger.debug('Got location via native geoloc');
    // Avoid adding property in each native geoloc implementation
    res.method = 'native';
    return cb(null, res);
  });
};

module.exports = {
  geoip,
  wifi,
  native: geonative,
};
