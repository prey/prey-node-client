"use strict";

var exec = require('child_process').exec,
  join = require('path').join,
  system = require('./../../../system/windows'),
  common = require('./../../../common'),
  logger = common.logger.prefix('wmic'),
  gte = common.helpers.is_greater_or_equal,
  wmic = require('wmic'),
  si = require('systeminformation'),
  os = require('os');

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
  uuid: ['path win32_computersystemproduct', 'uuid'],
  serial_number: ['bios', 'serialnumber'],
  bios_vendor: ['bios', 'Manufacturer'],
  bios_version: ['bios', 'SMBIOSBIOSVersion'],
  mb_vendor: ['baseboard', 'manufacturer'],
  mb_serial: ['baseboard', 'serialnumber'],
  mb_model: ['baseboard', 'product'],
  mb_version: ['baseboard', 'version'],
  device_type: ['path Win32_Battery', 'Availability'],
  model_name: ['computersystem', 'Model'],
  vendor_name: ['computersystem', 'Manufacturer']
}

exports.get_bios_vendor = function (cb) {
  system.get_as_admin('biosVendor', (err, info) => {
    if (err) return cb(err);

    try {
    } catch (e) {
      return cb(new Error("Error getting get_bios_vendor  info: " + e.message));
    }

    return cb(null, info);
  })
}

exports.get_uuid = function (cb) {
  system.get_as_admin('uuid', (err, info) => {
    if (err) return cb(err);
    try {
    } catch (e) {
      return cb(new Error("Error getting get_uuid  info: " + e.message));
    }

    return cb(null, info);
  })
}

exports.get_serial_number = function (cb) {
  system.get_as_admin('serialNumber', (err, info) => {
    if (err) return cb(err);

    try {
    } catch (e) {
      return cb(new Error("Error getting get_serial_number info: " + e.message));
    }

    return cb(null, info);
  })
}

