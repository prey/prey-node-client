var fs = require('fs'),
    unzip = require('unzip');

module.exports = function(from, to, callback) {
  var is = fs.createReadStream(from),
      extractor = unzip.Extract({ path: to });

  extractor.on('close', callback);
  extractor.on('error', callback);
  is.pipe(extractor);
};
