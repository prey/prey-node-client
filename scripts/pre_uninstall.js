#!/usr/bin/env node

var os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    os_hooks = require('./' + os_name + '/hooks');

os_hooks.pre_uninstall(function(err){
  if (err){
    console.log(err);
    process.exit(1);
  }
});
