var fs          = require('fs'),
    path        = require('path'),
    join        = path.join,
    should      = require('should'),
    sinon       = require('sinon'),
    helpers     = require('./../../../helpers'),
    lib_path    = helpers.lib_path(),
    cypher_path = join(lib_path, 'agent', 'actions', 'cypher'),
    cypher      = require(cypher_path);

describe('cypher', () => {

  describe('on encrypt', () => {

    var users_stub;
    before(() => {
      var users = 'users_list';
      users_stub = sinon.stub(fs, 'readdirSync', (users, cb) => {
        return ['john', 'charles', 'yeiboss'];
      });
    })

    after(() => {
      users_stub.restore();
    })

    describe('when options are invalid', () => {

      describe('no mode included or invalid', () => {
        var opts = {
          mode: "notavalidmode",
          cypher_directories: "/Users/john/Desktop/directory",
          extensions: ".xls, .xlsx, .doc, .docx, .pdf, .txt, .jpg, .jpeg, .png"
        }

        it('rejects with a mode error', (done) => {
          cypher.validateOpts(opts)
          .then(options => {
            done(new Error('Expected method to reject.'));
          })
          .catch(err => {
            err.should.exist;
            err.message.should.containEql('Invalid cypher mode');
            done();
          })
          
        })
      })

      describe('no dir included or invalid', () => {

        var opts = {
          mode: "encrypt",
          extensions: ".xls, .xlsx, .doc, .docx, .pdf, .txt, .jpg, .jpeg, .png"
        }

        it('rejects with a path error', (done) => {
          cypher.validateOpts(opts)
          .then(options => {
            done(new Error('Expected method to reject.'));
          })
          .catch(err => {
            err.should.exist;
            err.message.should.containEql('No cypher option selected');
            done();
          })
          
        })
      })

      describe('no extensions included', () => {
        var opts = {
          mode: "encrypt",
          cypher_directories: "/Users/john/Desktop/directory"
        }

        it('rejects with a path error', (done) => {
          cypher.validateOpts(opts)
          .then(options => {
            done(new Error('Expected method to reject.'));
          })
          .catch(err => {
            err.should.exist;
            err.message.should.containEql('No files extensions found');
            done();
          })   
        })
      })

      describe('on cypher_directories when the custom paths are not absolute', () => {
        var opts = {
          mode: "encrypt",
          cypher_directories: "Users/john/Desktop/directory,this\\is\\not\\a\\path",
          extensions: ".xls, .xlsx, .doc, .docx, .pdf, .txt, .jpg, .jpeg, .png"
        }

        it ('returns error', (done) => {
          cypher.validateOpts(opts)
          .then(options => {
            done(new Error('Expected method to reject.'));
          })
          .catch(err => {
            err.should.exist;
            err.message.should.containEql('Invalid or none directories');
            done();
          }) 
        })
      })

    })

    describe('when options are valid', () => {
      describe('when the users options is cypher_user_dirs', () => {
        var opts = {
          mode: 'encrypt',
          cypher_user_dirs: true,
          extensions: ".xls, .xlsx, .doc, .docx, .pdf, .txt, .jpg, .jpeg, .png"
        }

        it('resolves and returns users dirs', (done) => {
          cypher.validateOpts(opts)
          .then(options => {
            options.mode.should.equal('encrypt');
            options.dirs.should.be.an.Array;
            options.to_kill.should.be.an.Array;
            options.to_kill.length.should.be.equal(3);
            options.to_erase.should.be.an.Array;
            options.to_erase.length.should.be.equal(options.to_kill.length * 3);
            path.isAbsolute(options.dirs[0]).should.be.true;
            done();
          })
          .catch(err => {
            done(new Error('Expected method to resolved.'));
          })
        })
      })

      describe('when the users options is cypher_directories', () => {

        var opts = {
          mode: 'encrypt',
          cypher_user_dirs: false,
          cypher_directories: '/Users/john/Dropbox,/Users/yeiboss/Dropbox,/Users/charles/Google Drive,/Users/yeiboss/Google Drive',
          extensions: ".xls, .xlsx, .doc, .docx, .pdf, .txt, .jpg, .jpeg, .png"
        }
  
        it('returns correponding paths to delete', (done) => {
          cypher.validateOpts(opts)
          .then(options => {
            options.mode.should.equal('encrypt');
            options.dirs.should.be.an.Array;
            options.to_kill.should.be.an.Array;
            options.to_kill.length.should.be.equal(3);
            options.to_erase.should.be.an.Array;
            options.to_erase.length.should.be.equal(6);
            path.isAbsolute(options.dirs[0]).should.be.true;
            done();
          })
          .catch(err => {
            done(new Error('Expected method to resolved.'));
          })

        })

      })
    })

  })

  describe('on decrypt', () => {
    var users_stub;

    var opts = {
      mode: 'decrypt',
      extensions: ".xls, .xlsx, .doc, .docx, .pdf, .txt, .jpg, .jpeg, .png"
    }

    before(() => {
      var users = 'users_list';
      users_stub = sinon.stub(fs, 'readdirSync', (users, cb) => {
        return ['john', 'charles', 'yeiboss'];
      });
    })

    after(() => {
      users_stub.restore();
    })

    it('returns opts with users list paths', (done) => {
      cypher.validateOpts(opts)
      .then(options => {
        options.mode.should.equal('decrypt');
        options.dirs.should.be.an.Array;
        path.isAbsolute(options.dirs[0]).should.be.true;
        done();
      })
      .catch(err => {
        done(new Error('Expected method to resolved.'));
      })
    })

  })

})
