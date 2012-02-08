//////////////////////////////////////////
// Prey Filesystem Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('../../common'),
		util = require('util'),
		Provider = require('../../provider'),
		finder = require('./lib/finder');

var Filesystem = function(){

	Provider.call(this);
	var self = this;
	// this.name = 'filesystem';

	this.getters = [
		'modified_since_list',
		'matching_filename_list'
	];

	this.get_modified_since_list = function(options){

		var path = options.path || process.env.HOME;
		var modified_since = options.modified_since || new Date() - (60 * 60 * 24 * 1000); // one day ago

		var criteria = function(file, stat){
			return stat.mtime.getTime() > modified_since;
		};

		common.logger.debug("Searching files on " + path + " modified after " + modified_since);

		this._get_list({path: path, criteria: criteria}, function(files){
			self.emit('modified_since_list', files);
		});

	};

	this.get_matching_filename_list = function(options){

		if(!options.search_string)
			return this.emit('matching_filename_list', null, "No search string given");

		var path = options.path || process.env.HOME;
		var search_string = options.search_string;
		var extensions = options.extensions || ".*";
		var modifiers = options.case_insensitive ? 'i' : '';

		var regex = new RegExp(".*" + search_string + ".*\." + extensions, modifiers);

		var criteria = function(file, stat){
			return regex.test(file);
		};

		common.logger.debug("Searching files on " + path + " matching regex " + regex);

		this._get_list({path: path, criteria: criteria}, function(files){
			self.emit('matching_filename_list', files);
		});

	};

	this._get_list = function(options, callback){

		var path = options.path || '~';
		var files = [];
		var matches_criteria = options.criteria;

		finder.eachFileOrDirectory(path, function(err, file, stat) {

			// if we get a hidden file or error, skip to next
			if (err || /\/\./.test(file)) return;

			if(!stat.isDirectory() && matches_criteria(file, stat)) {
				console.log("File matches criteria: " + file)
				files.push(file);
			}

		}, function(err, files, stats){

			callback(files);

		});


	};

}

util.inherits(Filesystem, Provider);
module.exports = new Filesystem();
