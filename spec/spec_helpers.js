var helpers = {};

helpers.should = require('should');
helpers.sinon  = require('sinon');

/*
helpers.base   = require('./../lib');

helpers.base.providers.map(function(){
  console.log('Providers loaded.')
}); // attaches providers
helpers.providers = helpers.base.providers;
*/

helpers.load = function(module_name){
  return require('./../lib/agent/' + module_name);
}

module.exports = helpers;
