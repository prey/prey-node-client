//////////////////////////////////////////
// Prey Filesystem Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		helpers = common.helpers,
		fs = require('fs'),
		path = require('path'),
		logger = common.logger;

var FilesystemTransport = {

	init: function(options){

		logger.info("Initializing Filesystem Transport");
		this.path = options.path || common.helpers.tempfile_path();
		this.data_file = path.join(this.path, options.file || 'data.json')
		return this;

	},

	save: function(data, callback){

		logger.info("Storing data in filesystem...");
		var error, self = this, values = {};

		for(key in data){

			if(data[key].file){
				var destination = path.join(this.path, path.basename(data[key].file));
				helpers.copy_file(data[key].file, destination, function(err){
					error = err;
				});
			} else {
				values[key] = data[key];
			}

		}

		if(Object.keys(values).length > 0){

			fs.writeFile(this.data_file, JSON.stringify(values, null, 2), function(err){
				logger.error(err);
				if(!callback) return;
				else if(err || error) return callback(err || error);
				else callback(null, self.path);
			})
		}

	}

}

exports.send = function(data, options, callback){
	FilesystemTransport.init(options).save(data, callback);
};
