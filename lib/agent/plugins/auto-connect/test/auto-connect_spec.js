var should = require('should'),
    sinon = require('sinon'),
    reconnect = require('./../reconnect'),
    network = require('./../../../providers/network'),
    providers = require('./../../../providers');

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

var open_ap_list = [ { ssid: 'Prey-test',
                      mac_address: '24:a4:3c:15:79:81',
                      signal_strength: -51,
                      channel: 1,
                      security: false }
                      ];

describe('auto connect', function() {
  before(function(done) {
    reconnect.delete_profile('Prey-test', function() {
      done();
    })
  })

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
            err.message.should.containEql('No open access points found');
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

    before(function(done) {
      reconnect.init_profiles = [];
      reconnect.delete_profile('Prey-test', function() {
        done();
      })
    })

    after(function(done) {
      reconnect.delete_profile('Prey-test', function(err) {
        done();
      })
    })

    it('not callsback error', function(done) {
      reconnect.create_profile('Prey-test', function(err) {
        should.not.exist(err);
        done();
      })
    })

    it('creates a Prey-test network profile', function(done) {
      reconnect.get_existing_profiles(function(err, profiles) {
        profiles.should.be.an.Array;
        profiles.indexOf('Prey-test').should.not.be.equal(-1);
        done();
      })
    })

    it('returns errors when profile already exists', function(done){
      reconnect.create_profile('Prey-test', function(err) {
        should.exist(err);
        err.message.should.containEql('already exists');
        done();
      })
    })
  })

  describe('delete profile', function() {

    describe('when profile does not exists', function() {
      it('callbacks an error', function(done) {
        reconnect.delete_profile('Prey-test', function(err) {
          should.exist(err);
          err.message.should.containEql('Nothing to delete');
          done();
        })
      })
    })

    describe('when profile exists', function() {
      before(function(done) {
        reconnect.create_profile('Prey-test', function() {
          done();
        })
      })

      it('not callsback an error', function(done) {
        reconnect.delete_profile('Prey-test', function(err) {
          should.not.exist(err);
          done();
        })
      })

      it('deletes the Prey-test network profile', function(done) {
        reconnect.get_existing_profiles(function(err, profiles) {
          profiles.should.be.an.Array;
          profiles.indexOf('Prey-test').should.be.equal(-1);
          done();
        })
      })
    })
  })

  describe('try connect to access point', function() {

    before(function(done) {
      reconnect.delete_profile('Prey-test', function() {
        done();
      })
    })

    describe('when network does not exists', function() {
      it('returns an error output', function(done) {
        reconnect.connect_to_access_point(open_ap_list[0], function(err, out) {
          should.not.exist(err);
          out.should.containEql('Could not find network');
          done();
        });
      })
    })

  })

  describe('try connecting to ap list', function() {

    describe('when go through the entire list', function() {
      before(function() {
        reconnect.time_between = 0;
      })

      it('returns finished error', function(done) {
        reconnect.try_connecting_to(open_ap_list, function(err) {
          console.log("ERROR!!!", err)
          should.exist(err);
          err.message.should.be.equal('TERMINO');
          done();
        })
      })

    })

    describe('when device connects', function() {
      before(function() {
        reconnect.connected({ ssid: 'Pery', mac_address: '24:a4:3c:15:79:81', signal_strength: -51, channel: 1,security: 'WP2' });
      })

      after(function() {
        ap_list_stub.restore();
      })

      it('returns already connected error', function(done) {
        reconnect.try_connecting_to(open_ap_list, function(err) {
          console.log("ERROR!!!", err)
          should.exist(err);
          err.message.should.containEql('Already connected to:');
          done();
        })
      })

    })

  })

})