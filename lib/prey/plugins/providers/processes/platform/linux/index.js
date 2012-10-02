"use strict";

var exec = require('child_process').exec;

exports.get_process_list = function(callback) {
	var processes = [];

  _tr('should be executing get_process_list');
  
  var cmd = 'ps axo stat,user,ppid,pid,pcpu,pmem,time,comm | egrep -v " ps|grep"';
	var child = exec(cmd, function(err, stdout){
		if (err) return callback(_error("!"+cmd,err));

		stdout.toString().split("\n").forEach(function(line){
      
			var columns = line.trim().split(/\s+/);
			if (columns[0] !== '' && columns[columns.length] !== '<defunct>'){

				var process = {
					status: columns[0],
					user:   columns[1],
					ppid:   parseInt(columns[2]),
					pid:    parseInt(columns[3]),
					cpu:    columns[4],
					mem:    columns[5],
					time:   columns[6],
					name:   columns[7]
				};

				if (process.pid !== child.pid)
					processes.push(process);
			}
		});
    
		processes.sort(function(a,b){
			return (a.pid > b.pid);
		});

    _tr("calling back processes");
		callback(null, processes);

	});

};
