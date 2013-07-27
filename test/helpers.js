var needle  = require('needle'),
    helpers = {};

console.log(' == NODE VERSION: ' + process.version);

helpers.load = function(module_name){
  return require('./../lib/agent/' + module_name);
}

helpers.load_util = function(module_name){
  return require('./../lib/utils/' + module_name);
}

/* 
  this helpers lets you fake requests using needle:
  
  helpers.stub_request('get', null, { statusCode: 200 }, 'OK' );
  helpers.stub_request('post', null, { statusCode: 401 }, 'Unauthorized' );
  helpers.stub_request('put', new Error('ENOENT'))
  
  then, when needle.(get|post|put) is called, it will return those (err, resp, body)
  and restore the original method.

*/

helpers.stub_request = function(type, err, response, body){

  var stub = sinon.stub(needle, type, function(){

    // look for callback
    var cb;

    for (var i = 0; i < arguments.length; i++) {
      if (typeof arguments[i] == 'function')
        cb = arguments[i];
    }

    cb(err, response, body);
    needle[type].restore();
  });

}

module.exports = helpers;