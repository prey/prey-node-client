/* eslint-disable no-undef */
var join           = require('path').join,
    helpers        = require(join('..', '..', 'helpers')),
    should         = require('should'),
    sinon          = require('sinon'),
    assert         = require('assert'),
    sys_index_path = helpers.lib_path('system'),
    sys_index      = require(sys_index_path),
    sys_win        = require(join(sys_index_path, 'windows')),
    os             = require('os'),
    sending        = { count: 0 }
    updater        = require(helpers.lib_path('agent', 'updater'));

function startCheckUpdateWinsvc(number) {
  setInterval(function () {
    sending.count += number;
    updater.check_for_update_winsvc(() => {
    })
  }, 100);
}

describe('when os != windows', () => {
  before(() => {
    sys_index.osName = "mac"
    platform_stub = sinon.stub(os, 'platform').callsFake(() => { return 'mac'; });
  })

  after(() => {
    platform_stub.restore();
  })
  
  it('returns an error', (done) => {
    updater.check_for_update_winsvc((err) => {
      should.exist(err);
      err.message.should.containEql('Action only allowed on Windows');
      done();
    });
  })
})

describe('update winsvcs interval', function () {
  before(() => {
    sys_index.osName = "windows"
    platform_stub_3 = sinon.stub(os, 'platform').callsFake(() => { return 'win32'; });
  })

  describe('updater winsvc', function () {

    beforeEach(function () {
      sys_index.osName = "windows"
      this.clock = sinon.useFakeTimers();
    });

    afterEach(function () {
      this.clock = sinon.restore();
    });

    it('should be sent once', function () {
      startCheckUpdateWinsvc(1);
      //advance the clock
      this.clock.tick(100);
      this.clock.tick(100);
      assert.equal(sending.count, 2);
    });
  })

})

describe('when os is windows', () => {
  before(() => {
    sys_index.osName = "windows"
    sys_index.check_service = sys_win.check_service;
    sys_index.run_as_admin = sys_win.run_as_admin;
    platform_stub = sinon.stub(os, 'platform').callsFake(() => { return 'win32'; });
  })

  after(() => {
    platform_stub.restore();
  })

  describe('when get_winsvc_version return error', () => {

    var get_winsvc_version_stub;
    before(() => {
      get_winsvc_version_stub = sinon.stub(sys_win, 'get_winsvc_version').callsFake((cb) => {
        cb(new Error('No winsvc version found.'));
      });
    })

    after(() => {
      get_winsvc_version_stub.restore();
    })

    it('should return error to get os edition', (done) => {
      updater.check_for_update_winsvc((err) => {
        should.exist(err);
        err.message.should.containEql('Error to get winsvc version');
        done();
      });
    })
  })

  describe('when get_stable_version_winsvc return error', () => {

    var get_winsvc_version_2_1_0_stub;
    var get_stable_version_winsvc_error;
    before(() => {
      get_winsvc_version_2_1_0_stub = sinon.stub(sys_win, 'get_winsvc_version').callsFake((cb) => {
        cb(null, "2.0.1");
      });
      get_stable_version_winsvc_error = sinon.stub(updater, 'get_stable_version_winsvc').callsFake((cb) => {
        cb(new Error('Error get_stable_version_winsvc.'));
      });
    })

    after(() => {
      get_winsvc_version_2_1_0_stub.restore();
      get_stable_version_winsvc_error.restore();
    })

    it('should return 2.0.1', (done) => {
      updater.check_for_update_winsvc((err) => {
        should.exist(err);
        err.message.should.containEql('Error to get stable version');
        done();
      });
    })
  })

  describe('when get_stable_version_winsvc return ok and is updated', () => {

    var get_winsvc_version_2_0_2_stub;
    var get_stable_version_winsvc_ok;
    before(() => {
      get_winsvc_version_2_0_2_stub = sinon.stub(sys_win, 'get_winsvc_version').callsFake((cb) => {
        cb(null, "2.0.2");
      });
      get_stable_version_winsvc_ok = sinon.stub(updater, 'get_stable_version_winsvc').callsFake((cb) => {
        cb(null, "2.0.2");
      });

    })

    after(() => {
      get_winsvc_version_2_0_2_stub.restore();
      get_stable_version_winsvc_ok.restore();
    })

    it('should return 2.0.0', (done) => {
      updater.check_for_update_winsvc((err) => {
        should.not.exist(err);
        done();
      });
    })
  })

  describe('when get_stable_version_winsvc return ok and not updated and winsvc return error', () => {

    var get_winsvc_version_2_0_3_stub;
    var get_stable_version_winsvc_ok;
    var update_winsvc_error;
    before(() => {
      get_winsvc_version_2_0_3_stub = sinon.stub(sys_win, 'get_winsvc_version').callsFake((cb) => {
        cb(null, "2.0.3");
      });
      get_stable_version_winsvc_ok = sinon.stub(updater, 'get_stable_version_winsvc').callsFake((cb) => {
        cb(null, "2.0.4");
      });
      update_winsvc_error = sinon.stub(updater, 'update_winsvc').callsFake((path, cb) => {
        cb(new Error('Error to update winsvc.'));
      });
    })

    after(() => {
      get_winsvc_version_2_0_3_stub.restore();
      get_stable_version_winsvc_ok.restore();
      update_winsvc_error.restore();
    })

    it('should return 2.0.4', (done) => {
      updater.check_for_update_winsvc((err) => {
        should.exist(err);
        err.message.should.containEql('error to update winsvc');
        done();
      });
    })
  })

  describe('when get_stable_version_winsvc return ok and not updated and winsvc update ok', () => {

    var get_winsvc_version_2_0_4_stub;
    var get_stable_version_winsvc_ok;
    var update_winsvc_error;
    before(() => {
      get_winsvc_version_2_0_4_stub = sinon.stub(sys_win, 'get_winsvc_version').callsFake((cb) => {
        cb(null, "2.0.4");
      });
      get_stable_version_winsvc_ok = sinon.stub(updater, 'get_stable_version_winsvc').callsFake((cb) => {
        cb(null, "2.0.5");
      });
      update_winsvc_error = sinon.stub(updater, 'update_winsvc').callsFake((path, cb) => {
        cb(null, true);
      });
    })

    after(() => {
      get_winsvc_version_2_0_4_stub.restore();
      get_stable_version_winsvc_ok.restore();
      update_winsvc_error.restore();
    })

    it('should return 2.0.4', (done) => {
      updater.check_for_update_winsvc((err, isUpdated) => {
        should.not.exist(err);
        should.exist(isUpdated);
        console.log(isUpdated)
        done();
      });
    })
  })
})


