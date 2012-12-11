var exec = require('child_process').exec;

exports.get_firmware_info = function(callback){

	get_system_profiler_data('SPHardwareDataType', function(err, sp_data){
		if (err) return callback(err);

		var data = {
			model_name: sp_data.model_name,
			// model_identifier: sp_data.model_identifier,
			vendor_name: "Apple",
			device_type: sp_data.model_name.indexOf('Book') === -1 ? 'Desktop' : 'Laptop',
			bios_version: sp_data.boot_rom_version,
			motherboard_version: sp_data['smc_version_(system)'],
			serial_number: sp_data['serial_number_(system)'],
			uuid: sp_data.hardware_uuid
		}

		callback(null, data);
	})

}

exports.valid_nics = function(nics) {
  return nics.filter(function(n) { return n !== "lo0" && n !== "lo" && !n.match(/^bridge/) });
};

exports.mac_address_for = function(nic_name, callback) {
  console.log(nic_name);
  var cmd = "networksetup -getmacaddress " + nic_name + " | awk '{print $3}'";
  exec(cmd, callback);
};

/////////////////////////////////////////////////////////////////
// helper functions
/////////////////////////////////////////////////////////////////

var get_system_profiler_data = function(type, callback){

	var cmd = '/usr/sbin/system_profiler ' + type;
	exec(cmd, function(err, stdout, stderr){

		if(err) return callback(err);

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
		callback(null, data);

	});

}
