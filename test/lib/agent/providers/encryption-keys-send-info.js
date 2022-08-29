var helpers        = require('./../../../helpers'),
    should         = require('should'),
    sinon          = require('sinon'),
    assert         = require('assert'),
    join           = require('path').join,
    sys_index_path = helpers.lib_path('system'),
    sys_index      = require(sys_index_path),
    sys_win        = require(join(sys_index_path, 'windows')),
    os             = require('os'),
    control_panel  = require(helpers.lib_path('agent', 'plugins', 'control-panel', 'index')),
    system = require(join(helpers.lib_path(), 'common')).system;



    var sending = { count: 0 }
    

  function startSendInfo(number){
       setInterval(function() {
          sending.count += number;
          control_panel.send_info_encrypt(() => {
          })
    }, 100);
  }


  describe('when os != windows', () => {
    it('returns an error', (done) => {
      control_panel.send_info_encrypt((err) => {
        should.exist(err);
        err.message.should.containEql('Action only allowed on Windows');
        done();
      });
    })
  })

  describe('when os is windows', () => {
    before(() => {
      sys_index.os_name = "windows"
      sys_index.check_service = sys_win.check_service;
      sys_index.run_as_admin = sys_win.run_as_admin;
      platform_stub = sinon.stub(os, 'platform').callsFake(() => { return 'win32'; });
    })

    after(() => {
      platform_stub.restore();
    })

    describe('when get_os_edition return error', () => {

      var get_os_edition_stub;
      before(() => {
        get_os_edition_stub = sinon.stub(sys_win, 'get_os_edition').callsFake((cb) => {
          cb(new Error('No edition found.'));
        });
      })
  
      after(() => {
        //get_os_edition_stub.restore();
      })

      it('should return error to get os edition', (done) => {
        control_panel.send_info_encrypt((err) => {
          err.message.should.containEql('Error to get os_edition information');
          done();
        });
      })

      
    })

    describe('when is not compatible_with_module_tpm', () => {

      var data = { os_edition  : "Basic", winsvc_version : "2.0.1" , os_name : "windows"}

      it('should return false when not is compatible', (done) => {
        let response = sys_win.compatible_with_module_tpm(data);
        response.should.be.equal(false)
        done();
      })

    })

    describe('when is compatible_with_module_tpm', () => {

      var data = { os_edition  : "Pro", winsvc_version : "2.0.1" , os_name : "windows"}

      var os_version_stub,
      os_version = "10.5.0";

      before(() => {
        os_version_stub = sinon.stub(os, 'release').callsFake(() => { return os_version; });

      })
  
      after(() => {
        os_version_stub.restore();
      })


      it('should return true when is compatible', (done) => {
        console.log(helpers.lib_path('agent','common'));
        let response = sys_win.compatible_with_module_tpm(data);
        response.should.be.equal(true)
        done();
      })

    })
  })


describe('Send info interval', function() {

  before(() => {
    sys_index.os_name = "windows"
    platform_stub_3 = sinon.stub(os, 'platform').callsFake(() => { return 'win32'; });
  })


describe('encrypt info', function() {

  beforeEach(function() {
    sys_index.os_name = "windows"
    this.clock = sinon.useFakeTimers();
  });

  afterEach(function() {
    this.clock = sinon.restore();
  });

  it('should be sent once', function(){
    startSendInfo(1);
    //advance the clock
    this.clock.tick(100);
    this.clock.tick(100);
    assert.equal(sending.count, 2);
  });
})

})


