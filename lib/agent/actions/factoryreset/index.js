const { put } = require('needle');

var os       = require('os'),
    path     = require('path'),
    join     = path.join,
    Emitter  = require('events').EventEmitter,
    common   = require('../../common'),
    commands = require('../../commands'),
    logger   = common.logger.prefix('factoryreset'),
    system   = require('./../../../system');

var emitter,
    action;

var node_bin = join(system.paths.current, 'bin', 'node');
var file_factory_reset = join(system.paths.current, 'lib', 'agent','actions','factoryreset','file','factory-reset.ps1');


var time_execution  = () => {
  var now = new Date();
  now.setMinutes(now.getMinutes() + 2); 
  now = new Date(now); 
  var time = (now.getHours()>9?now.getHours():"0".concat(now.getHours())) + ":" + (now.getMinutes()>9?now.getMinutes():"0".concat(now.getMinutes()))  ;
  return time;

}


exports.start = function(id, opts, cb) {
  var os_name = os.platform().replace('darwin', 'mac').replace('win32', 'windows');

  if (os_name != 'windows')
    return cb(new Error('Action only allowed on Windows 1O'));

  var opts = opts || {};
  if (!opts)
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
    logger.info('Factory Reset Process initialized! err:' + JSON.stringify(err));
    logger.info('Factory Reset Process initialized! out:' + JSON.stringify(out));
    var output = null;

    if (!err) {
      commands.perform({command: 'get', target: 'encryption_status'})
      commands.perform({command: 'get', target: 'encryption_keys'})
      
      output = {}
      if (!out) return emitter.emit('end', id);

      if(out && out.error)
      logger.warn("Error executing Factory reset : " + out.message );

    }

    if (!emitter) return;
    logger.info('existe emmiter :' + JSON.stringify(emitter));
    logger.info('existe emmiter :' + JSON.stringify(id));
    logger.info('existe emmiter :' + JSON.stringify(err));
    logger.info('existe emmiter :' + JSON.stringify(output));
    return emitter.emit('end', id, err, output);
  }

  emitter = new Emitter;
  cb(null, emitter);

  system.spawn_as_admin_user(node_bin, data, function(err, child) {

    logger.info('spawn_as_admin_user node_bin :' + JSON.stringify(node_bin));
    logger.info('spawn_as_admin_user data :' + JSON.stringify(data));
    
    if (typeof child == 'function') {  // only for windows

    logger.info('spawn_as_admin_user action :' + JSON.stringify(action));
    logger.info('spawn_as_admin_user child :' + JSON.stringify(child));


      child(action, data, finished);
    } else {
      return finished(new Error("Admin service not available"));
    }
  })
}

exports.stop = function(){
  emitter = null;
}
