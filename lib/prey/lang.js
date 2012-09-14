
exports.eachKey = function(obj,cb) {
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      cb(key) ;
    }
  }
}


exports.chomp = function(raw_text) {
  return raw_text.replace(/(\n|\r)+$/, '');
}