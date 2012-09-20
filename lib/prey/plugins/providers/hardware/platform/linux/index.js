var
  exec = require('child_process').exec,
  async = require('async'),
  utils = require('util'),
  assert = require('assert'),
  managedCache = Prey.utils.managedCache,
  cache = managedCache.create();

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
};

var firmWare  = function (callback) {

  var get_value = function(output, string) {
    var regex = new RegExp(string + ": (.*)");
    var matches = output.toString().match(regex);
		if (matches) {
			return matches[1].trim() === '' ? null : matches[1];
    }
    return null;
	};

  var types = Object.keys(data_fields),
	    data = {},
	    error = false;

  async.parallel(types.map(function(type) {
    return function(acb) {
      exec('dmidecode -t ' + type, function(err, stdout, stderr) {
        if(err) {
          throw err;
        }
        var fields = data_fields[type];
        Object.keys(fields).map(function(key) {
          var val = get_value(stdout, fields[key]);
				  if (val) {
					  data[key] = val.trim();
          }
			  });
        acb(null,"");
      });
    };
  }),
  function(err,results){
    callback(data);
  });
};

var mac_address_cmd = function(nic){
	return "ifconfig | grep " + nic + " | grep 'HWaddr' | awk '{print $5}'";
};

cache.manage('firmware',firmWare);

/*
  The cache key 'macs' is updated manually within the mac_address function, and hence uses
  cache.set
*/
var macs = {} ;
cache.manage('macs',function(cb) { cb(macs); });

// ---------------------- public ---------------------------

exports.validNics = function(nics) {
  return nics.filter(function(n) { return n !== "lo0" && n !== "lo" ; });
};

exports.mac_address = function(nic_name,callback) {
  cache.value('macs',function(cachedMacs) {
    
    var value = cachedMacs[nic_name];
    if (value) {
      console.log('got cachedVal'+utils.inspect(cachedMacs));
      callback(value);
      return;
    }

    console.log('not found mac for '+nic_name);

    exec(mac_address_cmd(nic_name), function(err, stdout, stderr){
		  if (err) {
        throw err;
      }
        
      var newValue = stdout.trim();
      cachedMacs[nic_name] = newValue;

      /*
        The cached value has been freshened here! So, cache.set let's cache know
        about this manual update of a composite object and keeps the cache stats
        in up to date.
      */
      cache.set('macs',cachedMacs);
      
      callback(newValue);
      
    });
  });
};

exports.get_first_mac_address = function(cb) {
  cache.value('macs',function(macs) {
    var keys = Object.keys(macs);
    assert(keys.length > 0);
    cb(macs[keys[0]]);
  });
};

exports.get_firmware_info = function(callback){
  cache.value('firmware',callback);
};

exports.getCacheStats = function() {
  return managedCache.stats(cache);
};
