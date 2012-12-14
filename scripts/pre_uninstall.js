#!/usr/bin/env node

var execFile = require('child_process').execFile,
    prey_bin = __dirname + '/../bin/prey',
    args = ['config', 'deactivate'];

var pre_uninstall = function() {

  execFile(prey_bin, args, function(err, stdout, stderr){
    if (stdout.length > 0) console.log(stdout);
    if (stderr.length > 0) console.log(stderr);

    if (err) {
      console.log(err);
      process.exit(1);
    }
  });

}

// if (!process.env.DEV)
  pre_uninstall();
