var helpers        = require('./../../../helpers'),
    should         = require('should'),
    sinon          = require('sinon'),
    join           = require('path').join,
    needle         = require('needle'),
    commands       = helpers.load('commands'),
    sys_index_path = helpers.lib_path('system'),
    sys_index      = require(sys_index_path),
    sys_win        = require(join(sys_index_path, 'windows')),
    provider       = helpers.load('providers/encryption-status');

describe('Encryption status', () => {

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
      provider.get_encryption_status((err, obj) => {
        should.exist(err);
        err.message.should.containEql('Admin service not available');
        done();
      });
    });
  })

  describe('get status as admin', () => {
    var status_stub;

    before(() => {
      sys_win.monitoring_service_go = true;
      provider.timeout = 0;
      commands_stub = sinon.stub(commands, 'perform').callsFake(() => {
        return;
      });
    })

    after(() => {
      commands_stub.restore();
    })

    describe('when one or more disks are being encrypted', () => {
      var status = '{"err": null, "output": [{"mountPoint":"C:","size":"700.500","volumeStatus":"FullyDecrypted","encryptionPercentage":"0","encryptionMethod":"None","protectionStatus":"Off","lockStatus":"Unlocked","volumeType":"OperatingSystem","keyProtector":"{}"},{"size":"9.764645","mountPoint":"D:","volumeStatus":"EncryptionInProgress","encryptionPercentage":"75","encryptionMethod":"aes128","protectionStatus":"Off","lockStatus":"Unlocked","volumeType":"Data","keyProtector":"{RecoveryPassword}"}]}'

      before(() => {
        status_stub = sinon.stub(needle, 'post').callsFake((url, data, opts, cb) => {
          cb(null, null, status)
        });
      })

      after(() => {
        status_stub.restore();
      })

      it('schedules another status check', (done) => {
        provider.get_encryption_status((err, obj) => {
          should.not.exist(err);
          provider.scheduled.should.be.equal(true);
          done();
        });
      })
    })

    describe('when all disks are done', () => {
      var status2 = '{"err": null, "output": [{"mountPoint":"C:","size":"700.500","volumeStatus":"FullyDecrypted","encryptionPercentage":"0","encryptionMethod":"None","protectionStatus":"Off","lockStatus":"Unlocked","volumeType":"OperatingSystem","keyProtector":"{}"},{"mountPoint":"F:","size":"1.851563","volumeStatus":"FullyEncrypted","encryptionPercentage":"100","encryptionMethod":"aes128","protectionStatus":"On","lockStatus":"Unlocked","volumeType":"Removable","keyProtector":"{RecoveryPassword}"}]}'

      before(() => {
        status_stub = sinon.stub(needle, 'post').callsFake((url, data, opts, cb) => {
          cb(null, null, status2)
        });
      })

      after(() => {
        status_stub.restore();
      })


      it('does not schedules another status check', (done) => {
        provider.get_encryption_status(function(err, obj) {
          should.not.exist(err);
          provider.scheduled.should.be.equal(false);
          done();
        });
      })
    })

    describe('when the output is invalid', () => {
      var wrong_status = '{"err": null, "output": false}'

      before(() => {
        invalid_status_stub = sinon.stub(needle, 'post').callsFake((url, data, opts, cb) => {
          cb(null, null, wrong_status)
        });
      })

      after(() => {
        invalid_status_stub.restore();
      })

      it('returns an error', (done) => {
        provider.get_encryption_status(function(err, obj) {
          should.exist(err);
          err.message.should.containEql('Invalid encryption status information');
          done();
        });
      })
    })
  })
})





