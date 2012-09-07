#!/usr/bin/env node

var path = require('path'),
    spawn = require('child_process').spawn,
    finder = require('./../lib/prey/plugins/providers/files/lib/finder');

finder.eachFileMatching(/lib.*\/package.json$/, './', function(err, file, stat){

  if (!file || file.match(/\/node_modules/))
    return;

  var dir = path.resolve(path.dirname(file));
  console.log('Installing local dependencies for plugin ' + path.basename(dir));

  var child = spawn('npm', ['install', '--local'], {cwd: dir});

  child.stdout.on('data', function(data){
    // console.log(data.toString());
  });

  child.on('exit', function(code){
    // console.log("Exited with code " + code);
  })

});
