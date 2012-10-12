
"use strict";

//////////////////////////////////////////
// Prey JS Network Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////


/**
 * Memoize nic functions but not access point stuff as that can change - probably best
 * to always do a scan with these.
 **/

var common = _ns('common'),
hardware = _ns('hardware'),
http = require('http'),
async = require('async'),
os_functions = require('./platform/' + common.os_name),
self = module.exports;

/**
 * Checks for a valid ip_address format.
 **/
self.is_ip_address = function(str){
  var regexp = /^((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})$/;
  return regexp.test(str);
};

/**
 * Makes an Http connection to checkip.dyndns.org to find current public IP.
 **/
self.get_public_ip = async.memoize(function(callback){  
  var
  regex = /Current IP Address: (\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b)/,
  host = 'checkip.dyndns.org';
  
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
    return callback(_error(err));
  });  
},function() { return "key"; });

self.get_public_ip.report = "Public IP";

/**
 * Callsback an internal IP address.
 **/
self.get_private_ip = async.memoize(function(callback) {
  hardware.get_network_interfaces_list(function(err, list){
    if(err) return callback(_error(err));

    var ips = list.filter(function(nic) { return self.is_ip_address(nic.ip_address); });      
    if (ips.length > 0)
      callback(null,ips[0].ip_address);
    else
      callback(_error('No private IP',"#interfaces"+list.length));
  });
},function() { return "key"; });

self.get_private_ip.report = "Private IP";

/**
 * Delegate entirely to os_functions
 * @param {String} platform specific name, e.g. eth0, Local Area Connection
 **/
self.get_broadcast_address = function(nic_name, callback){
  hardware.get_broadcast_address(nic_name,callback);
};

/**
 * @param {String} platform specific name, e.g. eth0, Local Area Connection
 **/
self.get_nic_by_name = async.memoize(function(name, callback) {
  hardware.get_network_interfaces_list(function(err, list){
    if(err) return callback(_error(err));

    var nics = list.filter(function(nic) { return nic.name === name; });
    if (nics.length > 0)
      callback(null,nics[0]);
    else
      callback(_error('No named nic',name));
  });
});

/**
 * Callsback a nic object with broadcast address.
 **/
self.get_active_network_interface = async.memoize(function(callback){
  os_functions.active_network_interface_name(function(err, nic_name) {
    self.get_nic_by_name(nic_name, function(err, nic){
      if(err) return callback(_error(err));

      hardware.get_broadcast_address(nic_name, function(err, bc_address){
        if(!err) nic.broadcast_address = bc_address;
        callback(null, nic);
      });
    });
  });
},function() { return "key"; });

self.get_active_network_interface.report = "Active Network Interface";

/**
 * Callsback an array of names of wireless interfaces
 **/
self.get_wireless_interface_names = function(callback){
  os_functions.wireless_interface_names(callback);
};

/**
 * Callsback at least one wireless interface name.
 **/
self.get_first_wireless_interface = function(callback){
  self.get_wireless_interface_names(function(err, list){
    if(err)
      callback(_error(err));
    else if(list && list[0])
      callback(null, list[0]);
    else
      callback(_error('No wifi interfaces'));
  });
};

/**
 * Callsback a MAC address of a wireless AP.
 **/
self.get_active_access_point = function(callback){
  
  os_functions.active_access_point(function(err,ap) {
    if(err) return callback(_error(err));

    self.get_access_points_list(function(err,accessPoints) {
      if (err) return callback(_error(err));
      
      var padded_mac = ap.toString().trim().replace(/(^|:)(?=[0-9a-fA-F](?::|$))/g, "$10");
      var aps = accessPoints.filter(function(ap) { return ap.mac_address === padded_mac; });
      if (aps.length > 0) {
        callback(null, aps[0]);
      } else {
        callback(_error('No valid access point',padded_mac));
      }
    });
  });
};

self.get_active_access_point.report = "Active Access Point";

/**
 * 
 **/
self.get_access_points_list = function(callback){
  self.get_first_wireless_interface(function(err, wifi_nic_name){
    if(err) return callback(_error(err));

    os_functions.access_points_list(wifi_nic_name, function(err, result){
      if(err) return callback(_error(err));
      
      else if(result instanceof Object)
        return callback(null, result);
    });
  });
};

self.get_access_points_list.report = "Access Points";

/**
 * Callback an array of open access points, sorted by signal strength.
 * If none exist, return the empty array.
 **/
self.get_open_access_points_list = function(callback){
  self.get_access_points_list(function(err, list){
    if(err) return callback(_error(err));

    var open_aps = list.filter(function(ap) { return ap.security === false; });
    if(open_aps.length === 0)
      return callback(null,[]);

    // sort them from the nearest to the farthest
    open_aps.sort(function(a, b){
      return a.signal_strength > b.signal_strength;
    });
    callback(null, open_aps);
  });
};


