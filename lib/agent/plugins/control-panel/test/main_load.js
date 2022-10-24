// var fs = require('fs'),
//     join = require('path').join,
//     should = require('should'),
//     sinon = require('sinon'),
//     needle = require('needle'),
//     getset = require('getset');

// var common = require('../../../common'),
//     hooks = require('../../../hooks'),
//     main = require('../'),
//     setup = require('../setup'),
//     api = require('../api'),
//     request = require('../api/request'),
//     long_polling = require('../long-polling');

// var default_host = 'somewhere.com',
//     default_protocol = 'https';

// describe('main.load', function() {

//   // we roll our own fake config so we can control all its values
//   var config = getset.load('/tmp/foo');

//   // insert default values to config
//   config.set('host', 'destination.com');
//   config.set('protocol', 'https');
//   config.global = { get: function() {} }

//   var background = false;

//   // object that is passed to plugin
//   var common_obj = {
//     hooks    : hooks,
//     logger   : common.logger,
//     config   : config,
//     system   : common.system,
//     commands : {
//       perform: function(cmd) { /* noop */ },
//     },
//     helpers  : { running_on_background: function() { return background } }
//   }

//   var call = function(cb) {
//     main.load.call(common_obj, cb)
//   }

//   // ok, since we're not testing the setup() function here, we'll stub
//   // it for all tests to prevent the execution to go any further.
//   // the tests at the bottom (that do check the setup()'s function result)
//   // will need to reset these stubs before they start.

//   // we also stub the long_polling.load, push.load and api.devices.get.status
//   // calls that are made on successful setup().

//   var setup_stub;

//   var stub_setup = function() {
//     setup_stub = sinon.stub(setup, 'start').callsFake((obk, cb) => {
//       cb(new Error('Setup worked, but were stopping here.'));
//     })
//   }

//   before(function() {
//     stub_setup();
//   })

//   after(function() {
//     setup_stub.restore();
//   })

//   describe('with no config object', function() {

//     before(function() {
//       common_obj.config = null;
//     })

//     after(function() {
//       // reset the config obj
//       common_obj.config = config;
//     })

//     describe('passing callback', function() {

//       it('it callbacks an error', function(done) {
//         call(function(err) {
//           err.should.be.a.Error;
//           err.message.should.eql('No config object.');
//           done();
//         })
//       })

//     })

//     describe('without callback', function() {

//       it('shouldnt throw', function(done) {

//         var err;

//         try {
//           call()
//         } catch(e) {
//           err = e;
//         }

//         setTimeout(function() {
//           should.not.exist(err);
//           done();
//         }, 10);

//       })

//     })

//   })

//   describe('with invalid protocol', function() {

//     before(function() {
//       // Make sure we're using https protocol when running the whole test suite
//       request.use({protocol: 'https'});
//       config.set('protocol', 'foo');
//     })

//     after(function() {
//       config.set('protocol', default_protocol);
//     })

//     describe('passing callback', function() {

//       it('does not trigger an error (regarding the protocol)', function(done) {
//         call(function(err) {

//           // here this error is from the semaphore we put on the setup.start() stub.
//           // so it's ok that we got it. we just want to check whether the invalid
//           // protocol, which should have been checked before, was the cause of the error, or not.
//           err.should.be.a.Error;
//           err.message.should.eql('Setup worked, but were stopping here.');
//           done();
//         })
//       })

//       it('does not set the invalid protocol', function(done) {

//         var keys_stub = sinon.stub(api.keys, 'get').callsFake(() => {
//           return { api: 'foobar', device: '123123' };
//         })

//         var needle_stub = sinon.stub(needle, 'request').callsFake((method, url, opts, data, cb) => {
//           cb(new Error('Something.'), url);
//         })

//         call(function() {

//           api.devices.get.status(function(err, url) {
//             url.should.match(/^https:/);
//             needle_stub.restore();
//             keys_stub.restore();
//             done();
//           })

//         })

//       })

//     })

//     describe('without callback', function() {

//       it('shouldnt throw', function(done) {

//         var err;

//         try {
//           call();
//         } catch(e) {
//           err = e;
//         }

//         setTimeout(function() {
//           should.not.exist(err);
//           done();
//         }, 10);

//       })

//     })

//   })

//   describe('with empty host key', function() {

//     before(function() {
//       config.set('host', '')
//     })

//     after(function() {
//       config.set('host', default_host);
//     })

//     describe('passing callback', function() {

//       it('does not set the empty host', function(done) {

//         var keys_stub = sinon.stub(api.keys, 'get').callsFake(() => {
//           return { api: 'foobar', device: '123123' };
//         })

//         var needle_stub = sinon.stub(needle, 'request').callsFake((method, url, opts, data, cb) => {
//           cb(new Error('Something.'), url);
//         })

//         call(function() {

