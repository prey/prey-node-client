var fs      = require('fs'),
    should  = require('should'),
    tmpdir  = require('os').tmpdir,
    helpers = require('../../../helpers'),
    storage = require(helpers.lib_path('agent', 'utils', 'storage'));

describe('storage', function() {

  var file;

  function close() {
    storage.close();
  }

  describe('loading', function() {

    describe('with empty path', function() {

      before(function() {
        storage.init('');
      })

      after(storage.close);

      it('callsback an error', function(done) {
        storage.get('foo', function(err) {
          err.should.be.a.Error;
          err.message.should.containEql('Invalid path');
          done();
        })
      })

    })

    describe('with nonexisting path', function() {

      before(function() {
        storage.init('/bar');
      })

      after(storage.close);

      it('does not callback an error', function(done) {
        storage.get('foo', function(err) {
          should.not.exist(err);
          done();
        })
      })

    })

    describe('with no read access to path', function() {

      before(function(done) {
        file = tmpdir() + '/foo.db';
        fs.createWriteStream(file);
        storage.init(file);
        fs.chmod(file, '0000', done);
      })

      after(storage.close);

      it('callsback an error', function(done) {
        storage.get('foo', function(err) {
          err.should.be.a.Error;
          err.code.should.eql('EACCES');
          done();
        })
      })

    })

    describe('with valid path', function() {

      before(function() {
        storage.init(tmpdir + '/ok.db');
      })

      after(storage.close);

      it('does not callback an error', function(done) {
        storage.get('foo', function(err) {
          should.not.exist(err);
          done();
        })
      })

    })

  })

  describe('get()', function() {

    describe('when not initialized', function() {

      before(function() {
        storage.close();
      })

      it('callsback an error', function(done) {
        storage.get('foo', function(err) {
          err.should.be.a.Error;
          err.message.should.containEql('Invalid path');
          done();
        })
      })

    })

    describe('when initialized', function() {

      before(function() {
        file = tmpdir() + '/get.db';
        storage.init(file);
      })

      after(storage.close);

      describe('and key does not exist', function() {

        it('returns undefined', function(done) {

          storage.get('foo', function(err, res) {
            should.not.exist(err);
            should.equal(res, undefined);
            done();
          })

        })

      })

      describe('and key exists', function() {

        before(function() {
          storage.set('foo', 'bar');
        })

        it('returns value', function(done) {

          storage.get('foo', function(err, res) {
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
        storage.close();
      })

      it('callsback an error', function(done) {
        storage.get('foo', function(err) {
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

        before(function() {
          storage.init(file);
        })

        after(storage.close);

        it('does not callback an error', function(done) {
          storage.set('foo', 'bar', function(err) {
            should.not.exist(err);
            done();
          })
        })

        it('creates file on disk', function(done) {

          storage.set('quux', 123, function(err) {
            should.not.exist(err);
            fs.existsSync(file).should.be.true;
            done();
          })

        })

        describe('when key exists', function() {

          before(function(done) {
            storage.set('existing', 'xxx', done)
          })

          it('replaces existing key', function(done) {

            storage.set('existing', 123, function(err) {
              should.not.exist(err);

              storage.get('existing', function(e, res) {
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
          storage.init(file);
          setTimeout(function() {
            fs.chmod(file, '0000', done);
          }, 10);
        })

        after(storage.close);

        it('callsback an error', function(done) {
          storage.get('foo', function(err) {
            err.should.be.a.Error;
            err.code.should.eql('EACCES');
            done();
          })
        })

      })

    })

  })

  describe('del()', function() {

    describe('when not initialized', function() {

      before(storage.close)

      it('callsback an error', function(done) {
        storage.get('foo', function(err) {
          err.should.be.a.Error;
          err.message.should.containEql('Invalid path');
          done();
        })
      })

    })

    describe('when initialized', function() {

      before(function() {
        file = tmpdir() + '/del.db';
        storage.init(file);
      })

      after(storage.close);

      describe('if key does not exist', function() {

        it('does not callback an error', function(done) {
          storage.del('foo', function(err) {
            should.not.exist(err);
            done();
          })
        })

      })

      describe('if key exists', function() {

        before(function(done) {
          storage.set('foo', 'xxx', done)
        })

        describe('if no other keys are present', function() {

          before(function(done) {
            storage.all(function(err, obj) {
              Object.keys(obj).length.should.eql(1);
              done();
            })
          })

          it('it removes it from list', function(done) {
            storage.del('foo', function(err) {
              should.not.exist(err);

              storage.get('foo', function(e, res) {
                should.not.exist(res);
                done();
              })
            })
          })

          it('removes file', function() {
            storage.del('foo', function(err) {
              should.not.exist(err);
              fs.existsSync(file).should.be.false;
            })
          })

        })

        describe('if other keys are present', function() {

          before(function(done) {
            storage.set('bar', 'hola', done);
          })

          it('it removes it from list', function(done) {
            storage.del('foo', function(err) {
              should.not.exist(err);

              storage.get('foo', function(err, res) {
                should.not.exist(res);
                done();
              })
            })
          })

          it('does not remove file', function() {
            storage.del('foo', function(err) {
              should.not.exist(err);
              fs.existsSync(file).should.be.true;
            })
          })

        })


      })

    })

  })

})
