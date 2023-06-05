// /* eslint-disable linebreak-style */
// // eslint-disable-next-line no-unused-vars
// const assert = require('assert');
// const sinon = require('sinon');
// const should = require('should');
// const { tmpdir } = require('os');
// const api = require('../../api');

// const { keys } = api;
// const websocket = require('..');
// const hooks = require('../../../../hooks');
// const common = require('../../../../../common');
// const commands = require('../../../../commands');
// const actions = require('../../../../actions');
// const status = require('../../../../triggers/status');
// const testServer = require('./test_server');

// const serverPort = 13375;
// const preyConfig = {
//   host: `localhost:${serverPort}`,
//   protocol: 'http',
//   api_key: 'asdfzomgbbq',
//   device_key: 'notkey',
// };

// const commonObj = {
//   hooks,
//   config: {
//     get: (key) => {
//       if (key === 'protocol') return preyConfig.protocol;
//       return preyConfig.host;
//     },
//   },
//   logger: common.logger,
//   system: common.system,
// };

// let spy;
// let keysStub;
// let statusStub;
// let spyStatus;
// // eslint-disable-next-line no-unused-vars
// let server;

// const load = (cb) => {
//   websocket.load.call(commonObj, (err, em) => {
//     em.on('command', commands.perform);
//     cb(err, em, spy);
//   });
// };

// const unload = (cb) => {
//   websocket.unload.call(commonObj, (unloaded) => {
//     if (cb && typeof cb === 'function') return cb(unloaded);
//     return -1;
//   });
// };

// const serverUp = () => {
//   server = testServer.open(serverPort);
// };

// const serverDown = (cb) => {
//   testServer.close();
//   server = null;
//   cb();
// };

// // eslint-disable-next-line no-undef
// describe('websocket', () => {
//   // eslint-disable-next-line no-undef
//   before(() => {
//     keysStub = sinon.stub(keys, 'get').callsFake(() => ({ device: preyConfig.device_key, api: preyConfig.api_key }));
//     statusStub = sinon.stub(status, 'get_status').callsFake((cb) => cb(null, {}));
//     spyStatus = sinon.spy(websocket, 'notify_status');
//   });

//   // eslint-disable-next-line no-undef
//   after(() => {
//     keysStub.restore();
//     statusStub.restore();
//     spyStatus.restore();
//   });

//   // eslint-disable-next-line no-undef
//   // describe('on load', () => {
//   //   // eslint-disable-next-line no-undef
//   //   it('passes emitter to callback', (done) => {
//   //     load((err, em) => {
//   //       (em instanceof EventEmitter).should.equal(true);
//   //       unload(done);
//   //     });
//   //   });
//   // });

//   // eslint-disable-next-line no-undef
//   describe('on connection established', () => {
//     // eslint-disable-next-line no-undef
//     it('notifies status', (done) => {
//       serverUp();
//       load(() => {
//         setTimeout(() => {
//           spyStatus.calledOnce.should.be.equal(true);
//           setTimeout(() => {
//             unload(() => {
//               serverDown(done);
//             });
//           }, 1000);
//         }, 2000);
//       });
//     }).timeout(15000);

//     // eslint-disable-next-line no-undef
//     describe('ping pong', () => {
//       let spyHeartbeat;
//       let spySocketUp;
//       // eslint-disable-next-line no-undef
//       before(() => {
//         spyHeartbeat = sinon.spy(websocket, 'heartbeat');
//         spySocketUp = sinon.spy(websocket, 'startWebsocket');
//       });

//       // eslint-disable-next-line no-undef
//       after(() => {
//         spyHeartbeat.restore();
//         spySocketUp.restore();
//       });
//       // eslint-disable-next-line no-undef
//       it('has a heartbeat on ping', (done) => {
//         serverUp();
//         load(() => {
//           setTimeout(() => {
//             unload(() => {
//               serverDown(() => {
//                 spyHeartbeat.calledOnce.should.be.equal(true);
//                 done();
//               });
//             });
//           }, 2500);
//         });
//       }).timeout(15000);
//       // eslint-disable-next-line no-undef
//       it('restart conection when is not pinged', (done) => {
//         websocket.pingtime = 1500;
//         serverUp();
//         load(() => {
//           setTimeout(() => {
//             testServer.stop_ping();
//             setTimeout(() => {
//               testServer.start_ping();
//               setTimeout(() => {
//                 spySocketUp.calledTwice.should.be.equal(true);
//                 unload(() => {
//                   serverDown(done);
//                 });
//               }, 8000);
//             }, 2000);
//           }, 2000);
//         });
//       }).timeout(30000);
//     });
//     // eslint-disable-next-line no-undef
//     describe('when server notifies an action', () => {
//       // eslint-disable-next-line no-undef
//       let spyPerform;
//       let actionsStartStub;
//       // eslint-disable-next-line no-undef
//       before((done) => {
//         spyPerform = sinon.spy(commands, 'perform');
//         actionsStartStub = sinon.stub(actions, 'start').callsFake(() => true);
//         serverUp();
//         commands.start_watching();
//         storage2.init('commands', `${tmpdir()}/ws.db`, () => {
//           load(() => { done(); });
//         });
//       });
//       // eslint-disable-next-line no-undef
//       after((done) => {
//         spyPerform.restore();
//         actionsStartStub.restore();
//         unload(() => {
//           serverDown(() => {
//             storage2.erase(`${tmpdir()}/ws.db`, (done));
//           });
//         });
//       });
//       // eslint-disable-next-line no-undef
//       it('executes the action and store it', (done) => {
//         setTimeout(() => {
//           const action = [
//             {
//               id: '1234',
//               type: 'action',
//               time: Date.now(),
//               body: {
//                 target: 'alert',
//                 command: 'start',
//                 options: {
//                   message: 'hi!',
//                 },
//               },
//             },
//           ];
//           storage2.do(
//             'set',
//             {
//               type: 'commands',
//               id: '1234',
//               data:
//               {
//                 command: 'start',
//                 target: 'alert',
//                 options: {
//                   message: 'hi!',
//                 },
//               },
//             },
//           );
//           console.log("PUBLICAR ACCION");
//           testServer.publish_action(action);
//           setTimeout(() => {
//             storage2.do('all', { type: 'commands' }, (err, data) => {
//               should.not.exist(err);
//               data.length.should.be.equal(1);
//               data[0].id.should.be.equal('1234');
//               data[0].started_resp.should.be.equal(0);
//             });
//             // spyPerform.calledOnce.should.be.equal(true);
//             done();
//           }, 2000);
//         }, 1000);
//       }).timeout(30000);

