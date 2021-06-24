var http    = require('http'),
    lp      = require('./'),
    common  = require('../../../common'),
    logger  = common.logger.prefix('server'),
    gte     = common.helpers.is_greater_or_equal,
    geo     = require('./../../../providers/geo'),
    exec    = require('child_process').exec,
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

var app;

var check_service = (cb) => {
  if (os_name == 'mac') return cb(true);
  var sys_win = require('./../../../../system/windows');
  sys_win.get_winsvc_version((err, service_version) => {
    if (err) return cb(false);

    if (service_version && gte(service_version, "1.2.0"))
      return cb(true)
    cb(false);
  })
}

var server_commands = {
  mac: {
    scan: "lsof -Pi :7738 | sed -n '2 p'| awk '{print $2}'",
    kill: "kill -9 "
  },
  windows: {
    scan: `for /F "tokens=1,2,3,4,5" %A in ('"netstat -ano | find "LISTENING" | find "127.0.0.1:7738""') DO @echo %~E`,
    kill: "taskkill /F /PID "
  }
}

var check_server_down = (cb) => {
  exec(server_commands[os_name].scan, (err, pid) => {
    if (err) return cb(err)
    if (pid) {
      logger.info("Localhost server on same port found.. killing it!")
      exec(server_commands[os_name].kill + pid, cb)
    } else return cb();
  })
}

var create_server = () => {
  if (os_name == 'linux') return;

  check_service((valid) => {
    if (!valid) return;

    check_server_down((err) => {
      if (err) logger.info("Unable to get data fron a current server");

      app = http.createServer((req, res) => {
        if (req.url.includes("/healthz")) {

          // Change default location strategy if native is allowed on mac
          if (os_name == 'mac')
            req.url.includes('location=true') ? geo.set_default('native') : geo.set_default('wifi');

          var is_ok = lp.check_timestamp();

          if (is_ok) {
            res.writeHead(200);
          } else {
            logger.info('Client not responding, restarting...')
            res.writeHead(400);
          }
          res.end();
          return;
        }
      });

      app.on('error', err => {
        logger.info("Error creating check server: " + err.message)
      })

      app.listen(7738, '127.0.0.1');
    })
  })
}

exports.close = () => {
  if (app) app.close();
}

exports.create_server = create_server;