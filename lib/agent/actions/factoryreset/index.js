var os       = require('os'),
    path     = require('path'),
    join     = path.join,
    Emitter  = require('events').EventEmitter,
    common   = require('../../common'),
    commands = require('../../commands'),
    logger   = common.logger.prefix('factoryreset'),
    system   = require('./../../../system');

var emitter,
    action,
    node_bin = join(system.paths.current, 'bin', 'node'),
    file_factory_reset = join(system.paths.current, 'lib', 'agent','actions','factoryreset','bin','factory-reset.ps1');


var time_execution  = () => {
  var now = new Date();
  now.setMinutes(now.getMinutes() + 2); //add two minuts
  now = new Date(now); 
  datetext = now.toTimeString();
  var time = datetext.split(' ')[0];
  return time;

}

exports.start = function(id, opts, cb) {
  var os_name = os.platform().replace('darwin', 'mac').replace('win32', 'windows');

  if (os_name != 'windows')
    return cb(new Error('Action only allowed on Windows 1O'));

  var opts = opts || {};
  if (!opts || id == undefined)
    return cb(new Error("The factory reset data is not valid"))

  var data = {
    key: "device-key",
    token: "token",
    logged: false,
    dirs : [file_factory_reset,time_execution(),process.arch]
  }

  action = 'factory-reset';

  var finished = function(err, out) {
    logger.info('Factory Reset Process initialized!');
    var output = null;

    if (!err) {
      output = {};
      if (!out) return emitter.emit('end', id);

      if(out && out.error){
        output.data = 1;//error
        logger.warn("Error executing Factory reset : " + out.message );
      }
      else
      output.data= 0;// factory reset ok 

    }
    if (!emitter) return;
    return emitter.emit('end', id, err, output);
  }

  emitter = new Emitter;
  cb(null, emitter);

  system.spawn_as_admin_user(node_bin, data, function(err, child) {

    if(err){
      logger.info('Error executing Factory Reset :' + JSON.stringify(err));
    }
    if (typeof child == 'function') {  // only for windows
      child(action, data, finished);
    } else {
      return finished(new Error("Admin service not available"));
    }
  })
}

exports.stop = function(){
  emitter = null;
}
