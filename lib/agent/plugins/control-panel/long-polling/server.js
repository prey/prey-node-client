var http    = require('http'),
    lp      = require('./'),
    logger  = require('../../../common').logger.prefix('server'),
    geo     = require('./../../../providers/geo');
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

var app;

var create_server = () => {
  if (os_name == 'linux') return;

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
}

exports.close = () => {
  if (app) app.close();
}

exports.create_server = create_server;