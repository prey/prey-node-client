var regedit = require('regedit');
var logger  = require('./../../common').logger.prefix('actions');

exports.init_command = function(db_path, cb) {
  regedit.createKey('HKLM\\SOFTWARE\\Prey\\Commands', function(err) {
    if (err) {
      logger.info("ERROR CREATEKEY:", err);
    }
    logger.info("AFTER CREATEKEY!!!!!!");
    cb();
  })
}

exports.save_command = function(db_path, str, cb) {
  logger.info("SAVE COMMAND!!!!");
  regedit.createKey('HKLM\\SOFTWARE\\Prey\\Commands', function(err){
    if (err) {
      logger.info("ERROR CREATEKEY: " + err);
    }
    regedit.putValue({
      'HKLM\\SOFTWARE\\Prey\\Commands': {
        'Prey_Command': {
          value: str,
          type: 'REG_SZ'
        }
      }
    }, function (err) {
      if (err) {
        logger.info("ERROR regedit: " + err);
      }   
    })
    cb();
  })
}

exports.remove_commands = function(db_path, cb) {
  logger.info("REMOVE COMMAND");
  regedit.deleteKey('HKLM\\SOFTWARE\\Prey\\Commands', function (err) {
    if (err) {
      logger.infologger.info("ERROR deleteKey:", err);
    }
    cb();   
  })
  //cb();
}

exports.load_commands = function(db_path, cb) {
  var db;
  regedit.list('HKLM\\SOFTWARE\\Prey\\Commands', function(err, result){
    if (err) {
      //console.log("ERROR list:", err)
      if (err.code != 'ENOENT')
        db = {};
        return cb(db, err); // only return error if different from ENOENT

      db = {};
      //return db;
    }
    try {
      var values = result['HKLM\\SOFTWARE\\Prey\\Commands'].values['Prey_Command'].value;
      db = JSON.parse(new Buffer(values, 'base64').toString());
    } catch(e) {
      db = {};
    }
    cb(db, null);
  })
}