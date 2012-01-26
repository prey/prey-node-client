var exec = require('child_process').exec;

exports.mac_address_cmd = function(nic){
	return "networksetup -getmacaddress " + nic + " | awk '{print $3}'";
};

var get_system_profiler_data = function(type, callback){

	var cmd = 'system_profiler ' + type;
	exec(cmd, function(err, stdout, stderr){

		if(err) return callback(null);

		var data = {};
		var lines = stdout.toString().trim().split("\n");
		lines.forEach(function(line, i){

			if(line != '') {

				var split = line.split(": ");

				if(split[1]){

					var key = split[0].trim().toLowerCase().replace(/\s/g, '_');
					var val = split[1].replace(/'/g, '');

					data[key] = val;

				}

			}

		});

		// console.log(data);
		callback(data);

	});

}

exports.get_firmware_info = function(callback){

	get_system_profiler_data('SPHardwareDataType', function(sp_data){

		var data = {
			model_name: sp_data.model_name,
			// model_identifier: sp_data.model_identifier,
			vendor_name: "Apple",
			device_type: sp_data.model_name.indexOf('Book') == -1 ? 'Desktop' : 'Laptop',
			bios_version: sp_data.boot_rom_version,
			motherboard_version: sp_data['smc_version_(system)'],
			serial_number: sp_data['serial_number_(system)'],
			uuid: sp_data.hardware_uuid
		}

		callback(data);

	})

}

// exports.get_firmware_info(function(data){
//	console.log(data);
// })
