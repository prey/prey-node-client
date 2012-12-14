//////////////////////////////////////////
// Prey Sound Detector
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		path = require('path'),
		spawn = require('child_process').spawn,
		Emitter = require('events').EventEmitter,
    common = require('./../../common'),
		os_name = common.os_name;

var	event_name = 'motion',
		listener_script = path.join(__dirname, 'bin', 'amstracker')

var MotionTrigger = function(options){

	var self = this;
	this.options = options;
	this.min_threshold = 30;
	this.min_samples = 5;
	this.samples = {0: [], 1: [], 2: []};
	this.average = {};

	this.listen = function(){

		this.child = spawn(listener_script, ['-u', '0.2']);

		this.child.stdout.on('data', function(data){

			if(matches = data.toString().match(/\s(-?\d\d?)/g))
				self.check_for_movement(matches);

		});

		this.child.stderr.on('data', function(data){
			// console.log('stderr: ' + data.toString())
		})

		this.child.once('exit', function(code){
			self.emit('end');
			// console.log('Exited with code ' + code);
			// self.stop();
		});

	};

	this.check_for_movement = function(matches){

		if(!this.average[0] && this.samples[0].length >= this.min_samples)
			return this.set_average(matches);

		matches.forEach(function(axis, i){

			if(!self.average[0])
				return self.samples[i].push(parseInt(axis));;

			var diff = axis - self.average[i];
			// console.log(self.average[i].toString()  + " - " + axis + " = " + diff)

			if(diff > self.min_threshold)
				self.moved();

		})

	};

	this.moved = function(){

		this.emit(event_name);
		this.average = {}; // this will make us start gathering samples to set a new average

	};

	this.set_average = function(matches){

		for(i in this.samples){
			var total = 0;
			this.samples[i].map(function(el){
				total += el;
			});
			this.average[i] = total/this.samples[i].length;
			this.samples[i] = [];
		}
		// console.log(this.average);
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

util.inherits(MotionTrigger, Emitter);

exports.events = [event_name];

exports.start = function(options, callback){

	var detector = this.detector = new MotionTrigger(options);
	this.detector.listen();

	setTimeout(function(){
		detector.is_running()
			? callback(null, detector)
			: callback(new Error("Detector not running! Do you have the required libs in place?"));
	}, 300);

}

exports.stop = function(){
	if (this.detector)
		this.detector.stop();
}
