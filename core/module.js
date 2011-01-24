var sys = require('sys'),
		events = require('events'),
		fs = require('fs'),
		path = require('path'),
		log = console.log,
		updater = require('./updater');

var base_path = path.dirname(__dirname);

function Module(data) {

	var self = this;
	this.name = data.name;
	this.type = data.type;
	this.path = base_path + "/modules/" + this.name;
	this.traces = {};

	this.default_options = function(){
		return require(this.path + "/config").default;
	}

	this.ready = function(){
		self.emit('ready');
	}

	this.download = function(){
		log(" -- Path not found!")
		this.update();
	},

	this.update = function(){
		log(" ++ Downloading module " + this.name + " from server...")
		var update = updater.module(self);
		update.on('success', function(){
			log(" ++ Module in place and ready to roll!")
			self.ready();
		});
		update.on('error', function(){
			log(' !! Error downloading package.')
			return false;
		})
	};

	this.check_version = function(upstream_version){

		// get version and check if we need to update
		fs.readFile(this.path + "/version", function(err, data){
			if(err) return;
			this.version = parseFloat(data);
			if(upstream_version > this.version){
				log(upstream_version + " is newer than installed version: " + this.version);
				self.update();
			} else {
				self.ready();
			}
		})
	};

	this.init = function(config, update){

		self.options = self.default_options.merge(config);

		// download module in case it's not there
		path.exists(this.path, function(exists) {
			if(!exists)
				self.download();
			else if(update)
				self.check_version(data.version);
			else
				self.ready();
		});

	}

	this.run = function(method){
		log(" -- Running " + self.name + " module...");

		try {
			var core = require(self.path + "/core");
		} catch(e){
			console.log(" !! Error: " + e.message);
			self.emit('error', "Module not found");
			self.emit('end', {});
			return false;
		}

		var hook = core.init(self.options);

		hook.on('end', function(){
			console.log(' -- Module execution ended.')
			self.emit('end', self.traces);
		})

		hook.on('error', function(){
			console.log(' -- Module execution failed.')
			self.emit('error');
		})

		hook.on('trace', function(key, val){
			log(" ++ Adding trace for " + self.name + ": " + key + " -> " + val);
			self.traces[key] = val;
		})

		method ? hook.send(method) : hook.run()

	}

}

sys.inherits(Module, events.EventEmitter);

exports.new = function(attrs){
	return new Module(attrs);
}
