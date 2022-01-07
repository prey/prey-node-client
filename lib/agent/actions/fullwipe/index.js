var os       = require('os'),
    path     = require('path'),
    join     = path.join,
    Emitter  = require('events').EventEmitter,
    common   = require('../../common'),
    logger   = common.logger.prefix('fullwipe'),
    token   = require('./../../token'),
    system   = require('./../../../system'),
    exec = require('child_process').exec;

var emitter,
    action,
    node_bin = join(system.paths.current, 'bin', 'node');


exports.start = function(id, opts, cb) {
  var os_name = os.platform().replace('darwin', 'mac').replace('win32', 'windows');
  if (os_name != 'windows')
    return cb(new Error('Action only allowed on Windows 1O'));

  var opts = opts || {};
  if (!opts || id == undefined || opts.token == undefined || opts.target == undefined)
    return cb(new Error("The fullwipe data is not valid"));

    token.post_token({action : opts.target, token : opts.token, id : opts.messageID },(err) => {
      emitter = new Emitter;
      cb(null, emitter);
      if (err) return finished(err);

      var data = {
        key: "device-key",
        token: "token",
        logged: false,
        dirs : []
      }
    
      action = 'full-wipe';

      system.spawn_as_admin_user(node_bin, data, function(err, child) {
    
        if(err){
          logger.info('Error executing Full Wipe :' + JSON.stringify(err));
        }
        if (typeof child == 'function') {  // only for windows
          child(action, data, finished);
        } else {
          return finished(new Error("Admin service not available"));
        }
      })
    })

  var finished = function(err, out) {
    logger.info('Full Wipe Process initialized!');
    var output = null;

    if (!err) {
      output = {};
      if (!out) return emitter.emit('end', id);

      if(out && out.error){
        output.data = 1;//error Fullwipe
        logger.warn("Error executing FullWipe: " + out.message );
      }
      else{
        output.data= 0;// full wipe ok 
        setTimeout(() => {
          exec('shutdown /s', function(err, stdout,stdouterr){
            if(err || stdouterr)
            logger.warn("Error shutdown :" + err + ',' + stdouterr );
          });
          }, 2 * 60 * 1000);
      }
      

    }
    if (!emitter) return;
    return emitter.emit('end', id, err, output);
  }
}

exports.stop = function(){
  emitter = null;
}
