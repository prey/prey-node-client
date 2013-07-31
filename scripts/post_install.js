#!/usr/bin/env node

// this script is executed by npm after an 'npm install prey'
// and calls the conf module to set up config and execution triggers

var join        = require('path').join,
    exec        = require('child_process').exec,
    execFile    = require('child_process').execFile,
    fs          = require('fs'),
    prey_bin    = join(__dirname, '..', 'bin', 'prey'),
    args        = ['config', 'hooks', 'post_install'],
    is_windows  = process.platform === 'win32';

var line = '\n=====================================================\n';

var post_install = function(){

  if (!is_windows) {
    if (process.getuid && process.getuid() != 0) {
      var msg =  'You are running this script as an unprivileged user';
         msg +=  '\nso we cannot continue with the system configuration.';
         msg +=  '\nTo finalize the install process please run: \n\n';
         msg +=  '  $ sudo scripts/post_install.js';
      console.log(line + msg + line);
      process.exit(1);
    }

    // Remove old version of prey, if exists
    if(fs.existsSync('/usr/share/prey')) {
      exec('rm -Rf /usr/share/prey', function (){
        exec('(sudo crontab -l | grep -v prey) | sudo crontab -', function (){
          exec_post_install();
        });
      });
    } else {
      exec_post_install();
    }
  }

  if (is_windows) {
    prey_bin += '.cmd';
    exec_post_install();
  }

  function exec_post_install () {
    execFile(prey_bin, args, function(err, stdout, stderr){
      if (stdout.length > 0) console.log(stdout.trim());
      if (stderr.length > 0) console.log(stderr.trim());
      if (err) return console.log(err);
      console.log("System setup successful! Please run 'prey config activate -g' to start tracking.");
    });
  }
}

if (!process.env.BUNDLE_ONLY)
  post_install();