exports.get_firmware_info = function (callback) {
  logger.info(" get_firmware_infoget_firmware_infoget_firmware_infoget_firmware_info");

  var count = 0, data = {};
  var fetch = function (key, section, value) {
    wmic.get_value(section, value, null, function (err, res) {

      if (key == 'device_type') {
        res = err ? 'Desktop' : 'Laptop'
        data[key] = res;
      }
      if (!err && res)
        data[key] = res;
      --count || callback(null, data)
    })
  }
  //wmic fix 
  wmic.get_value('path win32_computersystemproduct', 'uuid', null, function (err, res) {
    logger.info(" get_firmware_info err: " + JSON.stringify(err));
    logger.info(" get_firmware_info res: " + JSON.stringify(res));

    if (err) {
      let data = { "uuid": "", "serial_number": "", "bios_vendor": "", "bios_version": "", "mb_vendor": "", "mb_serial": "", "mb_model": "", "mb_version": "", "device_type": "", "model_name": "", "vendor_name": "" };

      si.system((stdoutsi) => {

        logger.info(" get_firmware_info system: " + JSON.stringify(stdoutsi));
        data.uuid = stdoutsi.uuid.toUpperCase();
        data.serial_number = stdoutsi.serial;
        data.model_name = stdoutsi.model;
        data.vendor_name = stdoutsi.manufacturer;

        if (!data.serial_number || data.serial_number == "" || !data.uuid || data.uuid == "") {
          logger.info("serial_number vacio");

          exports.get_serial_number((err, output) => {
            logger.info("llamando al servicio windows get_serial_number ");
            logger.info("llamando al servicio windows get_serial_number err:" + JSON.stringify(err));
            logger.info("llamando al servicio windows get_serial_number output:" + JSON.stringify(output));

            // once finished, callback (if passed) or emit via hooks
            if (err)
              data.serial_number = 'SERIALNUMBERGENERATED'
            else
              data.serial_number = output.serialNumber;

            exports.get_uuid((err, output) => {
              logger.info("llamando al servicio windows get_uuid ");
              logger.info("llamando al servicio windows get_uuid err:" + JSON.stringify(err));
              logger.info("llamando al servicio windows get_uuid output:" + JSON.stringify(output));

              if (err)
                data.uuid = 'UUIDGENERATED'
              else{
                if (output && output.uuid) {
                  data.uuid = output.uuid;
                  logger.info("existe uuid 1 :" + JSON.stringify(output.uuid));
                }
                if (output && output.uuid2) {
                  data.uuid = output.uuid2;
                  logger.info("existe uuid 2 :" + JSON.stringify(output.uuid2));
                }
              }
              if (data.uuid ==""){
                data.uuid = 'UUIDGENERATED'
              }

              exports.get_bios_vendor((err, output) => {

                logger.info("llamando al servicio windows get_bios_vendor ");
                logger.info("llamando al servicio windows get_bios_vendor err:" + JSON.stringify(err));
                logger.info("llamando al servicio windows get_bios_vendor output:" + JSON.stringify(output));

                if (err) {
                  data.bios_vendor = 'BIOSVENDORGENERATED'
                  data.bios_version = 'MODELBVGENERATED'
                }
                else {
                  data.bios_vendor = output.manufacturer;
                  data.bios_version = output.version;
                }

                if (data.bios_vendor ==""){
                  data.bios_vendor = 'BIOSVENDORGENERATED'
                }

                if (data.bios_version ==""){
                  data.bios_version = 'MODELBVGENERATED'
                }


                si.bios((stdoutsi) => {

                  logger.info(" get_firmware_info bios: " + JSON.stringify(stdoutsi));

                  si.baseboard((stdoutsi) => {

                    logger.info(" get_firmware_info baseboard: " + JSON.stringify(stdoutsi));

                    data.mb_vendor =(stdoutsi.manufacturer) ? (stdoutsi.manufacturer) : null;
                    data.mb_serial = (stdoutsi.serial) ? (stdoutsi.serial) : null;
                    data.mb_model = (stdoutsi.model) ? (stdoutsi.model) : null;
                    data.mb_version = (stdoutsi.version) ? (stdoutsi.version) : null;
                    si.battery((stdoutsi) => {
                      logger.info(" get_firmware_info battery: " + JSON.stringify(stdoutsi));

                      //stdoutsi = {"hasBattery":false,"cycleCount":0,"isCharging":false,"designedCapacity":0,"maxCapacity":0,"currentCapacity":0,"voltage":0,"capacityUnit":"","percent":0,"timeRemaining":null,"acConnected":true,"type":"","model":"","manufacturer":"","serial":""}
                      if (!stdoutsi || !stdoutsi.hasBattery) {
                        data.device_type = 'Desktop'
                        logger.info("dataaaaaaaaaaaaaaa111111111111111111111 : " + JSON.stringify(data))

                        callback(null, data)
                      }
                      else {
                        data.device_type = 'Laptop'
                        logger.info("dataaaaaaaaaaaaaaa333333333333333333333333333333333333 : " + JSON.stringify(data))

                        callback(null, data)
                      }
                    })
                  })
                })
              })
            })
          })
        }
        else {

          si.bios((stdoutsi) => {

            logger.info(" get_firmware_info bios: " + JSON.stringify(stdoutsi));

            logger.info("222222222222222222222222222222222222");

            data.bios_vendor = stdoutsi.vendor;
            data.bios_version = stdoutsi.version;
            si.baseboard((stdoutsi) => {

              logger.info(" get_firmware_info baseboard: " + JSON.stringify(stdoutsi));
              logger.info("3333333333333333333333333333333333333");

              data.mb_vendor = stdoutsi.manufacturer;
              data.mb_serial = (stdoutsi.serial) ? (stdoutsi.serial) : null;
              data.mb_model = stdoutsi.model;
              data.mb_version = stdoutsi.version;
              si.battery((stdoutsi) => {
                logger.info("4444444444444444444444444444444444444444444");
                logger.info(" get_firmware_info battery: " + JSON.stringify(stdoutsi));

                //stdoutsi = {"hasBattery":false,"cycleCount":0,"isCharging":false,"designedCapacity":0,"maxCapacity":0,"currentCapacity":0,"voltage":0,"capacityUnit":"","percent":0,"timeRemaining":null,"acConnected":true,"type":"","model":"","manufacturer":"","serial":""}
                if (!stdoutsi || !stdoutsi.hasBattery) {
                  data.device_type = 'Desktop'
                  logger.info("dataaaaaaaaaaaaaaa111111111111111111111 : " + JSON.stringify(data))

                  callback(null, data)
                }
                else {
                  data.device_type = 'Laptop'
                  logger.info("dataaaaaaaaaaaaaaa333333333333333333333333333333333333 : " + JSON.stringify(data))

                  callback(null, data)
                }
              })
            })
          })
        }
      })
    }
    else {

      for (var key in firmware_keys) {
        count++;
        var values = firmware_keys[key];
        fetch(key, values[0], values[1]);
      }
    }
  })
};

exports.get_ram_module_list = function (cb) {

  var list = [],
    file = join(__dirname, 'ramcheck.vbs');

  exec('cscript ' + file + ' /B', function (err, stdout) {
    if (err) return cb(err);

    stdout.toString().split('---').forEach(function (block) {
      var data = {};

      block.split('\n').forEach(function (line) {
        var split = line.split(':'),
          key = split[0].replace(/ /g, '-'),
          val = (split[1] || '').trim();

        if (val && val != '') data[key] = val;
      })

      // cscript returns a "Windows Script Host" header, 
      // so make sure we don't get rubbish
      if (!data['Name']) return;
      // console.log(data);

      list.push({
        name: data['Name'],
        bank: data['Bank-Label'],
        location: data['Device-Locator'],
        // installed_on: data['Install-Date'],
        size: parseInt(data['Capacity']) / 1048576,
        form_factor: ram_form_factors[parseInt(data['Form-Factor'])] || 'Unknown',
        memory_type: ram_types[parseInt(data['Memory-Type'])] || 'Unknown',
        speed: parseInt(data['Speed']),
        data_width: parseInt(data['Data-Width'])
      });

    });

    cb(null, list);
  })
}

