/* 
TODO:
- General clean-up
- Write tests
- Test support for PLAINTEXT signatures
- Support for realms
*/

var querystring = require('querystring'), 
    crypto      = require('crypto');

// Utility: Generate a random string to use as nonce
function getNonce(len) {
  var nonce = [];
  var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
  for (var i = 0; i < (len ? len : 32); i++) {
    var pos = Math.floor(Math.random()*chars.length);
    nonce.push(chars.substr(pos,1));
  }
  return(nonce.join(''));
}

// Utility: URL encoding is slightly complex in the OAuth spec
function uriEncode(s) {
  var s= encodeURIComponent(s);
  return s.replace(/\!/g, "%21")
          .replace(/\'/g, "%27")
          .replace(/\(/g, "%28")
          .replace(/\)/g, "%29")
          .replace(/\*/g, "%2A");
}

// Utility: Mix content of one object into another (1:1 dublicate from restler.js; can be eliminated)
function mixin(target, source) {
  Object.keys(source).forEach(function(key) {
    target[key] = source[key];
  });
  
  return target;
}

// This function returns a fully signed Authorization header based on 
// the restler request. Note that the code relies on pre-parsing done
// by resler beforehand; and notably that `url` is a parsed object, 
// not a string.
exports.signature = function(url, options){
  // Default some options
  options.oauthSignatureMethod = options.oauthSignatureMethod||"HMAC-SHA1"

  // 1. NORMALIZE URL
  // Turn protocol into lower case
  var normalizedURL = [
                       url.protocol.toLowerCase(), 
                       '//', url.hostname, 
                       ((url.protocol==='http:' && url.port==='80') || (url.protocol==='https:' && url.port==='443') ? '' : ':' + url.port),
                       url.pathname
                       ].join('');

  // 2. NORMALIZE PARAMS (not sure if this is needed by restler, but good as a general approach)
  var params = querystring.parse(url.query);
  if (!options.multipart) mixin(params, querystring.parse(options.data));
  params['oauth_timestamp'] = Math.round((+(new Date)/1000));
  params['oauth_nonce'] = getNonce();
  params['oauth_version'] = '1.0';
  params['oauth_signature_method'] = options.oauthSignatureMethod;
  params['oauth_consumer_key'] = options.oauthConsumerKey;
  params['oauth_token'] = options.oauthAccessToken||'';
  // order by parameter name
  var keys = [];
  for(var key in params) keys.push(key);
  keys.sort();
  // build a normalized querystring
  var normalizedParts = [];
  keys.forEach(function(key){
      normalizedParts.push([uriEncode(key), '=', uriEncode(params[key])].join(''));
    });
  normalizedParams = normalizedParts.join('&')

  // 3. Create a base string for signatures
  var signatureBaseString = [options.method.toUpperCase(), uriEncode(normalizedURL), uriEncode(normalizedParams)].join('&');
  //debugging// console.log(signatureBaseString);

  // 4. And actually sign the string
  var signatureSecret = [uriEncode(options.oauthConsumerSecret||''), uriEncode(options.oauthAccessTokenSecret||'')].join('&');
  if (options.oauthSignatureMethod==="HMAC-SHA1") {
    var hash = uriEncode(crypto.createHmac("sha1", signatureSecret).update(signatureBaseString).digest("base64"));
  } else {
    var hash = uriEncode(signatureSecret);
  }

  // 5. Build the Authentication 
  // select out the relevant heders, and build yet another string
  var normalizedHeaderParts = [];
  keys.forEach(function(key){
      if(key.match(/^oauth_/)) {
        normalizedHeaderParts.push([uriEncode(key), '="', uriEncode(params[key]), '"'].join(''));
      }
    });
  normalizedHeaderParts.push(['oauth_signature="', hash, '"'].join(''));
  normalizedHeader = 'OAuth ' + normalizedHeaderParts.join(', ');
  
  // 6. Finally return our header
  return(normalizedHeader);
}