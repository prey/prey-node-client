var path      = require('path'),
    join      = path.join,
    helpers   = require('./../../helpers'),
    should    = require('should'),
    sinon     = require('sinon'),
    commands  = helpers.load('commands'),
    reports   = helpers.load('reports'),
    root_path = path.resolve(__dirname, '..', '..', '..'),
    lib_path  = path.join(root_path, 'lib'),
    api_path  = join(lib_path, 'agent', 'plugins', 'control-panel', 'api'),
    storage   = helpers.load('utils/storage'),
    keys      = require(join(api_path, 'keys')),
    devices   = require(join(api_path, 'devices')),
    request   = require(join(api_path, 'request')),
    hooks     = helpers.load('hooks');

describe('perform', function() {

  describe('when receiving a get report command', function() {

    var command = {command: 'get', target: 'report', options: {interval: 5, exclude: ['picture']}},
        report_stub;

    beforeEach(function() {
      // stub reports.get so it doesn't gather a report when triggering the command
      report_stub = sinon.stub(reports, 'get').callsFake((report_name, options, callback) => {
        return true;
      });
    });

    afterEach(function() {
      report_stub.restore();
    });

    it('triggers the command hook with the right params', function(done) {

      function command_assertion(method, target, options) {
        method.should.equal(reports.get);
        target.should.equal('stolen');
        options.should.equal(command.options);
        hooks.remove('command', command_assertion);
        done();
      }

      hooks.on('command', command_assertion);

      commands.perform(command);

    });

    /*it('persist the command', function(done) {

      var stub = sinon.stub(commands, 'store').callsFake((key, data, cb) => {
        key.should.equal("report-stolen");
        data.should.eql(command);
        stub.restore();
        done();
      });

      commands.start_watching();
      commands.perform(command);

    });*/

  });

  describe('when receiving a start missing/recovered command', () => {
    var missing_command = { command: "start", target: "missing", options: {interval: 2}},
        recover_command = { command: "start", target: "recover", options: {}};

    before(() => {
      keys_get_stub = sinon.stub(keys, 'get').callsFake(() => {
        return { api: 'aaaaaaaaaa', device: 'bbbbbb' }
      });
      missing_spy = sinon.spy(devices, 'post_missing');
      stub_request = sinon.stub(request, 'post').callsFake((path, data, opts, cb) => { return; });
      report_stub = sinon.stub(reports, 'get').callsFake((report_name, options, callback) => {
        return true;
      });
    })

    after(() => {
      keys_get_stub.restore();
      missing_spy.restore();
      stub_request.restore();
      report_stub.restore();
    })

    it('requests to set the device as missing and its set as stolen', (done) => {

      function command_assertion(method, target, options) {
        method.should.equal(reports.get);
        target.should.equal('stolen');
        options.should.equal(missing_command.options);
        hooks.remove('command', command_assertion);
        missing_spy.calledOnce.should.equal(true);
        done();
      }

      hooks.on('command', command_assertion);
      commands.perform(missing_command);

    })

    it('requests to set the device as recovered and its set as recovered', (done) => {

      function command_assertion(method, target, options) {
        method.should.equal(reports.cancel);
        target.should.equal('stolen');
        options.should.equal(recover_command.options);
        hooks.remove('command', command_assertion);
        missing_spy.calledTwice.should.equal(true);
        done();
      }

      hooks.on('command', command_assertion);
      commands.perform(recover_command);

    })

  });

});
