//////////////////////////////////////////
// Prey Modified Files Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('../../base'),
		util = require('util'),
		InfoModule = require('../../info_module'),
		finder = require('./lib/finder');

var Filesystem = function(){

	InfoModule.call(this);
	var self = this;
	this.name = 'modified_files';

	this.recently_modified_list = function(options, callback){

		var one_week_ago = new Date() - (60 * 60 * 24 * 7 * 1000);
		var modified_since = options.modified_since || one_week_ago;
		var path = options.path || '/home/tomas/code/prey';
		var files = [];

		finder.eachFileOrDirectory(path, function(err, file, stat) {

			// if (err) throw err;
			if (err) return;

			if(/\/\./.test(file)){
				// console.log("Hidden file: " + file);
				return;
			}
			if (!stat.isDirectory()){
				// console.log(">> Found file: " + file);
			}

			if(stat.mtime.getTime() > one_week_ago) {
				console.log("File is newer than one week :" + file)
				files.push(file);
			}

		});

		this.emit('modified_files', files);

	};

	this.find_matching_list = function(options){

	};

}

util.inherits(Filesystem, InfoModule);
module.exports = new Filesystem();
