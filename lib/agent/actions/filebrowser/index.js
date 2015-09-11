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
//    url: 'files.preyproject.com',
//    show_hidden: true,
//    show_icon: true,
//    allowed_ip: '123.123.123.1',
//    root: '/etc/prey'
//  }
//////////////////////////////////////////

var folder = require('folder'),
    connect = require('connect'),
    sendfile = require('serve-static'),
    EventEmitter = require('events').EventEmitter,
    localtunnel = require('localtunnel'),
    logger  = require('./../../common').logger.prefix('filebrowser');

var instance = null;

var FileBrowser = function(options) {

  options = options || {};

  if (!(this instanceof FileBrowser)) {
    return new FileBrowser(opts);
  }

  var self = this;

  self._server = {};
  self._emitter = {};
  self._tunnel = {};

  self._opts = {
    root: options.root
  }

  self._tunnelOpts = {
    host: options.host,
    allowedIp: null,
    localPort: '',
    subdomain: ''
  }

  self._folderOpts = {
    hidden: options.show_hidden || false,
    icons: options.show_icons || true
  }

  self._retryingTunnel = false;
}

FileBrowser.prototype._start = function(cb) {

  var self = this,
      app = connect();

  var root_path = self._defaultRoot();

  // Setup check_allowed_ip middleware if IP was specified
  var allowedIp = self._tunnelOpts.allowedIp;
  if (allowedIp) {
    app.use(check_allowed_ip(allowedIp));
  }

  app.use(folder(root_path, self._folderOpts));
  app.use(sendfile(root_path));

  self._server = app.listen(function(err) {

    if (err) return cb(err);

    self._emitter = new EventEmitter();
    cb(null, self._emitter);

    logger.debug('Local server listening on ' + this.address().port);
    self._openTunnel();
  })

  // Connect middleware that checks if the IP trying to connect to
  // our files server corresponds with the provided valid IP
  function check_allowed_ip(ip) {
    return function(req, res, next) {
      if (req.socket.remoteAddress !== ip) {
        logger.debug('You shall not tunnel!');
        return res.status(400).end('Invalid address.');
      }
      next();
    }
  }
};

FileBrowser.prototype._defaultRoot = function() {

  var self = this;

  if (self._opts.root) {
    return self._opts.root;
  }

  switch(process.platform) {
    case 'win32':
      return 'C:\\';
    case 'darwin':
      return '/Users';
    default:
      return '/home';
  }
};

FileBrowser.prototype._openTunnel = function () {

  var self = this,
      port = self._server.address().port;

  localtunnel(port, self._tunnelOpts, function(err, tunnel) {

    if (err) {
      return finished(err);
    }

    logger.debug('Tunnel opened and available at ' + tunnel.url);

    self._tunnel = tunnel;
    self._tunnelOpts.subdomain = tunnel.tunnel_cluster._opt.name;

    // Reset retrying. At this point tunnel it's already re-opened.
    if (self._retryingTunnel) {
      self._retryingTunnel = false;
      self._emitter.emit('tunnel_reopened', tunnel.url);
    } else {
      self._emitter.emit('tunnel_opened', tunnel.url);
    }

    self._retrying = false;

    //tunnel.on('close', self._finished, self);
    tunnel.tunnel_cluster.on('error', errorCallback);

    // Catch errors from other opened connections that just failed
    tunnel.tunnel_cluster.on('error', function(err) { return });

    function errorCallback(err) {
      logger.debug('Tunnel closed with error: ' + err);

      // Remove listener so it is not triggered by
      // every failing connection, while we try to reconnect.
      tunnel.tunnel_cluster.removeListener('error', errorCallback);
      self._retryTunnel();
    }
  });
};

FileBrowser.prototype._retryTunnel = function () {

  var self = this;

  if (self._retryingTunnel) {
    return;
  }

  logger.debug('Retrying tunnel');
  self._retryingTunnel = true;
  self._openTunnel();
}

FileBrowser.prototype._stop = function() {
  var self = this;

  logger.debug('Stopping filebrowser');

  if (self._tunnel) {
    logger.debug('Closing tunnel');
    self._tunnel.close();
  }

  if (self._server) {
    logger.debug('Shutting down file server');
    self._server.close();
  }

  self._server = null;
  self._tunnel = null;

  self._emitter.emit('end');
  self._emitter.emit('tunnel_closed');
};

exports.start = function(options, cb) {
  instance = new FileBrowser(options);
  instance._start(cb);
}

exports.stop = function() {
  if(instance) {
    instance._stop();
    instance = null;
  }
}

exports.events = ['tunnel_opened', 'tunnel_closed'];
