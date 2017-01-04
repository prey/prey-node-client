var fs      = require('fs'),
    should  = require('should'),
    tmpdir  = require('os').tmpdir,
    helpers = require('../../../helpers'),
    storage = require(helpers.lib_path('agent', 'utils', 'storage'));

describe('storage', function() {

  var file;
  
  describe('loading', function() {

    describe('with empty path', function() {

      before(function(done) {
        storage.init('commands', '', done);
      })

      after(function() {
        storage.close('commands');
        storage.erase('');
      })

      it('callsback an error', function(done) {
        storage.get('start-alarm', function(err) {
          err.should.be.a.Error;
          err.message.should.containEql('Invalid path');
          done();
        })
      })

    })

    describe('with nonexisting path', function() {

      before(function(done) {
        storage.init('commands', '/bar', done);
      })

      after(function() {
        storage.close('commands');
      })

      it('does not callback an error', function(done) {
        storage.get('start-alert', function(err) {
          should.not.exist(err);
          done();
        })
      })

    })

    describe('with no read access to path', function() {

      before(function(done) {
        file = tmpdir() + '/load.db';
        fs.createWriteStream(file);
        storage.init('commands', file, function() {
          storage.set('start-lock', 'xxx', function(){
            fs.chmod(file, '0000', done);
          })
        });
      })

      after(function() {
        storage.close('commands');
        storage.erase(file);
      })

      it('does not callback an error', function(done) {
        storage.get('start-lock', function(err, res) {
          should.not.exist(err);
          done();
        })
      })

    })

    describe('with valid path', function() {

      before(function(done) {
        file = tmpdir() + '/foo.db';
        storage.init('commands', file, done);
      })

      after(function() {
        storage.close('commands');
        storage.erase(file);
      })

      it('does not callback an error', function(done) {
        storage.get('start-wipe', function(err) {
          should.not.exist(err);
          done();
        })
      })

    })

  })
  
  describe('get()', function() {

    describe('when not initialized', function() {

      before(function() {
        storage.close('commands');
      })

      it('callsback an error', function(done) {
        storage.get('start-alert', function(err) {
          err.should.be.a.Error;
          err.message.should.containEql('Invalid path');
          done();
        })
      })

    })

    describe('when initialized', function() {

      before(function(done) {
        file = tmpdir() + '/go.db';
        storage.init('commands', file, done);
      })

      after(function() {
        storage.close('commands');
        storage.erase(file);
      })

      describe('and key does not exist', function() {

        it('returns undefined', function(done) {

          storage.get('foo', function(err, res) {
            err.should.be.a.Error;
            err.message.should.containEql('Not an allowed type of key');
            done();
          })

        })

      })

      describe('and key exists', function() {

        before(function(done) {
          storage.set('start-wipe', 'bar', done);
        })

        it('returns value', function(done) {
          storage.get('start-wipe', function(err, res) {
            should.not.exist(err);
            should.equal(res, 'bar');
            done();
          })

        })

      })

    })

  })
  
  describe('set()', function() {

    describe('when not initialized', function() {

      before(function() {
        storage.close('commands');
      })

      it('callsback an error', function(done) {
        storage.get('start-alert', function(err) {
          err.should.be.a.Error;
          err.message.should.containEql('Invalid path');
          done();
        })
      })

    })

    describe('when initialized', function() {

      before(function() {
        file = tmpdir() + '/set.db';
      })

      describe('with write access', function() {

        before(function(done) {
          storage.init('commands', file, done);
        })

        after(function() {
          storage.close('commands');
          storage.erase(file);
        })

        it('does not callback an error', function(done) {
          storage.set('start-alarm', 'bar', function(err) {
            should.not.exist(err);
            done();
          })
        })

        it('creates file on disk', function(done) {

          storage.set('start-wipe', '123', function(err) {
            should.not.exist(err);
            fs.existsSync(file).should.be.true;
            done();
          })

        })

        describe('when key exists', function() {

          before(function(done) {
            storage.set('start-alarm', 'xxx', done);
          })

          it('replaces existing key', function(done) {

            storage.set('start-alarm', 123, function(err) {
              should.not.exist(err);

              storage.get('start-alarm', function(e, res) {
                res.should.eql(123);
                done();
              })

            })

          });

        })

      })

      describe('with no write access', function() {

        before(function(done) {
          fs.createWriteStream(file);
          storage.init('commands', file, function() {
            setTimeout(function() {
              fs.chmod(file, '0000', done);
            }, 10);
          });
        })

        after(function() {
          storage.close('commands');
          storage.erase(file);
        })

        it('does not callback an error', function(done) {
          storage.get('start-alert', function(err) {
            should.not.exist(err);
            done();
          })
        })

      })

    })

  })

  describe('del()', function() {

    describe('when not initialized', function() {

      before(function() {
        storage.close('commands');
      });

      it('callsback an error', function(done) {
        storage.get('start-wipe', function(err) {
          err.should.be.a.Error;
          err.message.should.containEql('Invalid path');
          done();
        })
      })

    })

    describe('when initialized', function() {

      before(function(done) {
        file = tmpdir() + '/del.db';
        storage.init('commands', file, done);
      })

      after(function() {
        storage.close('commands');
        storage.erase(file);
      })

      describe('if key does not exist', function() {

        it('does not callback an error', function(done) {
          storage.del('start-lock', function(err) {
            should.not.exist(err);
            done();
          })
        })

      })

      describe('if key exists', function() {

        before(function(done) {
          storage.set('start-alarm', 'xxx', done)
        })


        describe('if no other keys are present', function() {

          before(function(done) {
            storage.all('commands', function(err, obj) {
              Object.keys(obj).length.should.eql(1);
              done();
            })
          })

          it('it removes it from list', function(done) {
            storage.del('start-alarm', function(err) {
              should.not.exist(err);

              storage.get('start-alarm', function(e, res) {
                should.not.exist(res);
                done();
              })
            })
          })

        })

        describe('if other keys are present', function() {

          before(function(done) {
            storage.set('start-lock', 'hola', done);
          })

          it('it removes it from list', function(done) {
            storage.del('start-alarm', function(err) {
              should.not.exist(err);

              storage.get('start-alarm', function(err, res) {
                should.not.exist(res);
                done();
              })
            })
          })

        })

      })

    })

  })

})
