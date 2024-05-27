const http = require('node:http');
const { v4: uuidv4 } = require('uuid');

const shared = require('./shared');

const log = (str) => shared.log(str);

const postDataNativeLocation = JSON.stringify({
  body: {
    command: 'start',
    options: {
      name: 'native_location',
    },
    target: 'request_permission',
  },
  id: uuidv4(),
  time: (new Date()).toISOString(),
  type: 'action',
});

const sendAction = (values, cb) => {
  const { key } = values;
  let postData;
  if (key.localeCompare('native_location') === 0) {
    postData = postDataNativeLocation;
  }
  const options = {
    hostname: 'localhost',
    port: 7738,
    path: '/actions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };
  const req = http.request(options, (res) => {
    log(`STATUS: ${res.statusCode}`);
    log(`HEADERS: ${JSON.stringify(res.headers)}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
      log('No more data in response.');
    });
  });
  req.on('error', (e) => {
    log(`problem with request: ${e.message}`);
    return typeof cb === 'function' ? cb() : null;
  });
  // Write data to request body
  req.write(postData);
  req.end();
  return typeof cb === 'function' ? cb() : null;
};

exports.sendAction = sendAction;
