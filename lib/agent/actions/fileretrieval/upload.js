// #!/usr/bin/env node
// this file needed not shebang: https://github.com/mysticatea/eslint-plugin-node/blob/master/docs/rules/shebang.md

const fs = require('fs');
const path = require('path');
const mime = require('mime');
const needle = require('needle');
const common = require('../../common');

const config = require('../../../utils/configfile');

const protocol = config.getData('control-panel.protocol');
const host = config.getData('control-panel.host');
const url = `${protocol}://${host}`;

const UPLOAD_SERVER = `${url}/upload/upload`;
let RESUMABLE_HEADER = 'X-Prey-Upload-Resumable';
const OPEN_TIMEOUT = 180000;
const READ_TIMEOUT = 2000;

const PATH = 2;
const USER = 3;
const NAME = 4;
const SIZE = 5;
const FILE_ID = 6;
const TOTAL = 7;
const PORT = 8;

function main() {
  const { argv } = process;
  const options = {
    path: argv[PATH],
    user: argv[USER],
    name: argv[NAME],
    size: argv[SIZE],
    file_id: argv[FILE_ID],
    total: argv[TOTAL],
    port: argv[PORT],
  };
  Main(options, (err) => {
    if (err) {
      console.error(err);
    }
  });
}

function Main(options, cb) {
  const file_path = options.path;
  const { file_id } = options;
  const file_size = parseInt(options.size);
  const file_name = options.name;
  const { user } = options;

  console.log('Uploading file: ', file_path, file_id);

  const file = {
    total: 0,
    path: file_path,
    user,
    id: file_id,
    size: file_size,
  };
  get_file(file, cb);
}

function get_file(file, cb) {
  const buffsize = (file.size == 0) ? 1 : (file.size - file.total);
  const buf = Buffer.alloc(buffsize);
  const fd = fs.openSync(file.path, 'r');

  fs.read(fd, buf, 0, file.size - file.total, file.total, (err, read, buf) => {
    if (err) {
      cb(err);
      return;
    }
    upload_file(file, buf, cb);
  });
}

function upload_file(file, buf, cb) {
  const options = {
    open_timeout: OPEN_TIMEOUT,
    read_timeout: READ_TIMEOUT,
  };

  if (file.total > 0) {
    RESUMABLE_HEADER = file.total;
  }
  const url = `${UPLOAD_SERVER}?uploadID=${file.id}`;

  needle.post(url, buf, options, (err, res) => {
    if (err) {
      console.log(err);
      cb(err);
      return;
    }
    const out = res.statusCode;
    if (out !== 200 && out !== 201) {
      var err = new Error('There was an error communicating with the server');
      cb(err);
      return;
    }
    console.log('File succesfuly uploaded:', file.id);
    cb(null); // delete files
  });
}

main();
