
"use strict";

//////////////////////////////////////////
// Prey JS Network Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
    http = require('http'),
    os_functions = require('./platform/' + common.os_name),
    Hardware = require('./../hardware');

var Network = function(){
  var self = this;

  /**
   * Checks for a valid ip_address format.
   **/
  this.is_ip_address = function(str){
    var regexp = /^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})$/;
    return regexp.test(str);
  };

  /**
   * Makes an Http connection to checkip.dyndns.org to find current public IP.
   **/
  this.get_public_ip = function(callback){

    var regex = /Current IP Address: (\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/;
    var host = 'checkip.dyndns.org';

    var req = http.get({host: host, path: '/'}, function(res){

        var html = '';

        res.on('data', function(chunk) {
          html += chunk;
        });

        res.on('end', function() {
          var ip = html.match(regex)[1];
          callback(null, ip);
        });

    });

    req.on('error', function(err){
      return callback(err);
    });

  };

  /**
   * Callsback an internal IP address.
   **/
  this.get_private_ip = function(callback){
    Hardware.get_network_interfaces_list(function(err, list){
      if(err) return callback(err);
      var ips = list.filter(function(nic) { return self.is_ip_address(nic.ip_address); });      
      if (ips.length > 0)
        callback(null,ips[0].ip_address);
      else
        callback(new Error("No private IP found in any of the " + list.length + " interfaces."));
    });
  };

  /**
   * Delegate entirely to os_functions
   * @param {String} platform specific name, e.g. eth0, Local Area Connection
   **/
  this.get_broadcast_address = function(nic_name, callback){
    Hardware.get_broadcast_address(nic_name,callback);
  };

  /**
   * @param {String} platform specific name, e.g. eth0, Local Area Connection
   **/
  this.get_nic_by_name = function(name, callback) {
    Hardware.get_network_interfaces_list(function(err, list){
      if(!list) return callback(err);
      var nics = list.filter(function(nic) { return nic.name === name; });
      if (nics.length > 0)
        callback(null,nics[0]);
      else
        callback(new Error("Couldn't find NIC named " + name));
    });
  };

  /**
   * Callsback a nic object with broadcast address.
   **/
  this.get_active_network_interface = function(callback){
    os_functions.active_network_interface(function(err, nic_name) {
      self.get_nic_by_name(nic_name, function(err, nic){
        if(err) return callback(err);
        Hardware.get_broadcast_address(nic_name, function(err, bc_address){
          if(!err) nic.broadcast_address = bc_address;
          callback(null, nic);
        });
      });
    });
  };

  /**
   * 
   **/
  this.get_first_wireless_interface = function(callback){
    self.get_wireless_interface_names(function(err, list){
      if(err)
        callback(err);
      else if(list && list[0])
        callback(null, list[0]);
      else
        callback(new Error('No wifi network interfaces found.'));
    });
  };

  /**
   * Callsback an array of names of wireless interfaces
   **/
  this.get_wireless_interface_names = function(callback){
    os_functions.wireless_interface_names(callback);
  };

  /**
   * Callsback a MAC address of a wireless AP.
   **/
  this.get_active_access_point = function(callback){
    os_functions.active_access_point(function(err,ap) {
      if(err) return callback(err);
      self.get_access_points_list(function(err,accessPoints) {
        var padded_mac = ap.toString().trim().replace(/(^|:)(?=[0-9a-fA-F](?::|$))/g, "$10");
        var aps = accessPoints.filter(function(ap) { return ap.mac_address === padded_mac; });
        if (aps.length > 0) {
          callback(null, aps[0]);
        } else {
          callback(new Error('Unable to find matching access point for MAC ' + padded_mac));
        }
      });
    });
  };

  /**
   * 
   **/
  this.get_access_points_list = function(callback){
    this.get_first_wireless_interface(function(err, wifi_nic_name){
      if(err) return callback(err);

      os_functions.access_points_list(wifi_nic_name, function(err, result){
        if(err)
          return callback(err);
        else if(result instanceof Object)
          return callback(null, result);
      });
    });
  };

  /**
   * Callback an array of open access points, sorted by signal strength.
   * If none exist, return the empty array.
   **/
  this.get_open_access_points_list = function(callback){
    self.get_access_points_list(function(err, list){
      if(err) return callback(err);

      var open_aps = list.filter(function(ap) { return ap.security === false; });
      if(open_aps.length === 0)
        return callback(null,[]);

      // sort them from the nearest to the farthest
      open_aps.sort(function(a, b){
        return a.signal_strength > b.signal_strength;
        // return parseInt(a.signal_strength) > parseInt(b.signal_strength)
      });
      callback(null, open_aps);
    });
  };
  
};

module.exports = new Network();
