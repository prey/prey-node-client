var fs      = require('fs'),
    join    = require('path').join,
    should  = require('should'),
    tmpdir  = require('os').tmpdir,
    helpers = require('../../../helpers'),
    rmdir    = require('rimraf'),
    storage = require(helpers.lib_path('agent', 'utils', 'commands_storage'));
    // encryption = require(helpers.lib_path('agent', 'utils', 'encryption'));

const { v4: uuidv4 } = require('uuid');
// const { storage } = require('../../../../lib/agent/utils/commands_storage');

var singular = function(type) {
  return type.substring(0, type.length - 1);
}

var add_to_db = (db, type, base64, cb) => {
  db.run(`CREATE TABLE IF NOT EXISTS ${type} (${singular(type)} text)`, (err) => {
    db.run(`INSERT INTO ${type} (${singular(type)}) VALUES ('${base64}')`, (err) => {
      return cb && cb(err);
    });
  })
}

describe('storage', () => {

  describe('storage file initialization', () => {
    let dir_path = join(tmpdir(), 'test'),
        path = join(dir_path, 'commands.db');

    before((done) => {
      fs.mkdir(dir_path, done);
    })

    after((done) => {
      storage.erase(path, () => {
        rmdir(dir_path, done);
      });
    })

    it('returns an error when the directory is unaccesible', (done) => {
      fs.chmod(dir_path, '0000', () => {
        storage.init(null, path, (err, db) => {
          should.exist(err);
          err.message.should.be.containEql('Access denied to commands database')
          fs.chmod(dir_path, '755', done)
        })
      });
    })

    it('initializes storage file but not create any table', (done) => {
      let exists = fs.existsSync(path)
      exists.should.be.equal(false);

      storage.init(null, path, (err, db) => {
        should.not.exist(err);
        exists = fs.existsSync(path);
        exists.should.be.equal(true);
        should.exist(db);
        Object.prototype.toString.call(db).includes('Database')

        db.all(`SELECT name FROM sqlite_master`, (err, tables) => {
          should.not.exist(err);
          tables.should.be.a.Array;
          tables.length.should.be.equal(0);
          done();
        });
      })
    })

    it('returns an error when the type is not valid', (done) => {
      storage.init('invalid', path, (err, db) => {
        should.exist(err);
        err.message.should.be.containEql('Not an allowed type of key')
        done();
      });
    })

    it('creates the table when the type is introduced', (done) => {
      storage.init('commands', path, (err, db) => {
        should.not.exist(err);
        exists = fs.existsSync(path);
        exists.should.be.equal(true);
        should.exist(db);
        Object.prototype.toString.call(db).includes('Database')

        db.all(`SELECT name FROM sqlite_master`, (err, tables) => {
          should.not.exist(err);
          tables.should.be.a.Array;
          tables.length.should.be.equal(2);
          let type = typeof tables[0]
          type.should.be.equal('object');
          tables[0].name.should.be.equal('commands')

          // autoindex for primary key
          type = typeof tables[1]
          type.should.be.equal('object');
          tables[1].name.should.be.equal('sqlite_autoindex_commands_1')
          
          done();
        });
      })
    })
  })

  describe('data management into db', () => {

    describe('on commands', () => {
      var id, data;

      before((done) => {
        id = uuidv4();
        // encryption.status[tmpdir() + '/commands.db'] = null;
        storage.init('commands', tmpdir() + '/commands.db', done);
      })

      after((done) => {
        storage.erase( tmpdir() + '/commands.db', done)
        // done();
      })

      it('store the command', (done) => {
        data = {command: 'start', target: 'alert', options: {message: 'hey!'}};
            
        storage.do('set', {type: 'commands', id: id, data: data}, (err) => {
          should.not.exist(err);
          storage.do('all', {type: 'commands'}, (err, out) => {
            console.log("OUT!!", out)
            should.not.exist(err);
            out.length.should.be.equal(1);
            out[0].id.should.be.equal(id);
            out[0].started.should.be.equal('NULL');
            done();
          })
        })
      })

      it('can read the data by id', (done) => {
        // storage.query('commands', 'id', id, (err, data) => {
        storage.do('query', { type: 'commands', column: 'id', data: id}, (err, data) => {
          should.not.exist(err);
          data.length.should.be.equal(1);
          data[0].id.should.be.equal(id);
          done();
        })
      })

      it('cant insert data with same id', (done) => {
        storage.do('set', { type: 'commands', id: id, data: data}, (err) => {
          console.log("ERR!!", err.message)
          should.exist(err);

          done();
        });
      })

      it('modify started status when update', (done) => {
        // storage.update('commands', id, 'started', 1, (err) => {
        storage.do('update', { type: 'commands', id: id, columns: 'started', values: 1 }, (err) => {

          should.not.exist(err);
          storage.do('query', { type: 'commands', column: 'id', data: id}, (err, data) => {
          // storage.query('commands', 'id', id, (err, data) => {
            should.not.exist(err);
            data.length.should.be.equal(1);
            data[0].id.should.be.equal(id);
            data[0].started.should.be.equal(1);
            done();
          })
        });
      })

      it('delete the command by id', (done) => {
        let id2 = uuidv4(),
            data2 = {command: 'start', target: 'alarm', options: {sound: 'modem'}};
        
        // first inserts another command
        storage.do('set', { type: 'commands', id: id2, data: data2}, (err) => {
        // storage.set('commands', id2, data2, () => {
          storage.do('all', { type: 'commands' }, (err, data) => {
            data.length.should.be.equal(2);

            // now we delete the first one
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
      })

      it('clears the commands table', (done) => {
        storage.do('clear', {type: 'commands'}, (err) => {
          should.not.exist(err);

          storage.do('all', { type: 'commands' }, (err, data) => {
            should.not.exist(err);
            data.length.should.be.equal(0);
            done();
          }); 
        })
      })

      it('drops the table', (done) => {
        done();
      })

    })

  })

  describe('store geofencing', () => {

    before(function(done) {
      storage.init('geofences', tmpdir() + '/bar.db', done);
    })

    it('store the zone', (done) => {
      var id = 1234,
          data = {name: 'Home', state: 'inside'};
      
      storage.do('set', { type: 'geofences', id: id, data: data }, () => {
        done();
      })
    })

    it('modify zone state when update', (done) => {
      storage.do('update', { type: 'geofences', id: 1234, columns: 'state', values: 'state' }, (err) => {
      // storage.update('geofences', 1234, 'state', 'state', () => {
        storage.do('query', { type: 'geofences', column: 'id', data: 1234}, (err, data) => {
        // storage.query('geofences', 'id', 1234, (err, out) => {
          storage.do('all', {type: 'geofences'}, (err, zonas) => {
          // storage.all('geofences', (err, zonas) => {
            console.log("ALL ZONAS", zonas)
            console.log("QUERY", err, zonas)
            done();
          });
        })
      });
    })
  })

  describe('store files', () => {

  })

  describe('verify', () => {

    describe('validate if exist id', () => {
      var id, data;

      before((done) => {
        id = uuidv4();
        // encryption.status[tmpdir() + '/commands.db'] = null;
        storage.init('commands', tmpdir() + '/commands_new.db', done);
      })

      after((done) => {
        storage.erase( tmpdir() + '/commands_new.db', done)
        // done();
      })


      it('return empty', (done) => {
        storage.do('query', {type: 'commands',column : "id", data: id }, (err, data) => {
          should.not.exist(err);
          data.length.should.be.equal(0);
          done();
        })
      })


      it('not return empty', (done) => {
        storage.do('query', {type: 'commands',column : "id", data: '2bf54e80-20b0-4fcf-9218-5c8e5c328a6d'}, (err, data) => {
          console.log(err)
          console.log(data)
          should.not.exist(err);
          data.length.should.be.equal(1);
          done();
        })
      })

    })

  })
//   {
//     "trigger-2005":{
//        "id":2005,
//        "name":"oeoe",
//        "synced_at":1592498417316,
//        "last_exec":null,
      //  "automation_events":[
      //     {
      //        "type":"exact_time",
      //        "info":{
      //           "date":"20200618154100"
      //        }
      //     }
      //  ],
      //  "automation_actions":[
      //     {
      //        "action":{
      //           "command":"start",
      //           "target":"alert",
      //           "options":{
      //              "alert_message":"This device has been currently marked as lost."
      //           }
      //        },
      //        "delay":0
      //     }
      //  ]
//     }
//  }

// [{"action":{"command":"start","target":"alert","options":{"alert_message":"This device has been currently marked as lost."}},"delay":0}]
// [{"type":"exact_time","info":{"date":"20200618154100"}}]

  describe('store triggers', () => {

    before(function(done) {
      storage.init('triggers', tmpdir() + '/bar.db', done);
    })
    it('store the trigger', (done) => {
      var id = 2000,
      data = {name: 'da trigger', synced_at: 'NULL', last_exec: 'NULL', automation_events: [{"type":"exact_time","info":{"date":"20200618154100"}}], automation_actions: [{"action":{"command":"start","target":"alert","options":{"alert_message":"This device has been currently marked as lost."}},"delay":0}]};
      
      storage.do('set', { type: 'triggers', id: id, data: data }, () => {
      // storage.set('triggers', id, data, () => {
        done();
      })
    });
  })

  describe('store keys', () => {
    before(function(done) {
      console.log("TPM DIR!!", tmpdir())
      storage.init('geofences', tmpdir() + '/bar.db', done);
    })
    it('store the key', (done) => {
      value = "hola";
      
      // storage.do('set', { type: 'keys', data: {key: 'chau', value: "hola"}}, () => {
      // // storage.set('triggers', id, data, () => {
      //   done();
      // })
      var public_key = "im the public key!";
      var private_key = "im the private key!"
      
      storage.do('set', {type: 'keys', data: {key: 'public_key', value: public_key }} , function(err) {
        done();
      })

    });

  })



  describe('recover data from old db', () => {
    var path, db;
    before((done) => {
      // creating and old storage db and adding it some dummy data.
      path = join(tmpdir(), 'old_commands.db');
      
      storage.init(null, path, (err, old_db) => {
        db = old_db;
        add_to_db(old_db, 'commands', 'eyJzdGFydC1hbGVydCI6eyJjb21tYW5kIjoic3RhcnQiLCJ0YXJnZXQiOiJhbGVydCIsIm9wdGlvbnMiOnsiYWxlcnRfbWVzc2FnZSI6IlRoaXMgZGV2aWNlIGhhcyBiZWVuIGN1cnJlbnRseSBtYXJrZWQgYXMgbG9zdCBieSB0aGUgYWRtaW4uIFBsZWFzZSBjb250YWN0IGphdm9AcHJleWhxLmNvbSB0byBhcnJhbmdlIGl0cyBzYWZlIHJldHVybiBhbmQgYXZvaWQgZnVydGhlciBtZWFzdXJlcy4ifX19', () => {
          add_to_db(old_db, 'commands', 'eyJzdGFydC1hbGFybSI6eyJjb21tYW5kIjoic3RhcnQiLCJ0YXJnZXQiOiJhbGFybSIsIm9wdGlvbnMiOnsic291bmQiOiJtb2RlbSJ9fX0', () => {
            add_to_db(old_db, 'geofences', 'eyJnZW9mZW5jZS0xMTEiOnsiaWQiOjExMSwibmFtZSI6IkhvbWUiLCJzdGF0ZSI6Imluc2lkZSJ9fQ=', () => {
              add_to_db(old_db, 'geofences', 'eyJnZW9mZW5jZS0xMTIiOnsiaWQiOjExMiwibmFtZSI6IldvcmsiLCJzdGF0ZSI6Im91dHNpZGUifX0=', () => {
                add_to_db(old_db, 'geofences', 'eyJnZW9mZW5jZS0xMTMiOnsiaWQiOjExMywibmFtZSI6IlUiLCJzdGF0ZSI6Im91dHNpZGUifX0=', () => {
                  add_to_db(old_db, 'files', 'eyJmaWxlLTExQjYyRTgyRTBDODI3Mzg0MEJFMUE4MTI2OTEwQTU4Ijp7InBhdGgiOiIvVXNlcnMvdXNlci9maWxlLmRvdCIsInNpemUiOjQyLCJ1c2VyIjoidXNlciIsIm5hbWUiOiJmaWxlLmRvdCIsInJlc3VtYWJsZSI6ZmFsc2V9fQ===', done)
                });
              });
            });
          });
        })
      });
    })
    
    after(() => {

    })

    it('recovers the data and saves it in the new format', (done) => {
      console.log("DB!!", db)
      storage.recover_db(db, () => {
        done();
      })
      
    });
  });

  // describe('encrypt commands file', () => {
  //   var crypto = require('crypto');

  //   // const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  //   //   modulusLength: 4096,
  //   //   publicKeyEncoding: {
  //   //     type: 'pkcs1',
  //   //     format: 'pem',
  //   //   },
  //   //   privateKeyEncoding: {
  //   //     type: 'pkcs1',
  //   //     format: 'pem',
  //   //     cipher: 'aes-256-cbc',
  //   //     passphrase: '',
  //   //   },
  //   // })
  
  //   // fs.writeFileSync(join(tmpdir(), 'private.pem'), privateKey)
  //   // fs.writeFileSync(join(tmpdir(), 'public.pem'), publicKey)

  //   before(function(done) {
  //     let id3   = uuidv4(),
  //         data3 = {command: 'start', target: 'alarm', options: {sound: 'modem'}};

  //     storage.init('commands', tmpdir() + '/cypher.db', () => {
  //       storage.do('set', { type: 'commands', id: id3, data: data3 }, () => {
  //       // storage.set('commands', id3, data3, () => {


  //         done();

  //       });
  //     });
  //     // done();
  //   })

  //   it('coso', function(done) {
  //     let key = 'MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCcoWlqtsJIZ9Ed4KSDhsVXJc8P';
  //     const algorithm = 'aes-256-ctr';
  //     key = crypto.createHash('sha256').update(String(key)).digest('base64').substr(0, 32);


  //     const encrypt = (file, cb) => {
  //       let buffer = fs.readFileSync(file);

  //       // if tiene esos caractares, nada q hacer

  //       const oe = buffer.slice(-9);
  //       if (oe == key.substring(0, 9)) {
  //         // ya está cifrado!!!
  //         return cb(new Error("YA ESTA CIFRADO, se supone"))
  //       }

  //       // Create an initialization vector
  //       const iv = crypto.randomBytes(16);
  //       // Create a new cipher using the algorithm, key, and iv
  //       const cipher = crypto.createCipheriv(algorithm, key, iv);

  //       // console.log("FINAL!", key.substring(0, 9))

  //       // Create the new (encrypted) buffer
  //       const result = Buffer.concat([iv, cipher.update(buffer), cipher.final(), Buffer.from(key.substring(0, 9))]);
  //       // const result = Buffer.concat([iv, cipher.update(buffer), cipher.final()]);

  //       // result = result.concat(key.substring(0, 9))
  //       // console.log("RESULT!!", result.toString())
  //       // a result añadir chars
  //       // fs.writeFileSync(join(tmpdir(), 'cypher.db'), result);
  //       fs.writeFile(file, result, cb);

  //       // return;
  //     };
      
  //     const decrypt = (file, cb) => {
  //       let encrypted = fs.readFileSync(file);

  //       // if NO tiene esos caractares, nada q hacer

  //       // Get key fragment to compare
  //       const oe = encrypted.slice(-9);
  //       if (oe != key.substring(0, 9)) {
  //         // las llaves no coinciden!!! o está descrifrado ya (?)
  //         return cb(new Error("WEA"))
  //       } 

  //       // Get the rest
  //       encrypted = encrypted.slice(0, -9);
        
  //       // Get the iv: the first 16 bytes
  //       const iv = encrypted.slice(0, 16);
  //       // Get the rest
  //       encrypted = encrypted.slice(16);
  //       // Create a decipher


  //       const decipher = crypto.createDecipheriv(algorithm, key, iv);
  //       // Actually decrypt it
  //       const result = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  //       // fs.writeFileSync(join(tmpdir(), 'cypher.db'), result);
  //       fs.writeFile(file, result, cb);
  //       // return;
  //     };

  //     // let comm_file = fs.readFileSync(join(tmpdir(), 'cypher.db'));
  //     // console.log("FILE ORIGINAL!", comm_file.toString(), '\n\n')

  //     var date = new Date();
  //     encrypt(join(tmpdir(), 'cypher.db'), (err) => {
  //       console.log("DONE ENCRYPT!!")
  //       var date2 = new Date();
  //       console.log("ENCRYPT TIME!!", date2 - date)

  //       var date3 = new Date();
  //       decrypt(join(tmpdir(), 'cypher.db'), (err) => {
  //         if (err) {
  //           console.log("ERROR!!");
  //           return done();
  //         }

  //         var date4 = new Date();
  //         console.log("DECRYPT TIME!!", date4 - date3)
  //         done();
  //       });

  //     });

  //     // encrypt(join(tmpdir(), 'cypher.db'));
  //     // console.log("Encrypted:", encrypted.toString(), '\n\n');

  //     // fs.writeFileSync(join(tmpdir(), 'cypher.db'), encrypted);
  //     // var date3 = new Date();
  //     // decrypt(join(tmpdir(), 'cypher.db'));
  //     // var date4 = new Date();

  //     // console.log("DECRYPT TIME!!", date4 - date3)
  //     // decrypt(join(tmpdir(), 'cypher.db'));
  //     // console.log('Decrypted:', decrypted.toString());


  //     // fs.writeFileSync(join(tmpdir(), 'cypher2.db'), decrypted);


  //     // let hola = crypto.publicEncrypt({key: publicKey, padding: crypto.constants.RSA_NO_PADDING}, comm_file);
  //     // console.log("CYPHER CONTENT!", hola.toString());

  //     // fs.writeFileSync(join(tmpdir(), 'cypher.db'), hola);
      
  //     // let oe = fs.readFileSync(join(tmpdir(), 'cypher.db'));
  //     // console.log("New CONTENT!", oe.toString());




  //     // console.log(comm_file, typeof comm_file)
      
  //     // var hola = crypto.publicEncrypt(publicKey, plain);
  //     // console.log(hola.toString())

  //     // var chao = crypto.privateDecrypt(privateKey, hola);

  //     // console.log(chao.toString())


  //     // done();
  //   })
  // })


  describe('otros tests', () => {

    let id3   = uuidv4(),
        id4   = uuidv4(),
        data3 = {command: 'start', target: 'alarm', options: {sound: 'modem'}};

    before(done => {
      storage.init('commands', tmpdir() + '/oeoe.db', done)
    })

    it('queue', (done) => {
      storage.do('set', { type: 'commands', id: id3, data: data3 }, () => {console.log("TERMINÓ EL SET1")});
      // console.log("OEOEOE")
      storage.do('set', { type: 'commands', id: id4, data: data3}, () => {console.log("TERMINÓ EL SET2")});

      setTimeout(() => {
        storage.do('set', { type: 'commands', id: id3, data: data3 }, () => {console.log("TERMINÓ EL SET1")});
        done();
      }, 2000)

    })

  })

  // describe('storage file encryption', () => {

    

  //   describe('when actions arrive', () => {
      

  //     describe('when file is decrypted', () => {

  //       let id   = uuidv4(),
  //           data = {command: 'start', target: 'alarm', options: {sound: 'modem'}};

  //       before(done => {
  //         storage.init('commands', tmpdir() + '/cipher.db', done)
  //       })

  //       it('stores the command and encrypt the file after x seconds', (done) => {
  //         storage.do('set', { type: 'commands', id: id, data: data }, () => {console.log("TERMINÓ EL SET1")});
  //         done();
  //       })

  //     })

  //     describe('when file is encrypted', () => {
  //       let id   = uuidv4(),
  //           id2  = uuidv4(),
  //           data = {command: 'start', target: 'alarm', options: {sound: 'modem'}},
  //           data2 = {command: 'start', target: 'alert', options: {message: 'hi'}};

  //       before(done => {
  //         storage.init('commands', tmpdir() + '/cipher2.db', () => {
  //           storage.do('set', { type: 'commands', id: id, data: data }, () => {
  //             encryption.encrypt(tmpdir() + '/cipher2.db', done);
  //           });
  //         })
  //       })

  //       it('stores the command and encrypt the file after x seconds', function(done) {
  //         this.timeout(10000)
  //         storage.do('set', { type: 'commands', id: id2, data: data2 }, () => {console.log("TERMINÓ EL SET1")});
  //         setTimeout(() => {
  //           // desencriptar y revisar comandos guardados
  //           encryption.decrypt(tmpdir() + '/cipher2.db', done);
  //         }, 6000);
  //       })

  //       describe('and the client doesnt know', () => {

  //       })


        
  //     })

  //     describe('when file is decrypting', () => {
        
  //     })

  //     describe('when file is encrypting', () => {
        
  //     })

  //   })

  // })
});