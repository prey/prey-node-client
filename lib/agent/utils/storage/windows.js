var regedit = require('regedit');

exports.save_command = function(db_path, str, cb) {
  regedit.createKey('HKLM\\SOFTWARE\\Prey\\Commands', function(err){
    if (err) {
      console.log("ERROR CREATEKEY:", err);
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
        console.log("ERROR regedit: ", err);
      }   
    })
  })
}

exports.remove_command = function(db_path, cb) {
  console.log("REMOVE COMMAND");
  /*
  regedit.deleteKey('HKLM\\SOFTWARE\\Prey\\Commands', function (err) {
    if (err) {
      console.log("ERROR deleteKey:", err);
    }   
  })
  */
}

exports.load_commands = function(db_path, cb) {
  regedit.list('HKLM\\SOFTWARE\\Prey\\Commands', function(err, result){
    if (err) {
      console.log("ERROR list:", err)
    }
    var values = result['HKLM\\SOFTWARE\\Prey\\Commands'].values['Prey_Command'].value;
    console.log("COMMANDS!!!!:", values);
  })
}