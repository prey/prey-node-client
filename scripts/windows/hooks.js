"use strict";

var 
    exec = require('child_process').exec,
    common = _ns('common');

var service_exists = function(callback) {
    var cmd = 'sc qc prey';
    exec(cmd,function(err,stdout) {
        if(err) return callback(_error(err));

        callback(null,stdout.indexOf("SUCCESS") !== -1);
    });
};

var service_delete = function(callback) {
    var cmd = 'sc delete prey';
    exec(cmd,function(err,stdout) {
        if(err) return callback(_error(err));

        callback(null,stdout.indexOf("SUCCESS") !== -1);
    });
};

var service_create = function(callback) {
    var binPath = common.root_path + 'bin/PreyCronService.exe',
        cmd = 'sc create prey binPath= '+binPath;

    exec(cmd,function(err,stdout) {
        if(err) return callback(_error(err));

        callback(null,stdout.indexOf("SUCCESS") !== -1);
    });
};

/**
 * Callback the service PID if all is well, else null.
 **/
var service_start = function(callback) {
    var cmd = 'sc start prey';
    exec(cmd,function(err,stdout) {
        if(err) return callback(_error("!:"+cmd,err));

        var m = stdout.match(/PID\s+?:\s([0-9]+?)\s/);

        if (!m) return callback(null,null);

        callback(null,m[1]);
    });  
};

var create_and_start = function(callback) {
    service_create(function(err,success) {
      if(err) return callback(_error(err));
      if (success) {
          service_start(function(err,success) {
            if(err) return callback(_error(err));

            callback(null,success);
        });
      }
    });
};

exports.post_install = function(callback){
    service_exists(function(err,exists) {
        if(err) return callback(_error(err));
    
        if (exists) {
          service_delete(function(err,success) {
            if(err) return callback(_error(err));
            
            create_and_start(function(err,success) {
                callback(null);
            });
          });
        }

    });
};

exports.pre_uninstall = function(callback){
	callback();
}


