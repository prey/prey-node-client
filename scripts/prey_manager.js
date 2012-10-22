#!/usr/bin/env node

"use strict";

/**
 * Manage Prey installations.
 *
 **/

var
  exp = module.exports,
  fs = require('fs'),
  exec = require('child_process').exec,
  inspect = require('util').inspect,
  commander = require('commander'),
  _ = require('underscore');

/**
 * Contains the directory to find installs under, useful for development
 **/
var dev_install_spec = process.env.HOME+"/.prey_installs";

/**
 * Contains the current prey version.
 **/
var cur_file = '_cur';

var _error = function(e,context) {
  // got an existing error object just return it ...
  if (_.isObject(e) && "error" in e) return e;
  
  var con = (context === null) ? '' : ':'+context;
  var e =  {error:e,context:con};
  console.log(inspect(e));
  return e;
};

/**
 * Defaults to /usr/local/lib/prey/, but for development can use a dir specified in users home directory in file
 * ~/.prey_installs
 **/
var install_dir = exp.install_dir = function(callback) {
  fs.exists(dev_install_spec,function(exists) {
    if (!exists) return callback(null,"/usr/local/lib/prey/");

    fs.readFile(dev_install_spec,'utf8',function(err,content) {
      if (err) return callback(_error(err));

      content = content.trim();
      if (content.substr(-1) !== "/") content += '/';
      
      callback(null,content);
    });
  });
};

/**
 * Callsback a list of currently installed prey versions.
 **/
var versions = exp.get_versions = function(callback) {
  install_dir(function(err,dir) {
    if (err) return callback(_error(err));
    
    fs.readdir(dir,function(err,entries) {
      if (err) return callback(_error(err));

      callback(null,entries.filter(function(el) {
        return el !== "_cur";
      }));
    });
  });
};


exp.get_cur_version = function(callback) {
  install_dir(function(err,dir) {
    if (err) return callback(_error(err));

    var cf = dir + cur_file;
    fs.exists(cf,function(exists) {
      if (!exists) return callback(_error('Prey not installed'));

      fs.readFile(dir + cur_file,'utf8',function(err,stdout) {
        if (err) return callback(_error(err));
        
        callback(null,stdout);
      });
    });
  });
};

var set_cur_version = function(ver,callback) {
  exp.get_versions(function(e,versions) {
    if (versions.indexOf(ver) === -1) return callback(_error('version does not exist',ver));

    install_dir(function(err,dir) {
      if (err) return callback(_error(err));

      fs.writeFile(dir + cur_file,ver,'utf8',function(err) {
        if (err) return callback(_error(err));
        
        callback(null);
      });
    });
  });
};

var get_current_prey_dir = function(callback) {
  install_dir(function(err,dir) {
    if (err) return callback(_error(err));
    
    exp.get_cur_version(function(err,ver) {
      if (err) return callback(_error(err));
      
      callback(null,dir+ver);
    });
  });
};


/**
 * Install Prey version into the installations directory.
 * temp_dir is the exploded prey installation binaries.
 **/
var install_prey = function(temp_dir,callback) {
  temp_dir = temp_dir.trim();
  if (temp_dir.substr(-1) !== "/") temp_dir += "/";
  
  try {
   // what version of prey are we attempting to install
   var version = require(temp_dir+'/package.json').version;

   versions(function(err, vers) {
     if (err) return callback(_error(err));
     if (vers.indexOf(version) !== -1) return callback(_error("version already installed"));

     install_dir(function(err,dir) {
       if (err) return callback(_error(err));

       var new_dir = dir+version;
       exec('mkdir -p '+new_dir,function(err,so,se) {
         if (err) return callback(_error(err,se));

         exec('cp -r '+temp_dir+' '+new_dir,function(err) {
           if (err) return callback(_error("can't copy files from "+temp_dir+" to "+ new_dir,err));

           // ok, new version has been installed so update _cur version,
           set_cur_version(version,function(err) {
             if (err) return callback(_error(err));
             
             callback(null,new_dir);
           });
         });
       });
     });
   });
  } catch(e) {
    console.log("can't find package.json in "+temp_dir);
  }
};



/////////////////////////////////////////////////////////////
// command line options
/////////////////////////////////////////////////////////////

commander
      .option('-i, --install <from_path>', 'Install Prey ')
      .option('-s, --setcurrent <version>','Set current version')
      .option('-c, --current', 'Path to current version')
      .option('-r, --runscript','Path to bin/prey.js of current version') 
      .parse(process.argv);

if (commander.install) {
  install_prey(commander.install,function(err,new_dir) {
    if (!err) {
      console.log("installed prey to "+new_dir);
      process.exit(0);
    } else
      process.exit(1);
  });
}

if (commander.current) {
  get_current_prey_dir(function(err,prey_dir) {
    if (!err) {
      console.log(prey_dir);
      process.exit(0);
    } else
      process.exit(1);
  });
}

if (commander.setcurrent) {
  set_cur_version(commander.setcurrent,function(err) {
    process.exit((err) ? 1 : 0); 
  });
}


if (commander.runscript) {
  get_current_prey_dir(function(err,prey_dir) {
    if (!err) {
      console.log(prey_dir+'/bin/prey.js');
      process.exit(0);
    } else
      process.exit(1);
  });
}







