var fs = require('fs');

exports.show = function(command, callback){

	switch (command) {

		case 'on':
			var str = "Do something in the event something happens.\n";
			str +=    "If the event is emitter by a trigger, this will also launch that trigger automatically.\n\n"
			str +=    "Syntax: on [event_name] [start|stop|get|send] [what] [options]\n"
			str +=    "\nExamples:\n";
			str +=    "\t> on failed_unlock_attempt send screenshot to myemail@gmail.com (and then 'start lock')\n";
			str +=    "\t> on alarm_start send picture to imgur using api_key:x (and then 'start alarm')\n";
   		str +=    "\t> on motion start lock (will start motion detector)\n\n";

      trigger_events_list(function(list) {
        callback(str + list);
      });
			break;

		case 'get':
      var str = "Gets [data] and returns it.\n\n";
      getters_list(function(list) {
		    str += list + '\n';
        reports_list(function(list) {
          callback(str + list);
        });
      });

		break;

		case 'send':
			var str = "Fetches and sends that data somewhere.\n\n";
			str += "Syntax: send [data] to [endpoint] using [options_for_endpoint]\n";
			str += "Data can be a filename (full path required) or any of the getters below.\n\n";
			str += "Available endpoints:\n";
			str += "\t- [url] (e.g. http://my.server.com/path)\n";
			str += "\t- [email] (e.g. youremail@gmail.com)\n";
			str += "\t- imgur (requires passing api_key in options)\n\n"

			var ex = "\nSome examples:\n";
			ex += "\t> send access_points_list to myemail@gmail.com\n";
			ex += "\t> send screenshot to imgur using api_key:abcdef123456\n";
			ex += "\t> send public_ip to http://api.server.com/v1 using username:hello password:x\n"

      getters_list(function(list){
        callback(str + list + ex);
      });
		break;

		case 'config':
		  callback("Sets or gets a config setting.");
			break;

		case 'show':
		  callback("Shows info about a specific action.\n\n");
			break;

		case 'start':
			var str = "Starts a new action.\n\n";
			actions_list(function(list){
			  callback(str + list)
			});
			break;

		case 'stop':
			var str = "Stops a running action.\n\n";
			actions_list(function(list){
			  callback(str + list)
			});
			break;

		case 'watch':
			var str = "Starts a watch for a certain trigger.\n\n"
			triggers_list(function(list){
			  callback(str + list)
			});
			break;

		case 'unwatch':
			var str = "Unwatchs a watched trigger.\n\n";
			triggers_list(function(list){
			  callback(str + list)
			});
  		break;

		default:
			var str = "Available commands: \n\n";
			str  += "\tconfig read [key]\n";
			str  += "\tconfig update [key] to [value]\n";
			str  += "\tget [data]\n";
			str  += "\tsend [data] (to [destination]) (using [options])\n";
			str  += "\twatch [trigger_event] (using [options])\n";
			str  += "\tunwatch [trigger]\n";
			str  += "\tstart [action] (using [options])\n";
			str  += "\tstop [action]\n";
			str  += "\ton [event_name] [start|stop|get] [options] ...\n"
			str  += "\tquit";
			str  += "\n\nFor more information, try with help [command], i.e. 'help send'";

      callback(str);
	}

};

var actions_list = function(cb){
	var str = "Available actions:\n";
	available('actions').forEach(function(action){
		str += "\t" + action + "\n";
	})
	cb(str);
};

var triggers_list = function(cb){
	var str = "Available triggers:\n";
	available('triggers').forEach(function(name){
		str += "\t" + name + "\n";
	})
  cb(str);
};

var trigger_events_list = function(callback){
	var str = "Available trigger events:\n";
	mapped('triggers', function(list) {
    list.forEach(function(name){
		  str += "\t" + name + "\n";
	  });
    callback(str);
  });
};

var getters_list = function(callback){
	var str = "Available getters:\n";
	mapped('providers', function(list) {
    list.forEach(function(name){
		  str += "\t" + name + "\n";
	  });
    callback(str);
  });
};

var reports_list = function(callback) {
	var str = "Available reports:\n";
	mapped('reports', function(mr) {
    mr.forEach(function(name) {
		  str += "\t" + name + "\n";
	  });
	  callback(str);
  });
};


var available = function(what){
	var actions = fs.readdirSync(__dirname + '/../../' + what);
	return actions.sort();
};

var mapped = function(what, callback){
	require('./../../' + what).map(function(err, obj) {
    callback(err ? [] : Object.keys(obj).sort());
  });
}
