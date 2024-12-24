/* eslint-disable consistent-return */
const os = require('os');
exports.http = require('http');
const { exec } = require('child_process');
exports.websocket = require('./index');
exports.commands = require('../../commands');
const common = require('../../common');
exports.geo = require('../../providers/geo');

exports.sysWin = require('../../../system/windows');

const logger = common.logger.prefix('server');
const gte = common.helpers.is_greater_or_equal;

exports.app = null;
exports.osName = os.platform().replace('darwin', 'mac').replace('win32', 'windows');

// eslint-disable-next-line consistent-return
exports.check_service = (cb) => {
  if (exports.osName === 'mac') return cb(true);
  // eslint-disable-next-line global-require

  exports.sysWin.get_winsvc_version((err, serviceVersion) => {
    if (err) return cb(false);
    if (serviceVersion && gte(serviceVersion, '1.2.0')) return cb(true);
    cb(false);
  });
};

exports.execCmd = (cmd, cb) => {
  exec(cmd, (err, out) => {
    cb(err, out);
  });
};

const serverCommands = {
  mac: {
    scan: 'lsof -Pi :7738 | sed -n \'2 p\'| awk \'{print $2}\'',
    kill: 'kill -9 ',
  },
  windows: {
    scan: 'for /F "tokens=1,2,3,4,5" %A in (\'"netstat -ano | find "LISTENING" | find "127.0.0.1:7738""\') DO @echo %~E',
    kill: 'taskkill /F /PID ',
  },
};

exports.check_server_down = (cb) => {
  exports.execCmd(serverCommands[exports.osName].scan, (err, pid) => {
    if (err || !pid) return cb(new Error('No other local server found, we are clear.'));
    if (pid) {
      logger.info('Localhost server on same port found.. killing it!');
      exports.execCmd(serverCommands[exports.osName].kill + pid, cb);
    } else return cb();
  });
};

exports.reactToHealtz = (req, res) => {
  // Change default location strategy if native is allowed on mac
  // eslint-disable-next-line no-unused-expressions
  if (exports.osName === 'mac') req.url.includes('location=true') ? exports.geo.set_default('native') : exports.geo.set_default('wifi');

  const isOk = exports.websocket.check_timestamp();

  if (isOk) {
    res.writeHead(200);
  } else {
    logger.info('Client not responding, restarting...');
    res.writeHead(400);
  }
  res.end();
};

exports.reactToHandling = (req, res) => {
  if (req.url.includes('/healthz')) {
    exports.reactToHealtz(req, res);
  }

  // handles the information sent by macos app (location)
  // but can be extended to new permissions
  // example of required payload
  // {
  //  "os": "macos",
  //  "permission": "location",
  //  "status": "rejected"
  // }
  if (req.url.includes('/permission')) {
    exports.reactToPermissions(req, res);
  }

  if (req.url.includes('/actions')) {
    exports.reactToActions(req, res);
  }
};

exports.reactToPermissions = (req, res) => {
  logger.debug('permission status received');
  req.on('data', (chunk) => {
    const data = JSON.parse(chunk.toString());
    logger.debug(data.permission);
    logger.debug(data.os);
    logger.debug(data.status);
    if (data.status.localeCompare('Authorized') === 0 && data.permission.localeCompare('location') === 0) {
      exports.geo.get_location(() => {});
    }
  });
  req.on('end', () => {
    logger.debug('permission status finished');
  });
  res.writeHead(200);
  res.end();
};

exports.reactToActions = (req, res) => {
  logger.debug('action command received');
  req.on('data', (chunk) => {
    logger.debug(`chunk is: ${chunk}`);
    let parsedData;
    try {
      parsedData = JSON.parse(chunk.toString());
    } catch (e) {
      logger.debug(`error exception: ${e}`);
      return;
    }
    exports.commands.perform(parsedData);
  });
  req.on('end', () => {
    logger.debug('action command finished');
  });
  res.writeHead(200);
  res.end();
};

exports.create_server = (cb) => {
  if (exports.osName === 'linux') return cb(new Error('Service only available for mac and windows'));
  exports.check_service((valid) => {
    if (!valid) return cb(new Error('Windows Service not compatible'));

    exports.check_serverDown((err) => {
      if (err) logger.info(err.message);

      exports.app = exports.http.createServer((req, res) => {
        exports.reactToHandling(req, res);
      });

      exports.app.on('error', (errorApp) => {
        logger.info(`Error creating check server: ${errorApp.message}`);
        return cb(errorApp);
      });

      exports.app.listen(7738, '127.0.0.1');
      if (cb) return cb(null, exports.app);
    });
  });
};

exports.close = () => {
  if (exports.app) exports.app.close();
};
