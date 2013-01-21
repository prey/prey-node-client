var os = require('os'),
    exec = require('child_process').exec;

exports.get_firmware_info = function(callback){

	get_system_profiler_data('SPHardwareDataType', function(err, sp_data){
		if (err) return callback(err);

		var data = {
			device_type: sp_data.model_name.indexOf('Book') === -1 ? 'Desktop' : 'Laptop',
			model_name: sp_data.model_name,
			// model_identifier: sp_data.model_identifier,
			vendor_name: 'Apple',
			bios_vendor: 'Apple',
			bios_version: sp_data.boot_rom_version,
			// mb_vendor: 'Apple', // Foxconn / Intel
			mb_version: sp_data['smc_version_(system)'],
			serial_number: sp_data['serial_number_(system)'],
			uuid: sp_data.hardware_uuid
		}

		callback(null, data);
	})

}

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

exports.mac_address_for = function(nic_name, callback) {
  var cmd = "networksetup -getmacaddress " + nic_name + " | awk '{print $3}'";
  exec(cmd, callback);
};

exports.interface_type_for = function(nic_name, cb){
  exec('networksetup -listnetworkserviceorder | grep ' + nic_name, function(err, out){
    if (err) return cb(err);

    var type = out.toString().match(/ethernet|lan/i) ? 'Wired' : 'Wireless';
    cb(null, type);
  })
}

exports.get_network_interfaces = function(cb){

  var list = [],
      nics = os.networkInterfaces();

  exec('networksetup -listallhardwareports', function(err, out){
    if (err) return cb(err);

    out.toString().split(/Hardware/).slice(1).forEach(function(block){

      var port = block.match(/Port: (.+)/)[1],
          type = port.match(/Ethernet/) ? 'Wired': port.match(/Wi-?Fi/) ? 'Wireless' : port;

      if (type == 'Wired' || type == 'Wireless') {

        var obj = {
            name: block.match(/Device: (\w+)/)[1],
            mac_address: block.match(/Address: ([A-Fa-f0-9:-]+)/)[1],
            type: type
        }
        
        if (!obj) return; // total weirdness
        
        (nics[obj.name] || []).forEach(function(type){
          if (type.family == 'IPv4'){
            obj.ip_address = type.address;
          }
        });

        list.push(obj);

      }

    })

    cb(null, list);

  })

};