//       // eslint-disable-next-line no-undef
//       describe('when has to send a response', () => {
//         // eslint-disable-next-line no-undef
//         describe('on action started', () => {
//           // eslint-disable-next-line no-undef
//           it('queue the response', (done) => {
//             websocket.notify_action('started', '1234', 'alert', {
//               message: 'hi!',
//             });
//             websocket.responses_queue.length.should.be.equal(1);
//             websocket.responses_queue[0].reply_id.should.be.equal('1234');
//             done();
//           });

//           // eslint-disable-next-line no-undef
//           it('unqueue the reponse after is received by the server and update the storage command', (done) => {
//             setTimeout(() => {
//               storage2.do('all', { type: 'commands' }, (err, data) => {
//                 should.not.exist(err);
//                 data.length.should.be.equal(1);
//                 data[0].id.should.be.equal('1234');
//               });
//               websocket.responses_queue.length.should.be.equal(0);
//               done();
//             }, 1000);
//           }).timeout(30000);
//         }).timeout(30000);

//         // eslint-disable-next-line no-undef
//         describe('on action stopped', () => {
//           // eslint-disable-next-line no-undef
//           it('queue the response', (done) => {
//             websocket.notify_action('stopped', '1234', 'alert', {
//               message: 'hi!',
//             });
//             websocket.responses_queue.length.should.be.equal(2);
//             websocket.responses_queue[0].reply_id.should.be.equal('1234');
//             done();
//           });

//           // eslint-disable-next-line no-undef
//           it('unqueue the response after is received by the server and update the storage command', (done) => {
//             setTimeout(() => {
//               storage2.do('all', { type: 'commands' }, (err, data) => {
//                 should.not.exist(err);
//                 data.length.should.be.equal(1);
//                 data[0].id.should.be.equal('1234');
//                 data[0].stopped_resp.should.be.equal(1);
//               });
//               websocket.responses_queue.length.should.be.equal(1);
//               done();
//             }, 10000);
//           });
//         }).timeout(30000);

//         // eslint-disable-next-line no-undef
//         describe('and the server is not responding', () => {
//           // eslint-disable-next-line no-undef
//           before((done) => {
//             websocket.pingtime = 1500;
//             websocket.re_schedule = true;
//             serverDown(done);
//           });

//           // eslint-disable-next-line no-undef
//           it('queue the response', (done) => {
//             // const data = { command: 'start', target: 'alert', options: {message: 'hey!'}};
//             storage2.do(
//               'set',
//               {
//                 type: 'commands',
//                 id: '12345',
//                 data:
//                 {
//                   command: 'start',
//                   target: 'alert',
//                   options: {
//                     message: 'bye!',
//                   },
//                 },
//               },
//             );
//             const action = [
//               {
//                 id: '12345',
//                 type: 'action',
//                 time: Date.now(),
//                 body: {
//                   target: 'alert',
//                   command: 'start',
//                   options: {
//                     message: 'bye!',
//                   },
//                 },
//               },
//             ];
//             testServer.publish_action(action);
//             (() => {
//               websocket.notify_action('started', '12345', 'alert', {
//                 message: 'bye!',
//               });
//               websocket.responses_queue.length.should.be.equal(3);
//               websocket.responses_queue.find((x) => x.reply_id === '12345').reply_id.should.be.equal('12345');
//               done();
//             })();
//           });
//         });

//         // eslint-disable-next-line no-undef
//         it('retries after the connection its achieved again', (done) => {
//           setTimeout(() => {
//             serverDown(()=> { return 1; });
//             serverUp();
//             setTimeout(() => {
//               /*storage2.query('commands', 'id', '12345', (err, data) => {
//                 should.not.exist(err);ecu
//                 data.length.should.be.equal(1);
//                 data[0].id.should.be.equal('12345');
//                 data[0].started_resp.should.be.equal(1);
//                 websocket.responses_queue.length.should.be.equal(0);
//               });*/
//               done();
//             }, 5000);
//           }, 1000);
//         }).timeout(15000);
//       });
//     });
//     // eslint-disable-next-line no-undef
    
//   });
// });
