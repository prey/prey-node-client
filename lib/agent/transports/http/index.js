
"use strict";

//////////////////////////////////////////
// Prey HTTP Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util   = require('util'),
    client = require('needle'),
    common = require('./../../common'),
    config = common.config,
    user_agent = common.user_agent,
    Transport = require('./../../transport');

var HTTPTransport = function(options){

  Transport.call(this, options);
  var self = this;
  this.name = 'http';

  this.options = options;
  this.url = options.url;
  this.method = options.method || 'post';

  this.send = function(data, callback){

    this.emit('start');

    var request_opts = {
      user_agent: user_agent,
      multipart: true,
      timeout: 20000,
      username: this.options.username,
      password: this.options.password
    };

    // if proxy url has been set, pass it in options
    if (this.proxy_url) request_opts.proxy = this.proxy_url;

    var host = this.url.replace(/.*\/\/([^\/]+).*/, "$1");
    this.log("Posting data to " + host);

    client[this.method](this.url, data, request_opts, function(err, response, body){

      if (!err){
        self.log('Response body: ' + body);
        self.log('Got status code: ' + response.statusCode);
      } else if (config.get('try_proxy') && !self.proxy_url){
        self.proxy_url = config.get('proxy_url');
        return self.send(data, callback);
      }

      callback(err, body);
      self.emit('end', err, data);

    });

  };

};

util.inherits(HTTPTransport, Transport);

exports.send = function(data, options, callback){
  var transport = new HTTPTransport(options);
  transport.send(data, callback);
};
