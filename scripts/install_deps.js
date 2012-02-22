#!/usr/local/bin/node

var path = require('path'),
		spawn = require('child_process').spawn,
		finder = require('./../lib/prey/plugins/providers/files/lib/finder');

finder.eachFileMatching(/lib.*\/package.json/, './', function(err, file, stat){
	
	if(!file || file.match(/\/node_modules/))
		return;

		var dir = path.dirname(file);
		console.log('Found package.json in ' + dir)

		var child = spawn('npm', ['install'], {cwd: dir});
		
		child.stdout.on('data', function(data){
			console.log(data.toString());
		});
		
		child.on('exit', function(code){
			// console.log("Exited with code " + code);
		})

});