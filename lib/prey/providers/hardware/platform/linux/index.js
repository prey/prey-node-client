var exec = require('child_process').exec;

exports.mac_address_cmd = function(nic){
	return "ifconfig | grep " + nic + " | grep 'HWaddr' | awk '{print $5}'";
};

exports.get_firmware_info = function(callback){

	var cmd = 'hwinfo | grep "system\\."'
	exec(cmd, function(err, stdout, stderr){

		if(err) return callback(null);

		var data = {};
		var lines = stdout.toString().trim().split("\n");
		lines.forEach(function(line, i){

			if(line != '') {

				// console.log(line);
				var split = line.split(" = ");

				var key = split[0].trim().replace('system.', '').replace(/\./g, '_');
				var val = split[1].replace(/'/g, '');

				data[key] = val;

			}

		});

		var return_data = {
			model_name: data.hardware_product,
			vendor_name: data.chassis_manufacturer,
			device_type: data.formfactor == 'laptop' ? 'Laptop' : 'Desktop',
			bios_version: data.firmware_version,
			motherboard_version: data.hardware_version,
			serial_number: data.serial_number,
			uuid: data.hardware_uuid
		}

		// console.log(return_data);
		callback(return_data);

	});

}
