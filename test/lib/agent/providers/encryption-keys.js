var helpers        = require('./../../../helpers'),
    should         = require('should'),
    sinon          = require('sinon'),
    join           = require('path').join,
    needle         = require('needle'),
    commands       = helpers.load('commands'),
    sys_index_path = helpers.lib_path('system'),
    sys_index      = require(sys_index_path),
    sys_win        = require(join(sys_index_path, 'windows')),
    provider_keys  = helpers.load('providers/encryption-keys');

describe('Encryption keys', () => {

  before(() => {
    sys_index.os_name = "windows"
    sys_index.check_service = sys_win.check_service;
    sys_index.run_as_admin = sys_win.run_as_admin;
    sys_index.get_as_admin = sys_win.get_as_admin;
  })

  describe('when service not available', () => {
    before(() => {
      sys_win.monitoring_service_go = false;
      check_service_stub = sinon.stub(needle, 'get').callsFake((url, cb) => {
        return cb(new Error("BUH!"));
      });
    });

    after(() => {
      check_service_stub.restore();
    })

    it('returns error', (done) => {
      provider_keys.get_encryption_keys((err, obj) => {
        should.exist(err);
        err.message.should.containEql('Admin service not available');
        done();
      });
    });
  })

  describe('get keys as admin', () => {
    var keys_stub;

    before(() => {
      sys_win.monitoring_service_go = true;
      provider_keys.timeout = 0;
      commands_stub = sinon.stub(commands, 'perform').callsFake(() => {
        return;
      });
    })

    after(() => {
      commands_stub.restore();
    })

    describe('when one or more disks are being encrypted', () => {
      var keys = '{"err": null, "output": [{"mountPoint":"C:","encryptionKey":"","securityType":"","encryptionPassword":"","diskStatus":""}, {"mountPoint":"D:","encryptionKey":"D40F686D-D402-41D9-BB02-9CCB0AB6AD33","securityType":"RecoveryPassword","encryptionPassword":"130031-238238-080982-333795-366278-161326-517352-139458","diskStatus":"encrypted"}]}'

      before(() => {
        
        keys_stub = sinon.stub(needle, 'post').callsFake((url, data, opts, cb) => {
          cb(null, null, keys)
        });
      })

      after(() => {
        keys_stub.restore();
      })

      it('schedules another keys check', (done) => {
        provider_keys.get_encryption_keys((err, obj) => {
          should.not.exist(err);
          provider_keys.scheduled.should.be.equal(true);
          done();
        });
      })
    })

    describe('when all disks are all decrypted', () => {
      var keys2 = '{"err": null, "output": [{"mountPoint":"C:","encryptionKey":"","securityType":"","encryptionPassword":"","diskStatus":""}, {"mountPoint":"D:","encryptionKey":"","securityType":"","encryptionPassword":"","diskStatus":""}]}'

      before(() => {
        provider_keys.timeout = 250;
        keys_stub = sinon.stub(needle, 'post').callsFake((url, data, opts, cb) => {
          cb(null, null, keys2)
        });
      })

      after(() => {
        keys_stub.restore();
      });

      it('does not schedules another keys fetch', (done) => {
        provider_keys.get_encryption_keys(function(err, obj) {
          setTimeout(() => {
            should.not.exist(err);
            provider_keys.scheduled.should.be.equal(false);
            done();
          }, 400);
        });
      })
    })

    describe('when the output is invalid', () => {
      var wrong_keys = '{"err": null, "output": false}'

      before(() => {
        invalid_keys_stub = sinon.stub(needle, 'post').callsFake((url, data, opts, cb) => {
          cb(null, null, wrong_keys)
        });
      })

      after(() => {
        invalid_keys_stub.restore();
      })

      it('returns an error', (done) => {
        provider_keys.get_encryption_keys(function(err, obj) {
          should.exist(err);
          err.message.should.containEql('Invalid encryption keys information');
          done();
        });
      })
    })
  })
})


