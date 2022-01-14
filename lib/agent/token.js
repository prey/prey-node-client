"use strict";

var keys    = require('./plugins/control-panel/api/keys'),
    errors  = require('./plugins/control-panel/api/errors'),
    specs  = require('./reports/actions'),
    needle   = require('needle');

    const host   = 'http://10.179.246.190',
          url    = host + '/token/v2/check';

exports.post_token = (opts, cb) => {
    if (!keys.get().api || !keys.get().device)
      return cb(errors.get('MISSING_KEY'));
  
    if (!opts)
      return cb(errors.arguments('Empty data.'));
   
    var exists_action = specs.actions.find(x => x == opts.action);

    if (!exists_action)
      return cb(null);

    needle.post(url, { key : keys.get().device ,action : opts.action ,token : opts.token }, { json: true },function(err, resp, body) {

        if (err) 
          return cb(err);
        
        if (resp.statusCode !== 200 ) {
          var err = new Error('There was an error communicating with the server api Token');
          return cb(err);
        }
        console.log("getting token ok");
        return cb(null); 
      })
    
  }