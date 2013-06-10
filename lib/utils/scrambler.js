var crypto = require('crypto');

var algorythm = 'aes-256-cbc';
var iv = 'scribblescrobble';

var transform = function(m, str, pass, from, to) {
  var key = crypto.createHash('sha256').update(pass).digest();
  var cipher = crypto[m](algorythm, key, iv);
  //cipher.update(str, from);
  //return cipher.final(to);

  var response = cipher.update(str, from, to);
  response += cipher.final(to);
  return response;
}

exports.encrypt = function(str, pass) {
  return transform('createCipheriv', str, pass, 'utf8', 'hex')
}

exports.decrypt = function(str, pass) {
  try {
  return transform('createDecipheriv', str, pass, 'hex', 'utf8')
  } catch(e) {
    // console.log('Error: ' + e.message);
  }
}

exports.use = function(which) {
  algorythm = which;
}
