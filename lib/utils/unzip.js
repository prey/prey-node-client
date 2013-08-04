var fs      = require('fs'),
    unzip   = require('unzip');

module.exports = function(from, to, cb) {
  console.log('Unzipping ' + from + ' to ' + to);
  
  var is        = fs.createReadStream(from),
      extractor = unzip.Extract({ path: to }),
      returned  = false,
      done      = function(err) {
        if (returned) return;
        cb(err);
        returned = true;
      }

  extractor.on('close', done);
  extractor.on('error', done);
  is.pipe(extractor);
};
