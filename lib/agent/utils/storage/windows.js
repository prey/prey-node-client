var regedit = require('regedit');
var logger  = require('./../../common').logger.prefix('actions');
var db;
var values = {};

exports.save_command = function(db_path, str, cb) {
  logger.info("SAVE COMMAND!!!!");
  values[db_path] = {
    'Prey_Command': {
      value: str,
      type: 'REG_SZ'
    }
  };
  regedit.createKey(db_path, function(err){
    if (err) {
      logger.info("ERROR CREATEKEY: " + err);
    }
    regedit.putValue(values, function(err) {
      if (err) {
        logger.info("ERROR regedit: " + err);
      }   
    })
    return cb();
  })
}

exports.remove_commands = function(db_path, cb) {
  logger.info("REMOVE COMMAND");
  regedit.deleteKey(db_path, function(err) {
    var e = err && err.code != 'ENOENT' ? err : null;
    return cb && cb(e);
    // if (err) {
    //   logger.infologger.info("ERROR deleteKey:", err);
    // }
    // return cb();   
  })
  //cb();
}

exports.load_commands = function(db_path, cb) {
  regedit.list(db_path, function(err, result){
    if (err) {
      if (err.code != 'ENOENT')
        return cb({}, err); // only return error if different from ENOENT

      db = {};
      //return db;
    }
    try {
      var values = result[db_path].values['Prey_Command'].value;
      db = JSON.parse(new Buffer(values, 'base64').toString());
    } catch(e) {
      db = {};
    }
    return cb(db, null);
  })
}