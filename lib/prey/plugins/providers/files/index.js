//////////////////////////////////////////
// Prey Files Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
		util = require('util'),
		Getters = require('./../../../getters'),
		finder = require('./lib/finder');

var Files = function(){

	Getters.call(this);
	var self = this;
	// this.name = 'filesystem';

	this.getters = [
		'recently_modified_list'
	];

	// returns list of recently modified files. unless since option is passed,
	// will return list of modified since one hour ago
	this.get_recently_modified_list = function(options, callback){

		var path = options.path || process.env.HOME;
		var modified_since = new Date() - (options.since || 1000 * 60 * 60); // one hour ago

		var criteria = function(file, stat){
			return stat.mtime.getTime() > modified_since;
		};

		// console.log("Searching files on " + path + " modified after " + modified_since);
		this.get_list({path: path, criteria: criteria}, function(err, files){
			callback(err, files);
		});

	};

	this.get_matching_filename_list = function(options, callback){

		if(!options.string)
			return callback(new Error("No search string given"));

		var path = options.path || process.env.HOME;
		var search_string = options.string || options.search_string;
		var extensions = options.extensions || ".*";
		var modifiers = options.case_sensitive ? '' : 'i';

		var regex = new RegExp(".*" + search_string + ".*\." + extensions, modifiers);

		var criteria = function(file, stat){
			return regex.test(file);
		};

		this.get_list({path: path, criteria: criteria}, function(err, files){
			callback(err, files);
		});

	};

	this.get_list = function(options, callback){

		var path = options.path || process.env.HOME;
		var matches_criteria = options.criteria;
		var matches = [];

		fs.exists(path, function(exists){

			if(!exists) return callback(new Error("Path not found: " + path))

			finder.eachFileOrDirectory(path, function(err, file, stat) {

				// if we get a hidden file or error, skip to next
				if (err || /\/\./.test(file)) return;

				if(!stat.isDirectory() && matches_criteria && matches_criteria(file, stat)) {
					// console.log("File matches criteria: " + file)
					matches.push(file);
				}

			}, function(){

				callback(null, matches);

			});

		});

	};

}

util.inherits(Files, Getters);
module.exports = new Files();
