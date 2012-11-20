#!/usr/bin/env node

var execFile = require('child_process').execFile;

var pre_uninstall = function() {

  execFile('/../conf/index.js', ['pre-uninstall'], function(err){
    if (err) {
      console.log(err);
      process.exit(1);
    }
  });

}

// if (!process.env.DEV)
  pre_uninstall();
