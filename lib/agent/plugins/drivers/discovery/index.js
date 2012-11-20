
"use strict";

//////////////////////////////////////////
// Prey Discovery Driver
// Written by Tomas Pollak
// (c) 2011, Fork Ltd. http://forkhq.com
// Licensed under the GPLv3
//////////////////////////////////////////

var logger = _ns('common').logger,
    mdns = require('mdns'),
    dgram = require("dgram"),
    Network = _ns('network'),
    Emitter = require('events').EventEmitter,
    util = require('util'),
    instance;

var DiscoveryDriver = function(){

  var self = this;
  this.local_clients = [];
  this.running = false;

  this.log = function(str){
    logger.info("[discovery] " + str);
  };
  
  this.load = function(options){
    
    var self = this;
    this.config = options;

    this.find_clients();
    this.start_server(function(server){

      var address = server.address();
      self.log("Listener up on " + address.address + ":" + address.port);

      self.advertise_service();
      self.running = true;

    });

  };
  
  this.unload = function(){
    if(this.server) this.server.close();
    if(this.advertiser) this.advertiser.close();
    if(this.browser) this.browser.close();
  };
  
  this.advertise_service = function(){

    var type = 'udp';
    this.advertiser = mdns.createAdvertisement(type, this.listen_port);
    this.advertiser.start();
  
  };

  this.find_clients = function(){

    this.browser = mdns.createBrowser('udp');

    this.browser.on('serviceUp', function(info, flags) {
      instance.log("Up: " + util.inspect(info));
      instance.check_client(info.host, info.port);
    });

    this.browser.on('serviceDown', function(info, flags) {
      instance.log("Down: " + util.inspect(info));
    });

  };

  this.get_client_info = function(){
    Network.get_active_network_interface(function(nic){
      self.client_info = {
        ip: nic.ip_address,
        mac: nic.mac_address
      };
    });
  };

  this.response_info_data = function(){
    return JSON.stringify({
      event: 'response_info',
      data: this.client_info
    });
  };

  this.handle_remote_message = function(data, peer){
    var message;
    try {
      message = JSON.parse(data);
    } catch(e) {
      return this.log("Malformed message received: " + data);
    }

    this.log("Got message: " + message.event + ", data: " + message.data);

    if(message.event === 'request_info' && this.client_info)
      this.send_message(this.response_info_data, peer.host, peer.port);
    else if(message.event === 'response_info')
      this.local_net_clients.push(message.data);
    else // if(message.event == 'command')
      this.handle_incoming_command(message.event, message.data);

  };

  this.start_server = function(callback){

    this.get_client_info();

    var server = dgram.createSocket("udp4");

    server.on("message", function(data, peer) {
      self.log("Received: " + data + " from " + peer.address + ":" + peer.port);
      self.handle_remote_message(data, peer);
    });

    server.on('error', function(err){
      console.log("Error: " + err.code);
    });

    server.on('close', function(err){
      if(err) return callback(_error(err));
      
      console.log("Server closed.");
      self.running = false;
    });

    server.on("listening", function(){
      callback(server);
    });

    server.bind(this.config.listen_port, this.config.listen_address);
    this.server = server;

  };

  this.check_client = function(host, port){
    this.send_message('request_info', host, port, function(err, bytes){
      self.log(bytes + " bytes sent to " + host);
    });
  };

  this.send_message = function(message, host, port, callback){

    if(typeof port === 'function'){
      callback = port;
      port = this.listen_port;
    }

    var socket = dgram.createSocket('udp4'),
        buffer = new Buffer(message);

    socket.on("error", function(err) {
      if(callback) callback(err);
    });

//      socket.on("message", function(data, peer) {
//        callback(null, data);
//      });

    this.log("Sending " + buffer.length + " byte message to " + host + " at " + port);

    socket.send(buffer, 0, buffer.length, port, host, function(err, bytes) {
      if(err) console.log(err);
      if(callback) callback(err, bytes);
      socket.close();
    });

  };
  
  this.handle_incoming_command = function(event, data){
    console.log("Got message: " + event);
  };

};

util.inherits(DiscoveryDriver, Emitter);
// module.exports = new DiscoveryDriver();


exports.load = function(options,callback){
  instance = new DiscoveryDriver(options);
  instance.load();
  callback(null, instance);
};

exports.unload = function(){
  instance.unload();
};