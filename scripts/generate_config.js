#!/usr/bin/env node

var fs = require('path'),
    path = require('path'),
    config = require('getset'),
    finder = require('./../lib/prey/plugins/providers/files/lib/finder');

var config_file = __dirname + '/../config.default';
var files = {};

finder.eachFileMatching(/default.options$/, './', function(err, file, stat){

	if(err || !file) return;
	var plugin_name = path.basename(path.dirname(file));

	if (plugin_name == '.') // root path
		config.load(file);
	else
		files[plugin_name] = file;

}, function(){

	// sort plugin names alphabetically before appending
	Object.keys(files).sort().forEach(function(plugin_name){

		var opts = config.read(files[plugin_name]);
		// console.log(plugin_name + " -> " + JSON.stringify(opts));
		config.set(plugin_name, opts, true);

	});

	config._file = config_file;
	console.log(config._values);

	config.save(function(err){
		if(err) console.log(err);
		else console.log("Config file saved in " + config_file);
	});

});
