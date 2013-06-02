var crypto = require('crypto');

var algorythm = 'aes-256-cbc';
var iv = 'scribblescrobble';

var transform = function(m, str, pass, from, to) {
  var key = crypto.createHash('sha256').update(pass).digest();
  var cipher = crypto[m](algorythm, key, iv);
  cipher.update(str, from);
  return cipher.final(to);
}

exports.encrypt = function(str, pass) {
  return transform('createCipheriv', str, pass, 'ascii', 'hex')
}

exports.decrypt = function(str, pass) {
  return transform('createDecipheriv', str, pass, 'hex', 'ascii')
}

exports.use = function(which) {
  algorythm = which;
}
