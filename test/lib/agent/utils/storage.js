 var fs = require('fs'),
   join = require('path').join,
   should = require('should'),
   tmpdir = require('os').tmpdir,
   helpers = require('../../../helpers'),
   rmdir = require('rimraf'),
   storage = require(helpers.lib_path('agent', 'utils', 'storage')); 
   const { v4: uuidv4 } = require('uuid'); 
   var singular = function (type) {
   return type.substring(0, type.length - 1);
 }; 
 var add_to_db = (db, type, base64, cb) => {
   db.run(
     `CREATE TABLE IF NOT EXISTS ${type} (${singular(type)} text)`,
     () => {
       db.run(
         `INSERT INTO ${type} (${singular(type)}) VALUES ('${base64}')`,
         (err) => {
           return cb && cb(err);
         }
       );
     }
   );
 }; 
 describe('storage', () => {
   describe('storage file initialization', () => {
     let dir_path = join(tmpdir(), 'test'),
       path = join(dir_path, 'commands.db');     
       before((done) => {
       fs.mkdir(dir_path, done);
     });     after((done) => {
       storage.erase(path, () => {
         rmdir(dir_path, done);
       });
     });     
     it('returns an error when the directory is unaccesible', (done) => {
       fs.chmod(dir_path, '0000', () => {
         storage.init(null, path, (err, db) => {
           should.exist(err);
           err.message.should.be.containEql(
             'Access denied to commands database'
           );
           fs.chmod(dir_path, '755', done);
         });
       });
     });     it('initializes storage file but not create any table', (done) => {
       let exists = fs.existsSync(path);
       exists.should.be.equal(false);       storage.init(null, path, (err, db) => {
         should.not.exist(err);
         exists = fs.existsSync(path);
         exists.should.be.equal(true);
         should.exist(db);
         Object.prototype.toString.call(db).includes('Database');         
         db.all(`SELECT name FROM sqlite_master`, (err, tables) => {
           should.not.exist(err);
           tables.should.be.a.Array;
           tables.length.should.be.equal(0);
           done();
         });
       });
     });     
     it('returns an error when the type is not valid', (done) => {
       storage.init('invalid', path, (err, db) => {
         should.exist(err);
         err.message.should.be.containEql('Not an allowed type of key');
         done();
       });
     });     
     it('creates the table when the type is introduced', (done) => {
       storage.init('commands', path, (err, db) => {
         should.not.exist(err);
         exists = fs.existsSync(path);
         exists.should.be.equal(true);
         should.exist(db);
         Object.prototype.toString.call(db).includes('Database');         db.all(`SELECT name FROM sqlite_master`, (err, tables) => {
           should.not.exist(err);
           tables.should.be.a.Array;
           tables.length.should.be.equal(2);
           let type = typeof tables[0];
           type.should.be.equal('object');
           tables[0].name.should.be.equal('commands');           // autoindex for primary key
           type = typeof tables[1];
           type.should.be.equal('object');
           tables[1].name.should.be.equal('sqlite_autoindex_commands_1');           done();
         });
       });
     });
   });   
   describe('data management into db', () => {
     describe('on commands', () => {
       var id, data;       
       before((done) => {
         id = uuidv4();
         data = {
           command: 'start',
           target: 'alert',
           options: { message: 'hey!' },
         };
         storage.init('commands', tmpdir() + '/commands1.db', done);
       });       
       after((done) => {
         storage.erase(tmpdir() + '/commands1.db', done);
       });       
       it('store the command', (done) => {
         storage.do('set', { type: 'commands', id: id, data: data }, (err) => {
           should.not.exist(err);
           storage.do('all', { type: 'commands' }, (err, out) => {
             should.not.exist(err);
             out.length.should.be.equal(1);
             out[0].id.should.be.equal(id);
             out[0].started.should.be.equal('NULL');
             done();
           });
         });
       });       
       /*it('can read the data by id', (done) => {
         storage.do(
           'query',
           { type: 'commands', column: 'id', data: id },
           (err, data) => {
             should.not.exist(err);
             data.length.should.be.equal(1);
             data[0].id.should.be.equal(id);
             done();
           }
         );
       });       
       it('cant insert data with same id', (done) => {
         storage.do('set', { type: 'commands', id: id, data: data }, (err) => {
           should.exist(err);
           err.message.should.be.containEql('Already registered');
           done();
         });
       });       
       it('modify started status when update', (done) => {
         storage.do(
           'update',
           { type: 'commands', id: id, columns: 'started', values: 1 },
           (err) => {
             should.not.exist(err);
             storage.do(
               'query',
               { type: 'commands', column: 'id', data: id },
               (err, data) => {
                 should.not.exist(err);
                 data.length.should.be.equal(1);
                 data[0].id.should.be.equal(id);
                 data[0].started.should.be.equal(1);
                 done();
               }
             );
           }
         );
       });       
       it('delete the command by id', (done) => {
         let id2 = uuidv4(),
           data2 = {
             command: 'start',
             target: 'alarm',
             options: { sound: 'modem' },
           };         // first inserts another command
         storage.do('set', { type: 'commands', id: id2, data: data2 }, (err) => {
           storage.do('all', { type: 'commands' }, (err, data) => {
             data.length.should.be.equal(2);             // now we delete the first one
             storage.do('del', { type: 'commands', id: id }, (err) => {
               should.not.exist(err);
               storage.do('all', { type: 'commands' }, (err, data) => {
                 data.length.should.be.equal(1);
                 data[0].id.should.be.equal(id2);
                 done();
               });
             });
           });
         });
       });       
       it('clears the commands table', (done) => {
         storage.do('clear', { type: 'commands' }, (err) => {
           should.not.exist(err);           storage.do('all', { type: 'commands' }, (err, data) => {
             should.not.exist(err);
             data.length.should.be.equal(0);
             done();
           });
         });
       });*/
     });
   }); 
   /*describe('store geofencing', () => {
     before(function (done) {
       storage.init('geofences', tmpdir() + '/bar.db', done);
     });     it('store the zone', (done) => {
       var id = 1234,
         data = { name: 'Home', state: 'inside' };       storage.do('set', { type: 'geofences', id: id, data: data }, () => {
         done();
       });
     });     it('modify zone state when update', (done) => {
       storage.do(
         'update',
         { type: 'geofences', id: 1234, columns: 'state', values: 'state' },
         (err) => {
           storage.do(
             'query',
             { type: 'geofences', column: 'id', data: 1234 },
             (err, data) => {
               storage.do('all', { type: 'geofences' }, (err, zonas) => {
                 done();
               });
             }
           );
         }
       );
     });
   });   */
   describe('store files', () => {});   
   /*describe('verify', () => {
     describe('validate if exist id', () => {
       var id, data;       
       before((done) => {
         id = uuidv4();
         // encryption.status[tmpdir() + '/commands.db'] = null;
         storage.init('commands', tmpdir() + '/commands_new.db', done);
       });       after((done) => {
         storage.erase(tmpdir() + '/commands_new.db', done);
         // done();
       });       it('return empty', (done) => {
         storage.do(
           'query',
           { type: 'commands', column: 'id', data: id },
           (err, data) => {
             should.not.exist(err);
             data.length.should.be.equal(0);
             done();
           }
         );
       });
     });
   });*/
   /*  before(function (done) {
       storage.init('triggers', tmpdir() + '/bar.db', done);
     });
     it('store the trigger', (done) => {
       var id = 2000,
         data = {
           name: 'da trigger',
           synced_at: 'NULL',
           last_exec: 'NULL',
           automation_events: [
             { type: 'exact_time', info: { date: '20200618154100' } },
           ],
           automation_actions: [
             {
               action: {
                 command: 'start',
                 target: 'alert',
                 options: {
                   alert_message:
                     'This device has been currently marked as lost.',
                 },
               },
               delay: 0,
             },
           ],
         };       storage.do('set', { type: 'triggers', id: id, data: data }, () => {
         // storage.set('triggers', id, data, () => {
         done();
       });
     });*/
   });  
    /*describe('store keys', () => {
     before(function (done) {
       storage.init('geofences', tmpdir() + '/bar.db', done);
     });
     it('store the key', (done) => {
       value = 'hola';       // storage.do('set', { type: 'keys', data: {key: 'chau', value: "hola"}}, () => {
       // // storage.set('triggers', id, data, () => {
       //   done();
       // })
       var public_key = 'im the public key!';
       var private_key = 'im the private key!';       storage.do(
         'set',
         { type: 'keys', data: { key: 'public_key', value: public_key } },
         function (err) {
           done();
         }
       );
     });
   });   */
   /*describe('recover data from old db', () => {
     var path, db;
     before((done) => {
       // creating and old storage db and adding it some dummy data.
       path = join(tmpdir(), 'old_commands.db');
       storage.first_init = false;       storage.init(null, path, (err, old_db) => {
         db = old_db;
         add_to_db(
           old_db,
           'commands',
           'eyJzdGFydC1hbGVydCI6eyJjb21tYW5kIjoic3RhcnQiLCJ0YXJnZXQiOiJhbGVydCIsIm9wdGlvbnMiOnsiYWxlcnRfbWVzc2FnZSI6IlRoaXMgZGV2aWNlIGhhcyBiZWVuIGN1cnJlbnRseSBtYXJrZWQgYXMgbG9zdCBieSB0aGUgYWRtaW4uIFBsZWFzZSBjb250YWN0IGphdm9AcHJleWhxLmNvbSB0byBhcnJhbmdlIGl0cyBzYWZlIHJldHVybiBhbmQgYXZvaWQgZnVydGhlciBtZWFzdXJlcy4iLCJtZXNzYWdlSUQiOiIwYTZlZGE4Zi05OGY4LTRkOTItODcyOC1mZDdjMDQ1N2I3YjUifX19',
           () => {
             add_to_db(
               old_db,
               'commands',
               'eyJzdGFydC1hbGFybSI6eyJjb21tYW5kIjoic3RhcnQiLCJ0YXJnZXQiOiJhbGFybSIsIm9wdGlvbnMiOnsibWVzc2FnZUlEIjoiZDdkYWE3ZDQtYWEwNy00MzYyLWI1NTEtNmNjMjFiN2IzMjcwIiwic291bmQiOiJhbGFybSJ9fX0=',
               () => {
                 add_to_db(
                   old_db,
                   'commands',
                   'eyJzdGFydC1sb2NrIjp7ImNvbW1hbmQiOiJzdGFydCIsInRhcmdldCI6ImxvY2siLCJvcHRpb25zIjp7ImNsb3NlX2FwcHMiOmZhbHNlLCJ1bmxvY2tfcGFzcyI6InByZXlyb2NrcyJ9fX0=',
                   () => {
                     add_to_db(
                       old_db,
                       'geofences',
                       'eyJnZW9mZW5jZS0xMTEiOnsiaWQiOjExMSwibmFtZSI6IkhvbWUiLCJzdGF0ZSI6Imluc2lkZSJ9fQ=',
                       () => {
                         add_to_db(
                           old_db,
                           'geofences',
                           'eyJnZW9mZW5jZS0xMTIiOnsiaWQiOjExMiwibmFtZSI6IldvcmsiLCJzdGF0ZSI6Im91dHNpZGUifX0=',
                           () => {
                             add_to_db(
                               old_db,
                               'geofences',
                               'eyJnZW9mZW5jZS0xMTMiOnsiaWQiOjExMywibmFtZSI6IlUiLCJzdGF0ZSI6Im91dHNpZGUifX0=',
                               () => {
                                 add_to_db(
                                   old_db,
                                   'triggers',
                                   'eyJ0cmlnZ2VyLTY4MTUiOnsiaWQiOjY4MTUsIm5hbWUiOiJsb2FuX2F1dG9tYXRpb24iLCJwZXJzaXN0Ijp0cnVlLCJzeW5jZWRfYXQiOjE2Mzc1NzY3NTY0MTAsImxhc3RfZXhlYyI6bnVsbCwiYXV0b21hdGlvbl9ldmVudHMiOlt7InR5cGUiOiJleGFjdF90aW1lIiwiaW5mbyI6eyJkYXRlIjoiMjAyMTExMzAwNzI0MDAifX1dLCJhdXRvbWF0aW9uX2FjdGlvbnMiOlt7ImFjdGlvbiI6eyJjb21tYW5kIjoic3RhcnQiLCJ0YXJnZXQiOiJsb2NrIiwib3B0aW9ucyI6eyJ1bmxvY2tfcGFzcyI6InByZXlyb2NrcyIsImxvY2tfbWVzc2FnZSI6ImxvY2shIiwiY2xvc2VfYXBwcyI6ZmFsc2V9fSwiZGVsYXkiOjB9XX19',
                                   () => {
                                     add_to_db(
                                       old_db,
                                       'triggers',
                                       'eyJ0cmlnZ2VyLTY4MTQiOnsiaWQiOjY4MTQsIm5hbWUiOiJsb2FuX2F1dG9tYXRpb24iLCJzeW5jZWRfYXQiOjE2Mzc1NzY3NTY0MTAsImxhc3RfZXhlYyI6bnVsbCwiYXV0b21hdGlvbl9ldmVudHMiOlt7InR5cGUiOiJleGFjdF90aW1lIiwiaW5mbyI6eyJkYXRlIjoiMjAyMTExMzAwNzA5MDAifX1dLCJhdXRvbWF0aW9uX2FjdGlvbnMiOlt7ImFjdGlvbiI6eyJjb21tYW5kIjoic3RhcnQiLCJ0YXJnZXQiOiJhbGVydCIsIm9wdGlvbnMiOnsiYWxlcnRfbWVzc2FnZSI6IllvdXIgZXF1aXBtZW50IGxvYW4gd2lsbCBleHBpcmUgaW4gMTUgbWludXRlcywgcGxlYXNlIHNhdmUgeW91ciB3b3JrIGFuZCByZXR1cm4gaXQgdGltZWx5LiJ9fSwiZGVsYXkiOjB9XX19',
                                       () => {
                                         add_to_db(
                                           old_db,
                                           'keys',
                                           'eyJob3N0bmFtZS1rZXkiOnsidmFsdWUiOiJQcmV5In19',
                                           () => {
                                             add_to_db(
                                               old_db,
                                               'versions',
                                               'eyJ2ZXJzaW9uLTEuOS4xNCI6eyJmcm9tIjoiMS45LjEzIiwidG8iOiIxLjkuMTQiLCJhdHRlbXB0cyI6MSwibm90aWZpZWQiOmZhbHNlfX0',
                                               () => {
                                                 add_to_db(
                                                   old_db,
                                                   'versions',
                                                   'eyJ2ZXJzaW9uLTEuOS4xMyI6eyJmcm9tIjoiMS45LjEyIiwidG8iOiIxLjkuMTMiLCJhdHRlbXB0cyI6NSwibm90aWZpZWQiOnRydWV9fQ',
                                                   () => {
                                                     add_to_db(
                                                       old_db,
                                                       'files',
                                                       'eyJmaWxlLTExQjYyRTgyRTBDODI3Mzg0MEJFMUE4MTI2OTEwQTU4Ijp7InBhdGgiOiIvVXNlcnMvdXNlci9maWxlLmRvdCIsInNpemUiOjQyLCJ1c2VyIjoidXNlciIsIm5hbWUiOiJmaWxlLmRvdCIsInJlc3VtYWJsZSI6ZmFsc2V9fQ===',
                                                       done
                                                     );
                                                   }
                                                 );
                                               }
                                             );
                                           }
                                         );
                                       }
                                     );
                                   }
                                 );
                               }
                             );
                           }
                         );
                       }
                     );
                   }
                 );
               }
             );
           }
         );
       });
     });     after((done) => {
       storage.erase(tmpdir() + '/old_commands.db', done);
     });     it('recovers the data and saves it in the new format', (done) => {
       storage.recover_db(db, (err) => {
         should.not.exist(err);
         storage.do('all', { type: 'commands' }, (err, data) => {
           should.not.exist(err);           data[0].id.should.be.equal('0a6eda8f-98f8-4d92-8728-fd7c0457b7b5');
           data[0].target.should.be.equal('alert');
           data[1].id.should.be.equal('d7daa7d4-aa07-4362-b551-6cc21b7b3270');
           data[1].target.should.be.equal('alarm');
           should.exist(data[2].id);
           data[2].target.should.be.equal('lock');           storage.do('all', { type: 'geofences' }, (err, data) => {
             data[0].id.should.be.equal('111');
             data[0].name.should.be.equal('Home');
             data[1].id.should.be.equal('112');
             data[1].name.should.be.equal('Work');
             data[2].id.should.be.equal('113');
             data[2].name.should.be.equal('U');             storage.do('all', { type: 'triggers' }, (err, data) => {
               data[0].id.should.be.equal('6815');
               data[0].persist.should.be.equal(1);
               data[1].id.should.be.equal('6814');
               data[1].persist.should.be.equal(0);               storage.do('all', { type: 'versions' }, (err, data) => {
                 data[0].id.should.be.equal('1.9.14');
                 data[0].attempts.should.be.equal(1);
                 data[1].id.should.be.equal('1.9.13');
                 data[1].attempts.should.be.equal(5);                 storage.do('all', { type: 'files' }, (err, data) => {
                   data[0].id.should.be.equal(
                     '11B62E82E0C8273840BE1A8126910A58'
                   );
                   data[0].name.should.be.equal('file.dot');
                   done();
                 });
               });
             });
           });
         });
       });
     });     it('does nothing when the db has the new format', (done) => {
       storage.init('keys', tmpdir() + '/old_commands.db', () => {
         storage.recover_db(db, (err) => {
           should.not.exist(err);
           done();
         });
       });
     });
   });*/