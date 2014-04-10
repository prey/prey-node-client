var exec = require('child_process').exec;

var ram_vendors = {
  '0x014F': 'Transcend Information',
  '0x2C00': 'Micron Technology, Inc.',
  '0x802C': 'Micron Technology, Inc.',
  '0x80AD': 'Hynix Semiconductor Inc.',
  '0x80CE': 'Samsung Electronics, Inc.',
  '0xAD00': 'Hynix Semiconductor Inc.',
  '0xCE00': 'Samsung Electronics, Inc.'
}

exports.get_firmware_info = function(callback) {

  get_system_profiler_data('SPHardwareDataType', function(err, sp_data){
    if (err) return callback(err);

    var data = {
      device_type   : sp_data.model_name.indexOf('Book') === -1 ? 'Desktop' : 'Laptop',
      model_name    : sp_data.model_name,
      // model_identifier: sp_data.model_identifier,
      vendor_name   : 'Apple',
      bios_vendor   : 'Apple',
      bios_version  : sp_data.boot_rom_version,
      // mb_vendor: 'Apple', // Foxconn / Intel
      mb_version    : sp_data['smc_version_(system)'],
      serial_number : sp_data['serial_number_(system)'],
      uuid          : sp_data.hardware_uuid
    }

    callback(null, data);
  })

}

exports.get_ram_module_list = function(cb) {

  var list = [];

  call_system_profiler('SPMemoryDataType', function(err, out) {
    if (err) return cb(err);
    
    out.toString().split('BANK').forEach(function(block) {

      if (!block.match("Size")) return;
      
      var parts = block.split('\n\n'),
          obj   = parse_system_profiler_properties(parts[1]);
          
      list.push({
        bank   : 'Bank' + parts[0],
        size   : parseInt(obj.size) * 1024,
        speed  : parseInt(obj.speed),
        // status : obj.status,
        vendor : ram_vendors[obj.manufacturer] || 'Unknown',
        memory_type   : obj.type,
        // part_number   : obj.part_number,
        serial_number : obj.serial_number
      });
    });

    cb(null, list);
  })
}

/////////////////////////////////////////////////////////////////
// helper functions
/////////////////////////////////////////////////////////////////

var call_system_profiler = function(type, cb) {
  var cmd = '/usr/sbin/system_profiler ' + type;
  exec(cmd, cb);
}

var parse_system_profiler_properties = function(str) {
  var obj = {};
  
  str.toString().split('\n').forEach(function(line, i) {

    if (line != '') {
      var split = line.split(': '),
          key = split[0].trim().toLowerCase().replace(/\s/g, '_'),
          val = (split[1] || '').replace(/'/g, '');

      obj[key] = val;
    }

  })

  return obj;
}

var get_system_profiler_data = function(type, cb) {

  call_system_profiler(type, function(err, stdout, stderr) {
    if (err) return cb(err);
    
    var obj = parse_system_profiler_properties(stdout);
    cb(null, obj);
  });

}