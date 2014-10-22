"use strict";

//////////////////////////////////////////
// Prey JS FileBrowser Plugin
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util     = require('util'),
    connect  = require('connect'),
    folder   = require('folder'),
    sendfile = require('serve-static'),
    Emitter  = require('events').EventEmitter,
    Tunnel   = require('tuna'),
    common   = require('./../../common');

var FileBrowser = function(options){

  var self = this;
  this.options = options || {};

  this.tunnel_host = this.options.host || 'localhost';
  this.tunnel_port = this.options.port || 9996;

  // open: first we open the tunnel, then we run the command
  // close: first we close the tunnel, then we kill the command

  this.start = function(callback){

    var default_root = (common.os_name === 'windows') ? "C:\\"
                       : common.os_name == 'mac' ? '/Users' : '/home';

    var root_path = this.options.root_path || default_root;

    var directory_options = {
      hidden: this.options.show_hidden || false,
      icons: this.options.show_icons || true
    };

    var app = connect()
             // .use(connect.logger())
              .use(folder(root_path, directory_options))
              .use(sendfile(root_path));

    var returned = false,
        opened   = false;

    var done = function(err) {
      if (returned) return;
      returned = true;

      if (!opened)
        callback(err || new Error('Unable to connect.'))
      else
        callback(err, self);
    }

    this.server = app.listen(function(err) {
      if (err) return done(err);

      var server = this;

      var local_port = server.address().port;
      common.logger.info('Filebrowser server listening on port ' + local_port);

      self.tunnel = new Tunnel({
        local_port  : local_port, 
        remote_host : self.tunnel_host, 
        remote_port : self.tunnel_port
      });

      self.tunnel.on('opened', function(){
        common.logger.info('Tunnel is open!');
        done();
      });

      self.tunnel.on('closed', function(err){
        common.logger.info('Tunnel closed!');
        done(err);
        self.stop(err);
      });

      self.tunnel.open()
    });

  };

  this.stop = function(err){

    if (this.tunnel && this.tunnel.is_open()) {
      this.tunnel.close();
    } else if (this.server && this.server._handle) {
      this.server.close();
    }

    this.emit('end');
  };

};

util.inherits(FileBrowser, Emitter);

exports.start = function(options, callback){
  module.instance = new FileBrowser(options);
  module.instance.start(callback);
};

exports.stop = function(){
  module.instance && module.instance.stop();
};