exports.get_tpm_module = function (cb) {
  system.get_as_admin('tpmModule', (err, info) => {
    if (err) return cb(err);

    try {
      info.manufacturer_version = info.manufacturerVersion;
      delete info.manufacturerVersion;
    } catch (e) {
      return cb(new Error("Error getting tpm module info: " + e.message));
    }

    return cb(null, info);
  })
}

exports.get_recovery_partition_status = function (cb) {
  if (gte(system.os_release, "10.0.0")) {
    let json = {};
    json.available = false;
    system.get_as_admin('recoveryPartition', (err, info) => {
      if (err) return cb(err);
      try {
        json.available = info.enabled;
        logger.info("info from recovery partition:" + JSON.stringify(info))
      } catch (e) {
        return cb(new Error("Error recoveryPartition info: " + e.message));
      }
      return cb(null, json);
    })
  }
  else {
    return cb(new Error('Only for version '))
  }
}

function get_wmic_ip_value(what, nic_name, cb) {
  exports.mac_address_for(nic_name, function (err, mac) {
    if (err || !mac)
      return cb(err || new Error('No MAC Address found.'));

    wmic.get_value('nicconfig', what, 'MACAddress = \'' + mac + '\'', function (err, out) {
      if (err) return cb(err);

      cb(null, out.split(',')[0].replace(/[^0-9\.]/g, ''));
    });
  })
}

exports.get_active_network_interface_name = function (cb) {
  wmic.get_value('nic', 'NetConnectionID', 'NetConnectionStatus = 2', cb);
};

exports.netmask_for = function (nic_name, cb) {
  get_wmic_ip_value('IPSubnet', nic_name, cb);
};

exports.gateway_ip_for = function (nic_name, cb) {
  get_wmic_ip_value('DefaultIPGateway', nic_name, cb);
};

exports.mac_address_for = function (nic_name, cb) {
  var cond = 'NetConnectionID = \'' + nic_name + '\'';
  wmic.get_value('nic', 'MACAddress', cond, cb);
}


exports.get_network_interfaces_list = function (callback) {

  var count,
    list = [],
    node_nics = os.networkInterfaces();

  function done() {
    logger.info("get_network_interfaces_list done:" + JSON.stringify(list))

    --count || callback(null, list);
  }

  function set_gateway(obj) {
    exports.gateway_ip_for(obj.name, function (err, res) {
      obj.gateway_ip = res && res != '' ? res : null;
      done();
    })
  }

  function set_netmask(obj) {
    exports.netmask_for(obj.name, function (err, res) {
      obj.netmask = res && res != '' ? res : null;
    })
  }

  const capitalize = (s) => {
    if (typeof s !== 'string') return ''
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  wmic.get_list('nic', function (err, nics) {
    logger.info("get_network_interfaces_list err:" + JSON.stringify(err))
    logger.info("get_network_interfaces_list nics:" + JSON.stringify(nics))
    logger.info("get_network_interfaces_list node_nics:" + JSON.stringify(node_nics))


    si.networkInterfaces()
      .then(function (value) {
        logger.info(" networkInterfaces then:" + JSON.stringify(value))

        // throw new Error("errrroooor");
      }, function (reason) {
        logger.info(" networkInterfaces reason:" + JSON.stringify(reason))
      })
      //.catch(error => console.log("catch:" , error));
      .catch(function (error) {
        logger.info(" networkInterfaces catch error:" + JSON.stringify(error))
      })



    if (err) {

      logger.info("get_network_interfaces_list get_network_interfaces_list pasa por err")

      callback(null, [])
    }
    else {
      logger.info("get_network_interfaces_list get_network_interfaces_list pasa por else 22222222222222222222222")

      callback(null, [])
      /* count = nics.length;
      nics.forEach(function(nic) {
        if (nic.Name && nic.NetConnectionID != '' && nic.MACAddress != '') {
  
          var obj = {
            name: nic.NetConnectionID,
            // description: nic.Name,
            mac_address: nic.MACAddress,
            ip_address: nic.IPAddress,
            vendor: nic.Manufacturer,
            model: nic.Description,
            type: nic.Name.match(/wi-?fi|wireless/i) ? 'Wireless' : 'Wired'
          }
  
          var node_nic = node_nics[obj.name] || [];
  
          node_nic.forEach(function(type) {
            if (type.family == 'IPv4') {
              obj.ip_address = type.address;
            }
          });
  
          list.push(obj);
          set_netmask(obj);        
          set_gateway(obj);
        } else {
          done();
        }
      }) */
    }
  });
};

exports.get_os_edition = system.get_os_edition;
exports.get_winsvc_version = system.get_winsvc_version;