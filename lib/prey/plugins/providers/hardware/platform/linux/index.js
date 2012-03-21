var exec = require('child_process').exec;

exports.mac_address_cmd = function(nic){
	return "ifconfig | grep " + nic + " | grep 'HWaddr' | awk '{print $5}'";
};

exports.get_firmware_info = function(callback){

	var command = 'dmidecode';

	var data_fields = {
		'system': {
			vendor_name: 'Manufacturer',
			model_name: 'Product Name',
			serial_number: 'Serial Number',
			uuid: 'UUID'
		},
		'baseboard': {
			mb_vendor: 'Manufacturer',
			mb_model: 'Product Name',
			mb_version: 'Version',
			mb_serial: 'Serial Number'
		},
		'chassis': {
			device_type: 'Type'
		},
		'bios': {
			bios_vendor: 'Vendor',
			bios_version: 'Version'
		}
	}

	var count = Object.keys(data_fields).length;
	var data = {};

	var get_values = function(type, fields){

		exec(command + ' -t ' + type, function(err, stdout, stderr){

			if(err) return callback(err);

			for(key in fields){
				if(val = get_value(stdout, fields[key]))
					data[key] = val;
			}

			command_done();

		});

	};

	var get_value = function(output, string){
		var regex = new RegExp(string + ": (.*)");
		if(matches = output.toString().match(regex))
			return matches[1].trim() == '' ? null : matches[1];
	}

	var command_done = function(){
		--count || callback(data);
	}

	for(type in data_fields){
		get_values(type, data_fields[type]);
	}

}
