var should       = require('should'),
    sinon        = require('sinon'),
    helpers      = require('./../../../helpers'),
    reconnect    = helpers.load('triggers/auto-connect/reconnect'),
    network      = helpers.load('providers/network');
    os_name      = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    os_functions = helpers.load('triggers/auto-connect/' + os_name);

var ap_list = [ { ssid: 'Prey-Guest',
                  mac_address: '11:22:33:44:55:66',
                  signal_strength: -51,
                  channel: 1,
                  security: false },
                { ssid: 'Unsecured Wifi',
                  mac_address: 'ab:cd:ef:gh:ij:kl',
                  signal_strength: -66,
                  channel: 1,
                  security: false },
                { ssid: 'Secured wifi',
                  mac_address: '12:34:56:78:ab:cd',
                  signal_strength: -66,
                  channel: 1,
                  security: 'WP2' }];

var close_ap_list = [ { ssid: 'Prey-Guest',
                        mac_address: '11:22:33:44:55:66',
                        signal_strength: -51,
                        channel: 1,
                        security: 'WP2' },
                        { ssid: 'Secured wifi',
                        mac_address: '12:34:56:78:ab:cd',
                        signal_strength: -66,
                        channel: 1,
                        security: 'WP2' }];

var open_ap_list = [ { ssid: 'Prey-test',
                      mac_address: 'oe:oe:oe:oe:oe:oe',
                      signal_strength: -51,
                      channel: 1,
                      security: false }];

var da_profiles = [];


