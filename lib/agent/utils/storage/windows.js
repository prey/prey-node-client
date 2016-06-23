var regedit = require('regedit');

exports.save_command = function(db_path, str, cb) {
  var values = {
    'HKCU\\Software\\MySoftware': {
      'someNameIDontCareAbout': {
        value: 'Must be a string',
        type: 'REG_DEFAULT'
      },
      'myValue2': {
        value: 'aString',
        type: 'REG_SZ'
      }
    }
  }
  regedit.putValue(values, function (err) {
    if (err) {
      console.log("ERROR: ", err);
    }   
  })
}

exports.remove_command = function(db_path, cb) {

}

exports.load_commands = function(db_path, cb) {

}