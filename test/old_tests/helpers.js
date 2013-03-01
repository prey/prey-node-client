var sinon   = require('sinon'),
    should  = require('should'),
    needle  = require('needle'),
    helpers = {};

console.log(' == NODE VERSION: ' + process.version);

helpers.path   = require('path');
helpers.sinon  = sinon;
helpers.must   = should;

/*
helpers.base   = require('./../lib');

helpers.base.providers.map(function(){
  console.log('Providers loaded.')
}); // attaches providers
helpers.providers = helpers.base.providers;
*/

/*helpers.load = function(module_name){
  return require('./../lib/agent/' + module_name);
}

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

module.exports = helpers;*/
