var fs = require('fs'),
		system = require('./../../lib/prey/plugins/providers/system');

var prey_bin = exports.prey_bin = '/usr/local/prey/bin';

var init_script_name = 'prey-trigger',
		common_initd_path = '/etc/init.d';

var weird_initd_paths = {
	redhat: '/etc/rc.d/init.d',
	arch: '/etc/rc.d'
};

var initd_commands = {
	debian: {
		load: 'update-rc.d $1 defaults',
		unload: 'update-rc.d $1 remove',
	},
	redhat: {
		load: 'chkconfig $1 on',
		unload: 'chkconfig $1 off'
	},
	suse: {
		load: 'chkconfig --add $1',
		unload: 'chkconfig --del $1'
	}
}

initd_commands.ubuntu = initd_commands.debian;
initd_commands.fedora = initd_commands.redhat;

/////////////////////////////////////////////////
// helpers
/////////////////////////////////////////////////

var copy_init_script = function(distro, callback){

	var path = weird_initd_paths[distro] || common_initd_path;
	var full_path = path.join(path, init_script_name);

	path.exits(full_path, function(exists){
		if(exists) return callback(new Error("File already exists!"))
		
		var template = fs.readFileSync(path.resolve(__dirname + "/" + init_script_name));
		var data = template.toString().replace('{{prey_bin}}', prey_bin);
		
		if(data === template.toString())
			return callback(new Error("Unable to replace template variables!"));
		
		fs.writeFile(full_path, data, callback);

	});

};

var remove_init_script = function(path, callback){
	var file = path.resolve(path.join(path, init_script_name));
	fs.unlink(file, callback);
}

var load_init_script = function(distro, callback){
	var command = initd_commands[distro].load.replace('$1', init_script_name);
	exec(command, callback);
}

var unload_init_script = function(distro, callback){
	var command = initd_commands[distro].unload.replace('$1', init_script_name);
	exec(command, callback);
}


/////////////////////////////////////////////////
// hooks
/////////////////////////////////////////////////

exports.post_install = function(callback){
	
	System.get('os_name', function(err, name){
		
		var distro = name;
		copy_init_script(distro, function(err){
			
			if(err) return callback(err);
			load_init_script(distro, callback)

		})
		
	})

}

exports.pre_uninstall = function(callback){

	
	System.get('os_name', function(err, name){
		
		var distro = name;
		unload_init_script(distro, function(err){
			
			if(err) return callback(err);
			remove_init_script(distro, callback);

		})
		
	})

}
