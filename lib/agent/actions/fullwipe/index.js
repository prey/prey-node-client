var os       = require('os'),
    path     = require('path'),
    join     = path.join,
    Emitter  = require('events').EventEmitter,
    common   = require('../../common'),
    logger   = common.logger.prefix('fullwipe'),
    token    = require('./../../token'),
    system   = require('./../../../system'),
    errors   = require('./../../errors').status;

var emitter,
    action,
    node_bin = join(system.paths.current, 'bin', 'node');

 exports.timeout = 2 * 60 * 1000;

exports.start = function(id, opts, cb) {
  var os_name = os.platform().replace('darwin', 'mac').replace('win32', 'windows');
  if (os_name != 'windows'){
    let error = new Error('Action only allowed on Windows 1O');
    error.code = 3;
    error.name = errors.find( x => x.status_code == error.code).message;
    return cb(error)
  }

  var opts = opts || {};
  if (!opts || id == undefined || opts.token == undefined || opts.target == undefined){
    let error = new Error('The fullwipe data is not valid');
    error.code = 2;
    error.name = errors.find( x => x.status_code == error.code).message;
    return cb(error);
    }

  var finished = function(err, out) {
    logger.info('Full Wipe Process initialized!');
    var output = null;

    if (!err) {
      output = {};
      if (!out) return emitter.emit('end', id);

      if(out && out.error){
        output.data = 1;//error Fullwipe
        output.message = out.message;
        logger.warn("Error executing FullWipe: " + out.message );
        err = new Error('Admin service Error');
        err.code = 4;
        err.name = errors.find( x => x.status_code == err.code).message;
      }
      else{
        output.data= 0;// full wipe ok 
        output.message = "OK";
      }
    }
    if (!emitter) return;
    return emitter.emit('end', id, err, output);
  }

    token.post_token({action : opts.target, token : opts.token, id : opts.messageID },(err) => {
 
      if (err) {
        let error = err;
        error.code = 5;
        error.name = errors.find( x => x.status_code == error.code).message;
        return cb(error);
      }

      var data = {
        key: "device-key",
        token: "token",
        logged: false,
        dirs : []
      }
    
      action = 'full-wipe';

      emitter = new Emitter;
      cb(null, emitter);

      system.spawn_as_admin_user(node_bin, data, function(err, child) {
    
        if(err){
          logger.info('Error executing Full Wipe :' + JSON.stringify(err));
        }
        if (typeof child == 'function') {  // only for windows
          child(action, data, finished);
        } else {
          let error = new Error('Admin service not available');
          error.code = 4;
          error.name = errors.find( x => x.status_code == error.code).message;
          return cb(error);
        }
      })
    })
}

exports.stop = function(){
  emitter = null;
}
