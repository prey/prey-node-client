const fs = require('fs');
const path = require('path');
const shared = require('./shared');
const paths = require('../system/paths');
const { cp } = require('./utils/cp');

// eslint-disable-next-line camelcase
const { restart_client } = require('../package');

const pathEnv = path.join(__dirname, '../../..');
const logfile = paths.log_file;

const read = (file) => {
  const stream = fs.createReadStream(file);
  stream.on('data', shared.log);
  stream.on('error', (err) => {
    shared.log(err.message);
  });
};

// eslint-disable-next-line consistent-return
exports.write = (values, cb) => {
  const output = values['-o'] && values.positional[0];
  if (!output) return read(logfile);
  // eslint-disable-next-line consistent-return
  cp(logfile, output, (err) => {
    if (err) return cb(err);
    shared.log(`Successfully dump log contents to ${output}`);
  });
};

const envFileCreate = (values) => {
  const { value } = values;
  const contenido = `DEBUG=${value}`;
  fs.writeFileSync(`${pathEnv}/.env`, contenido);
  shared.log('Restarting Prey services if it\'s running');
  setTimeout(() => {
    restart_client();
  }, 5000);
};

exports.envFileCreate = envFileCreate;
