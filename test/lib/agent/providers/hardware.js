var join        = require('path').join,
    tmpdir      = require('os').tmpdir,
    helpers     = require('./../../../helpers'),
    sinon       = require('sinon'),
    should      = require('should'),
    lib_path    = helpers.lib_path(),
    storage     = require(join(lib_path, 'agent', 'utils', 'storage')),
    os          = require('os'),
    provider    = helpers.load('providers/hardware');

describe('hardware', function(){

  describe('first_mac_address', function() {

    it('should cb a valid mac address', function(done) {
      provider.get_first_mac_address(function(err, mac) {
        should.exist(mac);
        mac.should.have.lengthOf(17);
        done();
      });
    });

  });

  describe('network_interfaces_list', function() {

    it('should return at least 1 network interface',function(done) {
      provider.get_network_interfaces_list(function(err, nics) {

        should.not.exist(err);

        nics.should.be.an.Array;
        nics.length.should.be.above(0);

        var keys = ['name', 'type', 'ip_address', 'mac_address'];
        if (process.platform == 'win32')
          keys = keys.concat(['vendor', 'model']);

        var nic = nics[0];
        keys.forEach((key, index) => {
          nic.should.have.key(key);
          if (index == keys.length - 1) done();
        })
      });
    });
  });

  describe('get_firmware_info', function(){

    // in linux there's a scenario when we don't have access to dmidecode
    describe('with no access to system info', function() {

      it('returns error');

    });

    describe('with access to sys info', function() {

      it('works')

    })

  });

  describe('get_processor_info', function(){

    it('should callback an object with model, speed and cores',function(done) {

      provider.get_processor_info(function(err, obj) {
        should.not.exist(err);
        obj.should.have.keys('speed', 'model', 'cores');
        done();
      });

    });

  });


  describe('hardware_changes', () => {

    var stored_data = [{
      processor_info: {
      model: 'Intel(R) Core(TM) i5 CPU @ 1.80GHz', speed: 1800, cores: 4 },
      network_interfaces_list: [
        { name: 'en0', type: 'Wireless', ip_address: '10.10.0.00', mac_address: 'aa:11:1a:ab:ba:ee' },
        { name: 'en2', type: 'Other', ip_address: null, mac_address: 'dd:77:7a:ab:ba:ff' }
      ],
      ram_module_list: [
        { bank: 'Bank 0/DIMM0:', size: 4096, speed: 1600, vendor: 'Samsung Electronics, Inc.', memory_type: 'DDR3', serial_number: '-' },
        { bank: 'Bank 1/DIMM0:', size: 4096, speed: 1600, vendor: 'Samsung Electronics, Inc.', memory_type: 'DDR3', serial_number: '-' } ],
      firmware_info: {
        device_type: 'Laptop', model_name: 'MacBook Air', vendor_name: 'Apple', bios_vendor: 'Apple', bios_version: '184.0.0.0.0',
        mb_version: '2.27f2', serial_number: 'XXXXXXXXXXX', uuid: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
      }
    },
    {
      processor_info: {
      model: 'Intel(R) Core(TM) i5 CPU @ 1.80GHz', speed: 1800, cores: 4 },
      network_interfaces_list: [
        { name: 'en0', type: 'Wireless', ip_address: '10.10.0.00', mac_address: 'aa:11:1a:ab:ba:ee' },
        { name: 'en2', type: 'Other', ip_address: null, mac_address: 'dd:77:7a:ab:ba:ff' }
      ],
      ram_module_list: [
        { bank: 'Bank 0/DIMM0:', size: 4096, speed: 1600, vendor: 'Samsung Electronics, Inc.', memory_type: 'DDR3', serial_number: '-' },
        { bank: 'Bank 1/DIMM0:', size: 4096, speed: 1600, vendor: 'Samsung Electronics, Inc.', memory_type: 'DDR3', serial_number: '-' } ],
      firmware_info: {
        device_type: 'Laptop', model_name: 'MacBook Air', vendor_name: 'Apple', bios_vendor: 'Apple', bios_version: '184.0.0.0.0',
        mb_version: '2.27f2', serial_number: 'XXXXXXXXXXX', uuid: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
      },
    }]

    var dummy_data4 = {
      processor_info: {
      model: 'Intel(R) Core(TM) i5 CPU @ 1.80GHz', speed: 1800, cores: 4 },
      network_interfaces_list: [
        { name: 'en2', type: 'Other', ip_address: null, mac_address: 'dd:77:7a:ab:ba:ff' },
        { name: 'en0', type: 'Wireless', ip_address: '10.10.0.00', mac_address: 'aa:11:1a:ab:ba:ee' },
      ],
      ram_module_list: [
        { bank: 'Bank 1/DIMM0:', size: 4096, speed: 1600, vendor: 'Samsung Electronics, Inc.', memory_type: 'DDR3', serial_number: '-' },
        { bank: 'Bank 0/DIMM0:', size: 4096, speed: 1600, vendor: 'Samsung Electronics, Inc.', memory_type: 'DDR3', serial_number: '-' }, ],
      firmware_info: {
        device_type: 'Laptop', model_name: 'MacBook Air', vendor_name: 'Apple', bios_vendor: 'Apple', bios_version: '184.0.0.0.0',
        mb_version: '2.27f2', serial_number: 'XXXXXXXXXXX', uuid: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
      },
    }

    var dummy_data1 = {
      processor_info: {
      model: 'Intel(R) Core(TM) i5 CPU @ 1.80GHz', speed: 1800, cores: 4 },
      network_interfaces_list: [
        { name: 'en2', type: 'Other', ip_address: null, mac_address: 'dd:77:7a:ab:ba:ff' },
        { name: 'en0', type: 'Wireless', ip_address: '10.10.0.00', mac_address: 'aa:11:1a:ab:ba:ee' }
      ],
      ram_module_list: [
        { bank: 'Bank 1/DIMM0:', size: 4096, speed: 1600, vendor: 'Samsung Electronics, Inc.', memory_type: 'DDR3', serial_number: '-' },
        { bank: 'Bank 0/DIMM0:', size: 4096, speed: 1600, vendor: 'Samsung Electronics, Inc.', memory_type: 'DDR3', serial_number: '-' }],
      firmware_info: {
        device_type: 'Laptop', model_name: 'MacBook Air', vendor_name: 'Apple', bios_vendor: 'Apple', bios_version: '184.0.0.0.0',
        mb_version: '2.27f2', serial_number: 'XXXXXXXXXXX', uuid: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
      }
    }

    var dummy_data = {
      processor_info: {
      model: 'Intel(R) Core(TM) i5 CPU @ 1.80GHz', speed: 1800, cores: 4 },
      network_interfaces_list: [
        { name: 'en0', type: 'Wireless', ip_address: '10.10.0.00', mac_address: 'aa:11:1a:ab:ba:ee' },
        { name: 'en2', type: 'Other', ip_address: null, mac_address: 'dd:77:7a:ab:ba:ff' },
        { name: 'en1', type: 'Another', ip_address: null, mac_address: 'aa:bb:cc::dd:ee:ff' },
      ],
      ram_module_list: [
        { bank: 'Bank 0/DIMM0:', size: 4096, speed: 1600, vendor: 'Samsung Electronics, Inc.', memory_type: 'DDR3', serial_number: '-' },
        { bank: 'Bank 1/DIMM0:', size: 4096, speed: 1600, vendor: 'Samsung Electronics, Inc.', memory_type: 'DDR3', serial_number: '-' } ],
      firmware_info: {
        device_type: 'Laptop', model_name: 'MacBook Air', vendor_name: 'Apple', bios_vendor: 'Apple', bios_version: '184.0.0.0.0',
        mb_version: '2.27f2', serial_number: 'XXXXXXXXXXX', uuid: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
      }
    }

    var dummy_data2 = {
      processor_info: {
      model: 'Intel(R) Core(TM) i5 CPU @ 1.80GHz', speed: 1800, cores: 4 },
      network_interfaces_list: [
        { name: 'en0', type: 'Wireless', ip_address: '10.10.0.00', mac_address: 'aa:11:1a:ab:ba:ee' }
      ],
      ram_module_list: [
        { bank: 'Bank 0/DIMM0:', size: 4096, speed: 1600, vendor: 'Samsung Electronics, Inc.', memory_type: 'DDR3', serial_number: '-' },
        { bank: 'Bank 1/DIMM0:', size: 4096, speed: 1600, vendor: 'Samsung Electronics, Inc.', memory_type: 'DDR3', serial_number: '-' } ],
      firmware_info: {
        device_type: 'Laptop', model_name: 'MacBook Air', vendor_name: 'Apple', bios_vendor: 'Apple', bios_version: '184.0.0.0.0',
        mb_version: '2.27f2', serial_number: 'XXXXXXXXXXX', uuid: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
      }
    }

    var dummy_data3 = {
      processor_info: {
      model: 'Intel(R) Core(TM) i5 CPU @ 1.80GHz', speed: 1800, cores: 4 },
      network_interfaces_list: [
        { name: 'en0', type: 'Wireless', ip_address: '10.10.0.00', mac_address: 'aa:11:1a:ab:ba:ee' },
        { name: 'en2', type: 'No Other', ip_address: null, mac_address: 'dd:77:7a:ab:ba:ff' }
      ],
      ram_module_list: [
        { bank: 'Bank 0/DIMM0:', size: 4096, speed: 1600, vendor: 'Samsung Electronics, Inc.', memory_type: 'DDR3', serial_number: '-' },
        { bank: 'Bank 1/DIMM0:', size: 4096, speed: 1600, vendor: 'Samsung Electronics, Inc.', memory_type: 'DDR3', serial_number: '-' } ],
      firmware_info: {
        device_type: 'Laptop', model_name: 'MacBook Air', vendor_name: 'Apple', bios_vendor: 'Apple', bios_version: '184.0.0.0.0',
        mb_version: '2.27f2', serial_number: 'YYYYYYYYYYYY', uuid: 'XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
      }
    }

    describe('when doesnt exists stored hardware', () => {
      var spy_del,
          spy_store;

      before((done) => {
        spy_store = sinon.spy(storage.storage_fns, 'set');
        spy_del = sinon.spy(storage.storage_fns, 'del');
        storage.init('keys', tmpdir() + '/hardware.db', done)
      })

      after((done) => {
        spy_del.restore();
        spy_store.restore();
        storage.erase(tmpdir() + '/hardware.db', done);
      })

      it('stores the data', (done) => {
        provider.track_hardware_changes(dummy_data1);
        setTimeout(() => {
          spy_store.calledOnce.should.be.true;
          spy_del.notCalled.should.be.true;

          storage.do('all', {type: 'keys'}, (err, rows) => {
            should.not.exist(err);
            rows.length.should.be.equal(1);
            rows[0].id.should.be.equal("hardware");
            done();
          })
        }, 500)
      })
    })

    describe('when exists stored hardware', () => {
      var spy_del,
          spy_store;

      describe('and the data is the same', () => {

        before((done) => {
          storage.init('keys', tmpdir() + '/hardware.db', () => {
            storage.do('set', {type: 'keys', id: 'hardware', data: {value: JSON.stringify(dummy_data1)}}, () => {
              spy_store = sinon.spy(storage.storage_fns, 'set');
              spy_del = sinon.spy(storage.storage_fns, 'del');
              done();
            })
          });
        })

        after((done) => {
          spy_store.restore();
          spy_del.restore();
          storage.erase(tmpdir() + '/hardware.db', done);
        })

        it('shouldnt edit the local database', (done) => {
          storage.do('all', {type: 'keys'}, (err, rows) => {
            provider.track_hardware_changes(stored_data[0]);
            setTimeout(() => {
              spy_store.callCount.should.be.equal(0);
              spy_del.callCount.should.be.equal(0);
              done();
            }, 500);
          })
        })
      });

      describe('and the data is the same but it is not ordered', () => {

        before((done) => {
          storage.init('keys', tmpdir() + '/hardware.db', () => {
            storage.do('set', {type: 'keys', id: 'hardware', data: {value: JSON.stringify(dummy_data4)}}, () => {
              spy_store = sinon.spy(storage.storage_fns, 'set');
              spy_del = sinon.spy(storage.storage_fns, 'del');
              done();
            })
          });
        })

        after((done) => {
          spy_store.restore();
          spy_del.restore();
          storage.erase(tmpdir() + '/hardware.db', done);
        })

        it('shouldnt edit the local database', (done) => {
          storage.do('all', {type: 'keys'}, (err, rows) => {
            provider.track_hardware_changes(stored_data[1]);
            setTimeout(() => {
              spy_store.callCount.should.be.equal(0);
              spy_del.callCount.should.be.equal(0);
              done();
            }, 500);
          })
        })
      });

      describe('and the data is different', () => {
        var spy_del,
            spy_store;

        before((done) => {
          storage.init('keys', tmpdir() + '/hardware.db', () => {
            storage.do('set', {type: 'keys', id: 'hardware', data: {value: JSON.stringify(dummy_data1)}}, done)
          })
        })

        after((done) => {
          storage.erase(tmpdir() + '/hardware.db', done);
        });

        describe('when theres a new field', () => {
          before(() => {
            spy_store = sinon.spy(storage.storage_fns, 'set');
            spy_del = sinon.spy(storage.storage_fns, 'del');
          })

          after(() => {
            spy_store.restore();
            spy_del.restore();
          })

          it('replace the stored data1', (done) => {
            provider.track_hardware_changes(dummy_data);
            setTimeout(() => {
              storage.do('all', {type: 'keys'}, (err, rows) => {
                JSON.parse(rows[0].value).network_interfaces_list.length.should.be.equal(3);
                spy_store.callCount.should.be.equal(1);
                spy_del.callCount.should.be.equal(1);
                done();
              });
            }, 500)
          })
        })

        describe('when a field is missing', () => {
          before(() => {
            spy_store = sinon.spy(storage.storage_fns, 'set');
            spy_del = sinon.spy(storage.storage_fns, 'del');
          })

          after(() => {
            spy_store.restore();
            spy_del.restore();
          })

          it('replace the stored data2', (done) => {
            provider.track_hardware_changes(dummy_data2);
            setTimeout(() => {
              storage.do('all', {type: 'keys'}, (err, rows) => {
                JSON.parse(rows[0].value).network_interfaces_list.length.should.be.equal(3);
                //spy_store.callCount.should.be.equal(1);
                //spy_del.callCount.should.be.equal(1);
                done();
              });
            }, 500)
          })
        })

        describe('when a field changed', () => {
          before(() => {
            spy_store = sinon.spy(storage.storage_fns, 'set');
            spy_del = sinon.spy(storage.storage_fns, 'del');
          })

          after(() => {
            spy_store.restore();
            spy_del.restore();
          })

          it('replace the stored data3', (done) => {
            provider.track_hardware_changes(dummy_data3);
            setTimeout(() => {
              storage.do('all', {type: 'keys'}, (err, rows) => {
                var data = JSON.parse(rows[0].value);

                data.network_interfaces_list.length.should.be.equal(2);
                data.firmware_info.serial_number.should.be.equal('YYYYYYYYYYYY');
                spy_store.callCount.should.be.equal(1);
                spy_del.callCount.should.be.equal(1);
                done();
              });
            }, 500)
          })
        })

      })
    })
  })
});
