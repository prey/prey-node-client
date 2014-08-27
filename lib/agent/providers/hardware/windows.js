"use strict";

var exec = require('child_process').exec,
    join = require('path').join,
    wmic = require('wmic');

var ram_form_factors = [
  'Unknown',
  'Other',
  'SIP',
  'DIP',
  'ZIP',
  'SOJ',
  'Proprietary',
  'SIMM',
  'DIMM',
  'TSOP',
  'PGA',
  'RIMM',
  'SODIMM',
  'SRIMM',
  'SMD',
  'SSMP',
  'QFP',
  'TQFP',
  'SOIC',
  'LCC',
  'PLCC',
  'BGA',
  'FPBGA',
  'LGA'
];

var ram_types = [
  'Unknown',
  'Other',
  'DRAM',
  'Synchronous DRAM',
  'Cache DRAM',
  'EDO',
  'EDRAM',
  'VRAM',
  'SRAM',
  'RAM',
  'ROM',
  'Flash',
  'EEPROM',
  'FEPROM',
  'EPROM',
  'CDRAM',
  '3DRAM',
  'SDRAM',
  'SGRAM',
  'RDRAM',
  'DDR',
  'DDR2'
]


var firmware_keys = {
  uuid:          ['path win32_computersystemproduct', 'uuid'],
  serial_number: ['bios', 'serialnumber'],
  bios_vendor:   ['bios', 'Manufacturer'],
  bios_version:  ['bios', 'SMBIOSBIOSVersion'],
  mb_vendor:     ['baseboard', 'manufacturer'],
  mb_serial:     ['baseboard', 'serialnumber'],
  mb_model:      ['baseboard', 'product'],
  mb_version:    ['baseboard', 'version']
}

exports.get_firmware_info = function(callback) {

  var count = 0, data = {};

  var fetch = function(key, section, value){
    wmic.get_value(section, value, null, function(err, res){
      if (!err && res)
        data[key] = res;

      --count || callback(null, data)
    })
  }

  for (var key in firmware_keys) {
    count++;
    var values = firmware_keys[key];
    fetch(key, values[0], values[1]);
  }

};

exports.get_ram_module_list = function(cb) {

  var list = [],
      file = join(__dirname, 'ramcheck.vbs');

  exec('cscript ' + file + ' /B', function(err, stdout) {
    if (err) return cb(err);

    stdout.toString().split('---').forEach(function(block) {
      var data = {};

      block.split('\n').forEach(function(line) {
        var split = line.split(':'),
            key   = split[0].replace(/ /g, '-'),
            val   = (split[1] || '').trim();

        if (val && val != '') data[key] = val;
      })

      // cscript returns a "Windows Script Host" header, 
      // so make sure we don't get rubbish
      if (!data['Name']) return;
      // console.log(data);

      list.push({
        name  : data['Name'],
        bank  : data['Bank-Label'],
        location: data['Device-Locator'],
        // installed_on: data['Install-Date'],
        size  : parseInt(data['Capacity']) / 1024,
        form_factor : ram_form_factors[parseInt(data['Form-Factor'])] || 'Unknown',
        memory_type : ram_types[parseInt(data['Memory-Type'])] || 'Unknown',
        speed : parseInt(data['Speed']),
        data_width : parseInt(data['Data-Width'])
      });

    });

    cb(null, list);
  })
}
