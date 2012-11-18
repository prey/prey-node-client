#!/usr/bin/env node

var shared = require('./shared');

var pre_uninstall = function() {

  shared.run_script('/../conf/index.js --pre-uninstall', function(err){
    if (err) {
      console.log(err);
      process.exit(1);
    }
  });

}

// if (!process.env.DEV)
  pre_uninstall();
