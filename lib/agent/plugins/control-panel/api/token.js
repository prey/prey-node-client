"use strict";

var keys    = require('./keys'),
    errors  = require('./errors'),
    specs  = require('./specs'),
    //Emitter  = require('events').EventEmitter,
    hooks   = require('./../../../hooks'),
   storage = require('./../../../utils/storage'),
    needle   = require('needle');


    var host   = 'http://10.179.246.190',
        url   = host + '/verify';

    //var emitter;


exports.post_token = (opts, cb) => {
    if (!keys.get().api || !keys.get().device)
      return cb(errors.get('MISSING_KEY'));
  
    if (!opts)
      return cb(errors.arguments('Empty data.'));
   
    var exists_action = specs.actions.find(x => x==opts.action);
    
    if (!exists_action)
      return cb(null);
      //return cb(new Error("error provocado"));

    needle.post(url, { key : keys.get().device ,action : opts.action ,token : opts.token }, { json: true },function(err, resp, body) {
        
        if (err) {
          console.log(err);
          cb(err);
          return;
        }  
        if (resp.statusCode !== 200 ) {
            var err = new Error('There was an error communicating with the server api TOKEN');

            hooks.trigger('action', 'failed', opts.id, opts.action, opts, err);

            storage.do('update', { type: 'commands', id: opts.id, columns: ['started','stopped'], values: [new Date().toISOString(),new Date().toISOString()] }, (err) => {
                if (err) logger.warn("Unable to update stopped action timestamp for id:" + id)
            })
        
          cb(err);
          return;
        }
        console.log("getting token ok");
        cb(null); 
      })
    
  }