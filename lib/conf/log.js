var fs     = require('fs'),
    shared = require('./shared'), 
    paths  = require('../system/paths'),
    copy   = require('./utils/cp').cp;

var logfile = paths.log_file;

var read = function(file) {
  var stream = fs.createReadStream(file);
  stream.on('data', shared.log);
  stream.on('error', function(err) {  
    shared.log(err.message);
  });
}

exports.write = function(values, cb) {
  var output = values['-o'] && values.positional[0];
  if (!output)
    return read(logfile);

  copy(logfile, output, function(err) {
    if (err) return cb(err);

    shared.log('Successfully dump log contents to ' + output);
    // cb();
  });

}