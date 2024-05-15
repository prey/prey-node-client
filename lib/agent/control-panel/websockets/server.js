const os = require('os');
const http = require('http');
const { exec } = require('child_process');
const websocket = require('./index');
const common = require('../../common');
const geo = require('../../providers/geo');

const logger = common.logger.prefix('server');
const gte = common.helpers.is_greater_or_equal;

let app;
const osName = os.platform().replace('darwin', 'mac').replace('win32', 'windows');

const check_service = (cb) => {
  if (osName == 'mac') return cb(true);
  const sys_win = require('../../../system/windows');

  sys_win.get_winsvc_version((err, service_version) => {
    if (err) return cb(false);

    if (service_version && gte(service_version, '1.2.0'))
      return cb(true);
    cb(false);
  });
};

const server_commands = {
  mac: {
    scan: 'lsof -Pi :7738 | sed -n \'2 p\'| awk \'{print $2}\'',
    kill: 'kill -9 ',
  },
  windows: {
    scan: 'for /F "tokens=1,2,3,4,5" %A in (\'"netstat -ano | find "LISTENING" | find "127.0.0.1:7738""\') DO @echo %~E',
    kill: 'taskkill /F /PID ',
  },
};

const check_server_down = (cb) => {
  exec(server_commands[osName].scan, (err, pid) => {
    if (err || !pid) return cb(new Error('No other local server found, we are clear.'));
    if (pid) {
      logger.info('Localhost server on same port found.. killing it!');
      exec(server_commands[osName].kill + pid, cb);
    } else return cb();
  });
};

const create_server = (cb) => {
  if (osName === 'linux') return cb(new Error('Service only available for mac and windows'));

  check_service((valid) => {
    if (!valid) return cb(new Error('Windows Service not compatible'));

    check_server_down((err) => {
      if (err) logger.info(err.message);

      app = http.createServer((req, res) => {
        if (req.url.includes('/healthz')) {
          // Change default location strategy if native is allowed on mac
          if (osName === 'mac') req.url.includes('location=true') ? geo.set_default('native') : geo.set_default('wifi');

          const isOk = websocket.check_timestamp();

          if (isOk) {
            res.writeHead(200);
          } else {
            logger.info('Client not responding, restarting...');
            res.writeHead(400);
          }
          res.end();
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
          logger.info('permission status received');
          req.on('data', chunk => {
            const data = JSON.parse(chunk.toString())
            logger.info(data["permission"]);
            logger.info(data["os"]);
            logger.info(data["status"]);

          });
          req.on('end', () => {
            logger.info("permission status finished") 
          })
          res.writeHead(200);
          res.end();
        }
      });

      app.on('error', err => {
        logger.info(`Error creating check server: ${err.message}`);
        return cb(err);
      });

      app.listen(7738, '127.0.0.1');
      if (cb) return cb(null, app);
    });
  });
};

exports.close = () => {
  if (app) app.close();
};

exports.create_server = create_server;
exports.check_server_down = check_server_down;
exports.check_service = check_service;