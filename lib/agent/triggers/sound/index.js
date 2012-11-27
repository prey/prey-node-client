//////////////////////////////////////////
// Prey Sound Detector
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util    = require('util'),
		path    = require('path'),
		spawn   = require('child_process').spawn,
		Emitter = require('events').EventEmitter,
    common  = require('./../../common'),
		os_name = common.os_name;

var event_name = 'sound',
		listener_script = path.join(__dirname, 'bin', os_name + '.py')

var SoundTrigger = function(options){

	var self = this;
	this.options = options;

	this.listen = function(){

		this.child = spawn(listener_script);

		this.child.stdout.on('data', function(data){
			if(data.toString().trim() == 'Tap!')
				self.emit(event_name);
		});

		this.child.stderr.on('data', function(data){
			// console.log('stderr: ' + data.toString())
		})

		this.child.once('exit', function(code){
			self.emit('end');
			// console.log('Exited with code ' + code);
			// self.stop();
		});

	}

	this.stop = function(err){
		if(err) common.logger.error(err);
		if(this.child) this.child.kill();
	}

	this.is_running = function(){
		try{ process.kill(this.child.pid, 0); return true }
		catch(e) { return false }
	};

}

util.inherits(SoundTrigger, Emitter);

exports.events = [event_name];

exports.start = function(options, callback){

	var listener = this.listener = new SoundTrigger(options);
	this.listener.listen();

	setTimeout(function(){
		listener.is_running()
			? callback()
			: callback(new Error("Detector not running! Make sure you have the PyAudio library installed."));
	}, 300);

	return this.listener;
}

exports.stop = function(){
	if (this.listener)
		this.listener.stop();
}
