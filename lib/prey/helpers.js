"use strict";

var
  common = _ns('common'),
  util = require('util'),
  fs = require('fs'),
  path = require('path'),
  exec = require('child_process').exec;

exports.tempfile_path = function(filename){
  return common.os.temp_path + '/' + filename;
};

exports.run_as_logged_user = function(command, args, callback){
  var user = process.env.LOGGED_USER;
  if(!user || user === '') return callback(_error("Unable to find logged user!"));

  var args_str = (typeof args === 'string') ? args : args.join(' ');
  var cmd = [path.resolve(__dirname + '/runner.js'), user, command, args_str].join(' ');
  exec(cmd, callback);
};

exports.remove_pid_file = function(pid_file){
  fs.unlink(pid_file);
};

exports.store_pid = function(pid_file, callback){
  fs.stat(pid_file, function(err, stat){
    if (!err) {
      var pid = parseInt(fs.readFileSync(pid_file).toString());
      console.error("\nPrey seems to be running already! (PID: " + pid.toString() + ")");
      
      try {
        process.kill(pid, 0);
        return callback(null, {stat: stat, pid: pid});
      } catch(e) {
        if(e.code === 'ESRCH') console.error("Not really, pidfile was just lying around.");
      }
    }
    
    // if all was good, then callback(err) will be null
    fs.writeFile(pid_file, process.pid.toString(), callback);
  });
};

// returns true if first is greater than second
exports.is_greater_than = function(first, second){
  var a = parseFloat(first.replace(/\./g, ''));
  var b = parseFloat(second.replace(/\./g, ''));
  return a > b ? true : false;

};

exports.random_between = function(from, to){
  return Math.floor(Math.random() * (to - from + 1) + from);
};


exports.copy_file = function(src, dest, callback){
  var dest_file = path.resolve(dest);
  var dest_path = path.dirname(dest);

  var pump = function(){
    var input = fs.createReadStream(path.resolve(src));
    var output = fs.createWriteStream(dest_file);

    util.pump(input, output, function(err){
      // console.log('Copied ' + path.basename(src)  + ' to ' + dest);
      input.destroy();
      output.destroy();
      callback(err);
    });
  };

  var check_path_existance = function(dir){
    fs.exists(dir, function(exists){
      if(exists) return pump();

      // console.log("Creating directory: " + dir);
      fs.mkdir(dir, function(err){
        if(err) return callback(_error(err));
        pump();
      });
    });
  };

  fs.exists(dest_file, function(exists){
    if(exists) return callback(new Error("Destination file exists: " + dest_file));
    check_path_existance(dest_path);
  });
};

exports.remove_files = function(data){
  if(data.file && data.content_type)
    return exports.remove_file(data);

  for(var key in data){
    var val = data[key];
    if(!val) continue;
    if(val.file && val.content_type)
      exports.remove_file(val);
  }
};

exports.remove_file = function(file){
  fs.unlink(file.file);
};

/**
 * A modified async.memoize that takes into account errors.
 * If there's an error it will return the arguments as provided _and_ remove any existing memo.
 **/
exports.memoize = function (fn, hasher) {
  var memo = {};
  var queues = {};
  hasher = hasher || function (x) {
    return x;
  };
  var memoized = function () {
    var args = Array.prototype.slice.call(arguments);
    var callback = args.pop();
    var key = hasher.apply(null, args);
    if (key in memo) {
      callback.apply(null, memo[key]);
    }
    else if (key in queues) {
      queues[key].push(callback);
    }
    else {
      queues[key] = [callback];
      fn.apply(null, args.concat([function () {

        // if we don't have an error then cache ...
        // the assumption here is a callback always has an null/err as first param

        var q = queues[key];
        delete queues[key];
          
        if (arguments[0] === null) {
          memo[key] = arguments;
        } else {
          if (memo.key)
            delete memo[key]; // on error remove existing key
        }

        // process queued callbacks with the results of the call ...
        for (var i = 0, l = q.length; i < l; i++) {
          q[i].apply(null,arguments);
        }

      }]));
    }
  };
  memoized.unmemoized = fn;
  return memoized;
};

/**
 * Just a testing function to sub in for memoize if you don't want memoization
 **/
exports.memoize1 = function(fn) {
  return fn;
};


exports.report = function(fn) {
  fn.arity = 0;
  return fn;
};

exports.is_report = function(fn) {
  return "arity" in fn && fn.arity === 0;
};

