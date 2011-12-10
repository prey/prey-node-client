//////////////////////////////////////////
// Prey File List Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('../../common'),
		util = require('util'),
		Provider = require('../../provider'),
		finder = require('./lib/finder');

var Files = function(){

	Provider.call(this);
	var self = this;
	this.name = 'file_list';

	this.getters = [
		'modified_since_list',
		'matching_filename_list'
	];

	this.get_modified_since_list = function(options){

		var path = options.path || '~';
		var one_week_ago = new Date() - (60 * 60 * 24 * 7 * 1000);
		var modified_since = options.modified_since || one_week_ago;

		var criteria = function(file, stat){
			return stat.mtime.getTime() > modified_since;
		};

		this.get_list({path: path, criteria: criteria}, function(files){
			self.emit('modified_since_list', files);
		});

	};

	this.get_matching_filename_list = function(options){

		var search_string = options.search_string;
		var extensions = options.extensions;

		var regex = new RegExp(search_string + "\." + extensions);

		var criteria = function(file, stat){
			return regex.test(file);
		};

		this.get_list({path: path, criteria: criteria}, function(files){
			self.emit('matching_filename_list', files);
		});

	};

	this.get_list = function(options, callback){

		this.path = options.path || '~';
		var files = [];
		var matches_criteria = options.criteria;

		finder.eachFileOrDirectory(path, function(err, file, stat) {

			// if we get a hidden file or error, skip to next
			if (err || /\/\./.test(file)) return;

			if(!stat.isDirectory() && matches_criteria(file, stat)) {
				console.log("File matches criteria:" + file)
				files.push(file);
			}

		}, function(err, files, stats){

			callback(files);

		});


	};

}

util.inherits(Files, Provider);
module.exports = new Files();