//           api.devices.get.status(function(err, url) {
//             url.should.not.containEql('///'); // if the host was empty, we'd get a URL containing three slashes
//             needle_stub.restore();
//             keys_stub.restore();
//             done();
//           });

//         });

//       });

//     });

//     describe('without callback', function() {

//       it('shouldnt throw', function(done) {

//         var err;

//         try {
//           call()
//         } catch(e) {
//           err = e;
//         }

//         setTimeout(function() {
//           should.not.exist(err);
//           done();
//         }, 10);

//       });

//     });

//   })

//   describe('with valid host and protocol', function() {

//     before(function() {
//       config.set('host', default_host);
//       config.set('protocol', default_protocol);

//       background = false; // so we get a callback
//     });

//     it('calls setup()', function(done) {
//       call(function(err) {
//         should.exist(err);
//         err.message.should.eql('Setup worked, but were stopping here.');
//         done();
//       });
//     });

//     describe('if setup() failed', function() {

//       // the default setup_stub behaviour is good for this test.

//       describe('and running on background', function() {

//         var setinterval_called = false,
//             setinterval_stub;

//         before(function() {
//           background = true;
//           common.logger.pause();

//           // playing with fire here!
//           setinterval_stub = sinon.stub(global, 'setInterval').callsFake((fn, delay) => { 
//             if (delay === 10000)
//               setinterval_called = true;
//           });

//         });

//         after(function() {
//           setinterval_stub.restore(); // or heaven will fall apart
//           common.logger.resume();
//         });

//         it ('does not callback', function(done) {
//           var called_back = false;

//           call(function(err) {
//             called_back = true;
//           })

//           setTimeout(function(){
//             called_back.should.be.false;
//             done();
//           }, 20)
//         });

//         it ('waits for config', function(done) {

//           setinterval_called = false;
//           call();

//           setTimeout(function() {
//             setinterval_called.should.be.true;
//             done();
//           }, 20)
//         });

//       })

//       describe('and running on foreground', function() {

//         before(function() {
//           background = false;
//         })

//         it ('callsback an error', function(done) {
//           call(function(err) {
//             should.exist(err);
//             err.message.should.eql('Setup worked, but were stopping here.');
//             done();
//           });
//         });

//       });

//     });

//     describe('if setup() succeeded', function() {

//       var stubs = [],
//           status_stub;

//       // generic empty callback function with ultramegasuper callback position detection
//       var fn = function() {
//         var cb;

//         // find callback in arguments
//         for (var i = 0; i < arguments.length; i++) {
//           if (typeof arguments[i] == 'function')
//             cb = arguments[i];
//         }

//         cb && cb();
//       };

//       before(function() {
//         // first, reset the setup_stub defined at the start
//         setup_stub.restore();
//         stubs.push(sinon.stub(setup, 'start').callsFake(fn));
//         stubs.push(sinon.stub(long_polling, 'load').callsFake(fn));
//       });

//       after(function() {
//         stubs.forEach(function(s) { s.restore() });
//         stub_setup();
//       });

//       describe('sync', function() {

//         var response = {
//           body: {
//             status: {
//               missing: true,
//               delay: 2,
//               exclude: ['picture', 'screenshot']
//             }
//           }
//         };

//         before(function() {
//           status_stub = sinon.stub(api.devices.get, 'status').callsFake((cb) => {
//             return cb(null, response);
//           });
//         });

//         after(function() {
//           status_stub.restore();
//         });

//         describe('when missing', function() {

//           it('trigger report with exclude options', function(done) {
//             var common_dup = {
//               hooks    : hooks,
//               logger   : common.logger,
//               system   : common.system,
//               config   : config,
//               commands : {
//                 perform: sinon.spy(),
//                 run: sinon.spy(),
//               },
//               helpers  : { running_on_background: function() { return background } }
//             }

//             common_dup.commands.perform = sinon.spy();

//             var missing_opts = {
//               interval: response.body.status.delay,
//               exclude: response.body.status.exclude
//             }

//             main.load.call(common_dup, function(err) {
//               common_dup.commands.run.callCount.should.equal(1);
//               common_dup.commands.run.firstCall.args[0].should.equal('report');
//               common_dup.commands.run.firstCall.args[1].should.equal('stolen');
//               common_dup.commands.run.firstCall.args[2].should.eql(missing_opts);
//               done();
//             });
//           });
//         });

//       });

//       describe('with generic stubs', function() {

//         before(function() {
//           status_stub = sinon.stub(api.devices.get, 'status').callsFake(fn)
//         });

//         after(function() {
//           status_stub.restore();
//         });

//         it('callbacks with no errors', function(done) {

//           call(function(err) {
//             should.not.exist(err);
//             done();
//           });

//         });

//         it('boots', function(done) {

//           call(function() {

//             // all stubs should have beenc called
//             stubs.forEach(function(s) {
//               s.called.should.be.true;
//             });

//             done();
//           });

//         });

//       });

//     });

//   });

// });
