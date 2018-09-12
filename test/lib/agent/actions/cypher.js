var helpers = require('./../../../helpers'),
    should = require('should'),
    sinon = require('sinon'),
    lib_path = helpers.lib_path(),
    os   = require('os'),
    path = require('path')
    join = path.join,
    cp = require('child_process'),
    exec = cp.exec,
    commands = helpers.load('commands'),
    providers = require(join(lib_path, 'agent','providers')), 
    cypher_path = join(lib_path, 'agent', 'actions', 'cypher'),
    cypher = require(cypher_path);

describe('cypher', () => {
  var spawn_stub;

  // before(() => {
  //   spawn_stub = sinon.stub(system, 'spawn_as_logged_user', function(binary, opts, cb) {
  //     var spawn = cp.spawn();
  //     return cb(null, spawn);
  //   });
  // })

  // after(() => {
  //   spawn_stub.restore();
  // })

  describe('on encrypt', () => {

    describe('when options are invalid', () => {

      describe('no mode included or invalid', () => {
        var opts = {
          mode: "notavalidmode",
          cypher_directories: "/Users/john/Desktop/directory",
          extensions: ".xls, .xlsx, .doc, .docx, .pdf, .txt, .jpg, .jpeg, .png"
        }

        it('rejects with a mode error', (done) => {
          // commands.perform(command);
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
          // commands.perform(command);
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

      describe('no extensions included', () => {
        var opts = {
          mode: "encrypt",
          cypher_directories: "/Users/john/Desktop/directory"
          // cypher_user_dirs: true
        }

        it('rejects with a path error', (done) => {
          cypher.validateOpts(opts)
          .then(options => {
            done(new Error('Expected method to reject.'));
          })
          .catch(err => {
            err.should.exist;
            err.message.should.containEql('No files extensions available');
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
            // options.cloud.should.be.equal('Dropbox,Google Drive,OneDrive');
            path.isAbsolute(options.dirs[0]).should.be.true;
            done();
          })
          .catch(err => {
            done(new Error('Expected method to resolved.'));
          })
        })
      })

      describe('when the users options is cypher_directories', () => {
        
      })
    })

  })




  describe('on decrypt', () => {
    var users_stub;

    var opts = {
      mode: 'decrypt'
    }

    before(() => {
      var users = 'users_list';
      users_stub = sinon.stub(providers, 'get', (users, cb) => {
        return cb(null, ['john', 'charles', 'yeiboss']);
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
