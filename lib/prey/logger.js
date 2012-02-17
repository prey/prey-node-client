//////////////////////////
// Basic Logger for NodeJS
// Based on TJ Holowaychuk's Log.js
// Colors codes from Dav Glass's awesome node-termcolors
// MIT Licensed
//////////////////////////

var Log = function Log(level, options){
	this.set_level(level);
	this.stream = options.stream || process.stdout;
	this.set_timestamp = options.set_timestamp || true; // this.stream.readable;
};

exports.init = function(level, options){
	return new Log(level || 'info', options || {});
}

var colors = {
	red: '31',
	light_red: '1;31',
	green: '32',
	light_green: '1;32',
	blue: '34',
	light_blue: '1;34',
	purple: '35',
	light_purple: '1;35',
	cyan: '36',
	light_cyan: '1;36',
	brown: '33',
	yellow: '1;33',
	white: '1;37',
	light_gray: '37',
	dark_gray: '1;30',
	black: '30',
	bold: '1'
};

var levels = [
	'error',   // 0
	'warning', // 1
	'notice',  // 2
	'info',    // 3
	'debug'    // 4
];

var level_colors = {
	'error': 'red',
	'warning': 'purple',
	'notice': 'light_cyan',
	'info': 'bold',
	'debug': 'yellow'
}

var colorize = function(str, color){
	return "\033[" + colors[color] + "m" + str + "\033[0m";
};

var colorize_level = function(str){
	return colorize(str, level_colors[str]);
};

Log.prototype = {

	set_level: function(level){
		if ('string' == typeof level) level = levels.indexOf(level.toLowerCase());
		this.level = level;
	},
	
	off: function(){
		this.previous_level = this.level;
		this.set_level('off');
	},
	
	on: function(){
		this.set_level(this.previous_level);
	},

	error: function(msg, color){
		this.log('error', msg, color);
	},

	warn: function(msg, color){
		this.log('warning', msg, color);
	},

	notice: function(msg, color){
		this.log('notice', msg, color);
	},

	info: function(msg, color){
		this.log('info', msg, color);
	},

	debug: function(msg, color){
		this.log('debug', msg, color);
	},

	log: function(levelStr, msg, color) {

		if (levels.indexOf(levelStr) <= this.level) {
			var str = colorize_level(levelStr) + "\t" + msg;
			if(this.set_timestamp) str = '[' + new Date().toUTCString() + '] ' + str;
			this.write(str, color);
		}

	},

	write: function(msg, color){
		var str = color ? colorize(msg, color) : msg;
		this.stream.write(str + "\n");
	}

};