describe('auto connect', function() {
  before(function() {
    create_profile = sinon.stub(os_functions, 'create_profile', function(ssid, cb) {
      if (da_profiles.indexOf(ssid) > -1) return cb(new Error('profile already exists'));
      da_profiles.push(ssid);
      return cb(null);
    });

    delete_profile = sinon.stub(os_functions, 'delete_profile', function(ssid, cb) {
      var index = da_profiles.indexOf(ssid);
      if (index > -1) {
        da_profiles.splice(index, 1);
      } else return cb(new Error('Nothing to delete'));
      return cb(null);
    });

    existing_profiles = sinon.stub(os_functions, 'get_existing_profiles', function(cb) {
      return cb(null, da_profiles);
    });

    enable_wifi = sinon.stub(os_functions, 'enable_wifi', function(cb) {
      return cb();
    });

  })

  after(function() {
    create_profile.restore();
    delete_profile.restore();
    existing_profiles.restore();
    enable_wifi.restore();
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

  describe('get open ap list', function() {

    describe('on empty list', function() {
      before(function() {
        reconnect.is_connected(false);
        ap_list_stub = sinon.stub(network, 'get_access_points_list', function(cb) {
          cb(null, close_ap_list);
        })
      })

      after(function() {
        ap_list_stub.restore();
      })

      it('callback an error', function(done) {
        reconnect.get_ap_lists(function(err, list) {
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

      after(function(done) {
        reconnect.delete_profile('Unsecured Wifi', function() {
          ap_list_stub.restore();
          done();
        })
      })

      describe('when in the secured list there a profile in the current list', () => {
        before(() => {
          profiles_stub = sinon.stub(reconnect, 'get_existing_profiles', function(cb) {
            cb(null, ['Pery', 'Secured wifi']);
          })
        })

        after(() => {
          profiles_stub.restore();
        })

        it('gonna try to connect to the secured wifi first', (done) => {
          reconnect.get_ap_lists(function(err, list) {
            should.not.exist(err);
            should.exist(list);
            list[0].ssid.should.be.equal('Secured wifi');
            list[1].ssid.should.be.equal('Prey-Guest');
            done();
          })
        })
      })

      describe('when in the secured list there a profile in the current list', () => {
        before(() => {
          profiles_stub = sinon.stub(reconnect, 'get_existing_profiles', function(cb) {
            cb(null, []);
          })
        })

        after(() => {
          profiles_stub.restore();
        })

        it('not callback error', function(done) {
          reconnect.get_ap_lists(function(err, list) {
            should.not.exist(err);
            should.exist(list)
            done();
          })
        })

        it('returns a list only of open access points', function(done) {
          reconnect.get_ap_lists(function(err, list) {
            list.length.should.be.equal(2);
            list[0].ssid.should.be.equal('Prey-Guest');
            list[0].security.should.be.equal(false);
            list[1].ssid.should.be.equal('Unsecured Wifi');
            list[1].security.should.be.equal(false);
            done();
          })
        })

        describe('when an open access has been attempted 3 times', function() {
          before(function() {
            reconnect.attempted_wifi = { 'Unsecured Wifi': 3 }
          })

          it('shouldnt return that ap in the final list', function(done) {
            reconnect.get_ap_lists(function(err, list) {
              should.not.exist(err);
              should.exist(list);
              list.length.should.be.equal(1);
              list[0].ssid.should.be.equal('Prey-Guest');
              done();
            })
          })
        })
      })
    })
  })

  describe('create profile', function() {

    before(function(done) {
      reconnect.init_profiles = [];
      reconnect.delete_profile(open_ap_list[0], function() {
        done();
      })
    })

    after(function(done) {
      reconnect.delete_profile(open_ap_list[0], function(err) {
        done();
      })
    })

    it('not callsback error', function(done) {
      reconnect.create_profile(open_ap_list[0], function(err) {
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
      reconnect.create_profile(open_ap_list[0], function(err) {
        should.exist(err);
        err.message.should.containEql('already exists');
        done();
      })
    })
  })

  describe('delete profile', function() {

    describe('when profile does not exists', function() {
      it('callbacks an error', function(done) {
        reconnect.delete_profile(open_ap_list[0], function(err) {
          should.exist(err);
          err.message.should.containEql('Nothing to delete');
          done();
        })
      })
    })

    describe('when profile exists', function() {
      before(function(done) {
        reconnect.create_profile(open_ap_list[0], function() {
          done();
        })
      })

      it('not callsback an error', function(done) {
        reconnect.delete_profile(open_ap_list[0], function(err) {
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

    describe('when network does not exists', function() {
      before(function() {
        connect_to_ap = sinon.stub(os_functions, 'connect_to_ap', function(ssid, cb) {
          cb(null, 'Could not find network');
        });
      })

      after(function() {
        connect_to_ap.restore();
      })

      it('returns an error output', function(done) {
        reconnect.connect_to_access_point(open_ap_list[0], function(err, out) {
          should.not.exist(err);
          out.should.containEql('Could not find network');
          done();
        });
      })
    })

    describe('when theres an attempt to connect to an ap', function() {
      before(function() {
        reconnect.attempted_wifi = {};
        ap_list_stub = sinon.stub(os_functions, 'connect_to_ap', function(ssid, cb) {
          cb(null, 'not connected!');
        })
      })

      after(function(done) {
        ap_list_stub.restore();
        reconnect.delete_profile(open_ap_list[0], function() {
          done();
        })
      })

      it('will add the ap to the attempts list', function(done) {
        reconnect.connect_to_access_point(open_ap_list[0], function() {
          Object.keys(reconnect.attempted_wifi).length.should.be.equal(1);
          reconnect.attempted_wifi[open_ap_list[0].ssid].should.be.equal(1);
          done();
        })
      })

      it('will increment the attempt number for that ap', function(done) {
        reconnect.connect_to_access_point(open_ap_list[0], function() {
          Object.keys(reconnect.attempted_wifi).length.should.be.equal(1);
          reconnect.attempted_wifi[open_ap_list[0].ssid].should.be.equal(2);
          done();
        })
      })

      describe('when tryes to connect to another ap', function() {
        after(function(done) {
          reconnect.delete_profile(ap_list[1], function() {
            done();
          })
        })

        it('should keep saved the previous ap attempts', function(done) {
          reconnect.connect_to_access_point(ap_list[1], function() {
            Object.keys(reconnect.attempted_wifi).length.should.be.equal(2);
            reconnect.attempted_wifi[open_ap_list[0].ssid].should.be.equal(2);
            reconnect.attempted_wifi[ap_list[1].ssid].should.be.equal(1);
            done();
          })
        })
      })
    })
  })

  describe('try connecting to ap list', function() {

    describe('when go through the entire list', function() {
      before(function() {
        reconnect.time_between = 0;
        ap_list_stub = sinon.stub(os_functions, 'connect_to_ap', function(ssid, cb) {
          cb(null, 'not connected!');
        })
      })

      after(function() {
        ap_list_stub.restore();
      })

      it('returns finished error', function(done) {
        reconnect.try_connecting_to(open_ap_list, function(err) {
          should.exist(err);
          err.message.should.containEql('Connection attempted with all the open access points');
          done();
        })
      })
    })

    describe('when device connects', function() {
      before(function() {
        reconnect.attempted_wifi = { 'Pery': 1 };
        reconnect.is_connected(true);
        reconnect.is_connected_to({ ssid: 'Pery', mac_address: 'oa:oa:oa:oa:oa:oa', signal_strength: -51, channel: 1,security: 'WP2' });
      })

      after(function() {
        ap_list_stub.restore();
      })

      it('returns already connected error', function(done) {
        reconnect.try_connecting_to(open_ap_list, function(err) {
          should.exist(err);
          err.message.should.containEql('Already connected to:');
          done();
        })
      })

      it('deletes the ap from the attempts list', function(done) {
        Object.keys(reconnect.attempted_wifi).length.should.be.equal(0);
        done();
      })

    })
  })
})