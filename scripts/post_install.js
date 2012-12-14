#!/usr/bin/env node

// this script is executed by npm after an 'npm install prey'
// and calls the conf module to set up config and execution triggers

var fs = require('fs'),
    execFile = require('child_process').execFile,
    prey_bin = __dirname + '/../bin/prey',
    args = ['config', 'activate'],
    line = '\n=====================================================\n';

var post_install = function(){

  if (process.getuid() != 0) {
    var msg =  'You are running this script as an unprivileged user';
       msg +=  '\nso we cannot continue with the system configuration.';
       msg +=  '\nTo finalize the install process please run: \n\n';
       msg +=  '  $ sudo scripts/post_install.js';
    console.log(line + msg + line);
    process.exit(1);
  }

   // make sure the executable exists before setting up any triggers

  execFile(prey_bin, args, function(err, stdout, stderr){
    if (stdout.length > 0) console.log(stdout);
    if (stderr.length > 0) console.log(stderr);

    if (err) return console.log(err);
    console.log("System setup successful! You can run Prey now.");
  });

}

if (!process.env.BUNDLE_ONLY)
  post_install();
