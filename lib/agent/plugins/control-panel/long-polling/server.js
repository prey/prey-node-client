var http    = require('http'),
    lp      = require('./'),
    exec    = require('child_process').exec,
    common  = require('../../../common')
    logger  = common.logger.prefix('server'),
    gte     = common.helpers.is_greater_or_equal
    geo     = require('./../../../providers/geo');
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

var app;

var check_service = (cb) => {
  if (os_name == 'mac') return cb(true);
  exec('wpxsvc.exe -winsvc=version', (err, out) => {
    service_version = out.split('\n')[0];
    if (service_version && gte(service_version, "1.2.0"))
      return cb(true)
    cb(false);
  })
}

var create_server = () => {
  if (os_name == 'linux') return;

  check_service((valid) => {
    if (!valid) return;

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

    app.listen(7738, '127.0.0.1');
  }) 
}

exports.close = () => {
  if (app) app.close();
}

exports.create_server = create_server;