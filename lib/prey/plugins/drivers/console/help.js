var fs = require('fs');

exports.show = function(command){

	switch(command){

		case 'on':
			var str = "Do something in the event something happens. Usually you would set up the hook\n";
			str +=    "and then start the action that will trigger that hook.\n\n";
			str +=    "Syntax: on [event_name] [start|stop|get|send] [what] [options]\n"
			str +=    "\nExamples:\n";
			str +=    "\t> on failed_unlock_attempt send screenshot to myemail@gmail.com (and then 'start lock')\n";
			str +=    "\t> on alarm_start send picture to imgur using api_key:x (and then 'start alarm')\n";
			str +=    "\t> on report_finished start geofencing (and then 'start report')\n";
			str +=    "\t> on motion start lock (and then 'watch motion')\n\n";
			str +=    trigger_events_list();
			break;

		case 'get':
			var str = "Gets [data] and returns it.\n\n";
			str += getters_list();
			str += "\n";
			str += reports_list();
			break;

		case 'send':
			var str = "Fetches and sends that data somewhere.\n\n";
			str += "Syntax: send [data] to [endpoint] using [options_for_endpoint]\n";
			str += "Data can be a filename (full path required) or any of the getters below.\n\n";
			str += "Available endpoints:\n";
			str += "\t- [url] (e.g. http://my.server.com/path)\n";
			str += "\t- [email] (e.g. youremail@gmail.com)\n";
			str += "\t- imgur (requires passing api_key in options)\n\n"
			str += getters_list();
			str += "\nSome examples:\n";
			str += "\t> send access_points_list to myemail@gmail.com\n";
			str += "\t> send screenshot to imgur using api_key:abcdef123456\n";
			str += "\t> send public_ip to http://api.server.com/v1 using username:hello password:x\n"
			break;

		case 'config':
			var str = "Sets or gets a config setting.";
			break;

		case 'show':
			var str = "Shows info about a specific action.\n\n";
			break;

		case 'start':
			var str = "Starts a new action.\n\n";
			str += actions_list();
			break;

		case 'stop':
			var str = "Stops a running action.\n\n";
			str += actions_list();
			break;

		case 'watch':
			var str = "Starts a watch for a certain trigger.\n\n"
			str += triggers_list();
			break;

		case 'unwatch':
			var str = "Unwatchs a watched trigger.\n\n";
			str += triggers_list();
			break;

		default:
			var str = "Available commands: \n\n";
			str  += "\tconfig get [key]\n";
			str  += "\tconfig set [key] to [value]\n";
			str  += "\tget [data]\n";
			str  += "\tsend [data] (to [destination]) (using [options])\n";
			str  += "\twatch [trigger_event] (using [options])\n";
			str  += "\tunwatch [trigger]\n";
			str  += "\tstart [action] (using [options])\n";
			str  += "\tstop [action]\n";
			str  += "\ton [event_name] [start|stop|get|set] [options] ...\n"
			str  += "\tquit";
			str  += "\n\nFor more information, try with help [command], i.e. 'help send'";

	}

	return str;
};

var actions_list = function(){
	var str = "Available actions:\n";
	available('actions').forEach(function(action){
		str += "\t" + action + "\n";
	})
	return str;
};

var triggers_list = function(){
	var str = "Available triggers:\n";
	available('triggers').forEach(function(name){
		str += "\t" + name + "\n";
	})
	return str;
};

var trigger_events_list = function(){
	var str = "Available trigger events:\n";
	mapped('triggers').forEach(function(name){
		str += "\t" + name + "\n";
	})
	return str;
};

var getters_list = function(){
	var str = "Available getters:\n";
	mapped('providers').forEach(function(name){
		str += "\t" + name + "\n";
	})
	return str;
};

var reports_list = function(){
	var str = "Available reports:\n";
	mapped('reports').forEach(function(name){
		str += "\t" + name + "\n";
	})
	return str;
};


var available = function(what){
	var actions = fs.readdirSync(__dirname + '/../../' + what);
	return actions.sort();
};

var mapped = function(what){
	var list = require('./../../../' + what).map();
	return Object.keys(list).sort();
}
