var unzip = require('unzip');

module.exports = function(from, to, callback) {
  var is = fs.createReadStream(from),
      extractor = unzip.Extract({ path: to });

  extractor.on('end', callback);
  extractor.on('error', callback);
  is.pipe(extractor);
};
