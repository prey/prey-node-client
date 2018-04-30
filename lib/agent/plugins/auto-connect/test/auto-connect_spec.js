var should = require('should'),
    sinon = require('sinon'),
    reconnect = require('./../reconnect'),
    os_name      = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    network = require('./../../../providers/network')
    os_functions = require('./../' + os_name);

var ap_list = [ { ssid: 'Prey-Guest',
                  mac_address: '24:a4:3c:15:79:81',
                  signal_strength: -51,
                  channel: 1,
                  security: false },
                  { ssid: 'Unsecured Wifi',
                  mac_address: '64:d1:54:3e:e6:0d',
                  signal_strength: -66,
                  channel: 1,
                  security: false },
                  { ssid: 'Secured wifi',
                  mac_address: '12:34:56:78:ab:cd',
                  signal_strength: -66,
                  channel: 1,
                  security: 'WP2' }];

var close_ap_list = [ { ssid: 'Prey-Guest',
                        mac_address: '24:a4:3c:15:79:81',
                        signal_strength: -51,
                        channel: 1,
                        security: 'WP2' },
                        { ssid: 'Secured wifi',
                        mac_address: '12:34:56:78:ab:cd',
                        signal_strength: -66,
                        channel: 1,
                        security: 'WP2' }];

describe('auto connect', function() {

  describe('reconnect', function() {
    describe('get open ap list', function() {

      describe('on empty list', function() {
        before(function() {
          ap_list_stub = sinon.stub(network, 'get_access_points_list', function(cb) {
            cb(null, close_ap_list);
          })
        })

        after(function() {
          ap_list_stub.restore();
        })

        it('callback an error', function(done) {
          reconnect.get_open_ap_list(function(err, list) {
            should.exist(err);
            console.log("ERROR!", err)
            done();
          })
        })

      })

      describe('on non empty list', function() {
        before(function() {
          ap_list_stub = sinon.stub(network, 'get_access_points_list', function(cb) {
            cb(null, ap_list);
          })
        })

        after(function() {
          ap_list_stub.restore();
        })

        it('not callback error', function(done) {
          reconnect.get_open_ap_list(function(err, list) {
            should.not.exist(err);
            should.exist(list)
            done();
          })
        })

        it('returns a list only of open access points', function(done) {
          reconnect.get_open_ap_list(function(err, list) {
            list.length.should.be.equal(2);
            list[0].ssid.should.be.equal('Prey-Guest');
            list[0].security.should.be.equal(false);
            list[1].ssid.should.be.equal('Unsecured Wifi');
            list[1].security.should.be.equal(false);
            done();
          })
        })

      })
    })
  })

  describe('get existing profiles', function() {
    it('not callsback error', function(done) {
      reconnect.get_existing_profiles(function(err, profiles) {
        should.not.exist(err);
        profiles.should.be.an.Array;
        done();
      })
    })
  })
  
  describe('create profile', function() {

    it('not callsback error', function(done) {
      os_functions.create_profile('Prey-test', function(err) {
        should.not.exist(err);
        done();
      })
    })

    it('creates a Prey-test network profile', function(done) {
      os_functions.get_existing_profiles(function(err, profiles) {
        profiles.should.be.an.Array;
        profiles.indexOf('Prey-test').should.not.be.equal(-1);
        done();
      })
    })

  })

  describe('delete profile', function() {

    it('not callsback error', function(done) {
      os_functions.delete_profile('Prey-test', function(err) {
        should.not.exist(err);
        done();
      })
    })

    it('deletes the Prey-test network profile', function(done) {
      os_functions.get_existing_profiles(function(err, profiles) {
        profiles.should.be.an.Array;
        profiles.indexOf('Prey-test').should.be.equal(-1);
        done();
      })
    })
  })

  describe('try connect to access point', function() {

    before(function(done) {
      os_functions.delete_profile('Prey-test', function() {
        done();
      })
    })

    describe('when network does not exists', function() {
      it('returns an error output', function(done) {
        os_functions.connect_to_ap('Prey-test', function(err, out) {
          should.not.exist(err);
          out.should.containEql('Could not find network');
          done();
        });
      })
    })

  })

})