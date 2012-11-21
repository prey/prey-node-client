#!/usr/bin/env node

// this program installs required dependencies and calls the conf
// module for finishing the installation

var execFile = require('child_process').execFile,
    prey_bin = require('../lib/system').paths.prey_bin,
    line = '\n=====================================================\n';

var post_install = function(){

  execFile('./install_deps.js', function(err){

    if (err) return console.log(err);
    console.log('Dependencies in place!')

    if (process.getuid() != 0) {
      var msg =  'You are running this script as an unprivileged user';
         msg +=  '\nso we cannot continue with the system configuration.';
         msg +=  '\nTo finalize the install process please run: \n\n';
         msg +=  '  $ sudo scripts/post_install.js';
      console.log(line + msg + line);
      process.exit(0)
    }

    // make sure the executable exists before setting up any triggers

    fs.exists(prey_bin, function(exists){

      if (!exists) {
        var msg = "We couldn't find the Prey executable in " + prey_bin;
           msg += "\nIf you installed the package locally, then you need to";
           msg += "\nlink it to the global path by running\n\n  $ sudo npm link\n";
           msg += "\nOnce you're done please run this script again.";
        console.log(line + msg + line);
        process.exit(1);
      }

      execFile('../lib/conf/index.js', ['post-install'], function(err, stdout, stderr){
        if (stdout.length > 0) console.log(stdout);
        if (stderr.length > 0) console.log(stderr);

        if (err) return console.log(err);
        console.log("System setup successful! You can run Prey now.");
      });

    });

  });

}

if (!process.env.BUNDLE_ONLY)
  post_install();
