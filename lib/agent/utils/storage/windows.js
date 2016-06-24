var regedit = require('regedit');

exports.save_command = function(db_path, str, cb) {
  console.log("SAVE COMMAND!!!");
  regedit.putValue({
    'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System': {
      'Prey_Commands': {
        value: 1,
        type: 'REG_DWORD'
      }
    }
  }, function (err) {
    if (err) {
      console.log("ERROR regedit: ", err);
    }   
  })
}

exports.remove_command = function(db_path, cb) {

}

exports.load_commands = function(db_path, cb) {

}