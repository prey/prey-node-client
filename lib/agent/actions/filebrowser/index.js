"use strict";

//////////////////////////////////////////
// Prey JS FileBrowser Action
// (c) 2015 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//
//
//
//  command: 'start',
//  target: 'filebrowser',
//  options: {
//    port: 1234,
//    url: 'files.preyproject.com'
//  }
//////////////////////////////////////////

var folder = require('folder'),
    connect = require('connect'),
    sendfile = require('serve-static'),
    EventEmitter = require('events').EventEmitter,
    localtunnel = require('localtunnel'),
    logger  = require('./../../common').logger.prefix('filebrowser');

var server,
    emitter,
    tunnel;

function check_valid_ip(valid_ip) {
  return function(req, res, next) {
    if (req.socket.remoteAddress !== valid_ip) {
      logger.debug('You shall not tunnel!');
      return res.status(400).end('Invalid address.');
    }

    next();
  }
}

function open_tunnel(local_port, opts) {
  tunnel = localtunnel(local_port, opts, function(err, tunnel) {
    if (err)
      return finished(err);

    logger.debug('Tunnel opened and available at ' + tunnel.url);
    emitter.emit('tunnel_opened', tunnel.url);
  });

  tunnel.on('close', finished);
}

function finished(err) {
  logger.debug('Tunnel closed');
  emitter.emit('end', err);
  if (server) server.close();
  server = null;
  tunnel = null;
}

function default_root() {
  if (process.platform == 'win32')
    return 'C:\\';
  else if (process.platform == 'darwin')
    return '/Users';
  else
    return '/home';
}

exports.start = function(options, cb) {
  var options  = options || {},
      valid_ip = options.valid_ip,
      app      = connect();

  var root_path = options.root || default_root();

  var folder_opts = {
    hidden: options.show_hidden || false,
    icons : options.show_icons || true
  };

  var tunnel_opts = {
    host: options.host
  }

  if (valid_ip) {
    app.use(check_valid_ip(valid_ip));
  }

  app.use(folder(root_path, folder_opts));
  app.use(sendfile(root_path));

  server = app.listen(function(err) {
    if (err) return cb(err);

    emitter = new EventEmitter();
    cb(null, emitter);

    var local_port = this.address().port;
    logger.debug('Local server listening on ' + local_port);
    open_tunnel(local_port, tunnel_opts, cb);
  })
}

exports.stop = function() {
  if (tunnel) {
    logger.debug('Closing tunnel.');
    tunnel.close();
  }
}

exports.events = ['tunnel_opened'];
