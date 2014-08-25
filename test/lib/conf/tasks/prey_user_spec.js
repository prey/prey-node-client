var fs      = require('fs'),
    path    = require('path'),
    async   = require('async'),
    sinon   = require('sinon'),
    should  = require('should'),
    extend  = require('node.extend'),
    sandbox = require('sandboxed-module'),
    helpers = require('./../../../helpers');

var module_path = helpers.lib_path('conf', 'tasks', 'prey_user'),
    prey_user   = require(module_path);

describe('prey_user', function() {

  var run = function(cb) {
    prey_user.create(cb);
  }

  var run_sandboxed = function(opts, cb) {
    var base = {
      requires: { },
      globals:  { }
    }

    var opts = extend(true, base, opts);
    var module = sandbox.require(module_path, opts);
    module.create(cb);
  }

  describe('when called on windows', function() {

    it('returns error', function(done) {
      var opts = { globals: { process: { platform: 'win32' } } };

      run_sandboxed(opts, function(err) {
        err.should.exist;
        err.message.should.containEql('This script is for Mac/Linux only');
        done();
      })
    })

  })

  describe('if user creation script fails', function() {

  })

  describe('if user creation script succeeds', function() {

    describe('and setup permissions fails', function() {

      it('returns an error', function() {

      })

      it('does not run "config activate" as prey user', function() {

      })

    })

    describe('and setup permissions succeeds', function() {

      describe('and "config activate" as prey user fails', function() {

        it('returns an error', function() {

        })

      })

      describe('and "config activate" as prey user succeeds', function() {

        it('works', function() {

        })

      })

    })

  })

})
