var helpers = require('./../../helpers'),
    should = require('should'),
    sinon = require('sinon'),
    commands = helpers.load('commands'),
    reports = helpers.load('reports'),
    hooks = helpers.load('hooks');

describe('perform', function() {

  describe('when receiving a get report command', function() {

    var command = {command: 'get', target: 'report', options: {interval: 5, exclude: ['picture']}},
        report_stub;

    beforeEach(function() {
      // stub reports.get so it doesn't gather a report
      report_stub = sinon.stub(reports, 'get', function(report_name, options, callback) {
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

    it('persist the command', function() {});

  });

});
