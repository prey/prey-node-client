var fs       = require('fs'),
    os       = require('os'),
    join     = require('path').join, 
    should   = require('should'),
    sinon    = require('sinon'),
    archiver = require('archiver'),
    needle   = require('needle'),
    rimraf   = require('rimraf'),
    unzip    = require('buckle').open,
    tmpdir   = require('os').tmpdir,
    helpers  = require('./../../../helpers'),
    lib_path = helpers.lib_path(),
    common   = require(helpers.lib_path('common')),    
    action_path = join(lib_path, 'agent', 'actions', 'logretrieval'),
    logretrieval = require(action_path);

var uploader_stub,
    unlink_stub;

var etc_dir   = join(tmpdir(), 'etc'),
    prey_dir  = join(etc_dir, 'prey'),
    var_dir   = join(tmpdir(), 'var'),
    log_dir   = join(var_dir, 'log'),
    logs_dir  = join(prey_dir, 'logs'),
    logs_zip  = join(prey_dir, 'logs.zip'),
    log_file  = join(log_dir, 'prey.log'),
    conf_file = join(prey_dir, 'prey.conf'),
    comm_file = join(prey_dir, 'commands.db'),
    rotated_log_file    = join(prey_dir, 'prey.log.1.gz'),
    winsvc_log_file     = join(prey_dir, 'winsvc.log'),
    winsvc_updater_file = join(prey_dir, 'updater.log');

logretrieval.tmpdir = prey_dir;

const id = '1234';

describe('Logretrieval', () => {

  beforeEach((done) => {
    common.system.paths.config   = prey_dir;
    common.system.paths.log      = log_dir;
    common.system.paths.log_file = log_file;

    fs.mkdirSync(etc_dir);
    fs.mkdirSync(prey_dir);
    fs.mkdirSync(var_dir);
    fs.mkdirSync(log_dir);

    fs.writeFileSync(conf_file, Buffer.from("Hi, I'm the prey.conf"));
    fs.writeFileSync(comm_file, Buffer.from("I store commands"));
    fs.writeFileSync(log_file, Buffer.from("And I'm the f***ing log"));
    fs.writeFileSync(winsvc_log_file, Buffer.from("Admin service log!"));
    fs.writeFileSync(winsvc_updater_file, Buffer.from("Updater log for win service"));

    // Simulate a rotated log zipped file.
    var output = fs.createWriteStream(rotated_log_file);
    var file1 = join(tmpdir(), 'var', 'log', 'prey.log')
    var archive = archiver('zip', {
      zlib: { level: 9 }
    });
    archive.pipe(output);

    archive.append(fs.createReadStream(file1), { name: 'prey.log' });
    archive.finalize();
    
    setTimeout(() => {
      done();
    }, 500)

  })

  afterEach((done) => {
    rimraf.sync(etc_dir);
    rimraf.sync(var_dir);
    done();
  })

  describe('files compression', () => {

    before(() => {
      uploader_stub = sinon.stub(needle, 'post').callsFake((url, data, opts, cb) => {
        let res = { statusCode: 200 }
        return cb(null, res);
      });
      unlink_stub = sinon.stub(fs, 'unlink').callsFake((file, cb) => {
        return cb(null);
      });
    })

    after(() => {
      uploader_stub.restore();
      unlink_stub.restore();
    })

    describe('when the compression is successful', () => {

      describe('and the OS is not windows', () => {

        it('has all the files zipped except winsvc', function(done) {
          logretrieval.start(id, {}, (err, em) => {

            em.once('end', (id, err) => {
              should.not.exist(err);
              fs.existsSync(logs_zip).should.be.true;

              unzip(logs_zip, () => {
                fs.existsSync(logs_dir).should.be.equal(true);
                fs.existsSync(join(logs_dir, 'prey.log.1.gz')).should.be.equal(true);
                fs.existsSync(join(logs_dir, 'prey.log')).should.be.equal(true);
                fs.existsSync(join(logs_dir, 'prey.conf')).should.be.equal(true);
                fs.existsSync(join(logs_dir, 'commands.db')).should.be.equal(true);
                fs.existsSync(join(logs_dir, 'winsvc.log')).should.be.equal(false);
                fs.existsSync(join(logs_dir, 'updater.log')).should.be.equal(false);

                // Check files content
                fs.readFileSync(join(logs_dir, 'prey.log')).toString().should.containEql("And I'm the f***ing log");
                fs.readFileSync(join(logs_dir, 'prey.conf')).toString().should.containEql("Hi, I'm the prey.conf");
                fs.readFileSync(join(logs_dir, 'commands.db')).toString().should.containEql("I store commands");

                done();
              })
            })
          });
        });
      });

      describe('and the OS is windows', () => {

        var win_stub;
        before(() => {
          win_stub = sinon.stub(os, 'platform').callsFake(() => { return 'win32'; });
        });

        after(() => {
          win_stub.restore();
        });

        it('has all the files zipped', function(done) {
          logretrieval.start(id, {}, (err, em) => {
            em.once('end', (id, err) => {
              should.not.exist(err);
              fs.existsSync(logs_zip).should.be.true;

              unzip(logs_zip, () => {
                fs.existsSync(logs_dir).should.be.equal(true);
                fs.existsSync(join(logs_dir, 'prey.log.1.gz')).should.be.equal(true);
                fs.existsSync(join(logs_dir, 'prey.log')).should.be.equal(true);
                fs.existsSync(join(logs_dir, 'prey.conf')).should.be.equal(true);
                fs.existsSync(join(logs_dir, 'commands.db')).should.be.equal(true);
                fs.existsSync(join(logs_dir, 'winsvc.log')).should.be.equal(true);
                fs.existsSync(join(logs_dir, 'updater.log')).should.be.equal(true);

                // Check files content
                fs.readFileSync(join(logs_dir, 'prey.log')).toString().should.containEql("And I'm the f***ing log");
                fs.readFileSync(join(logs_dir, 'prey.conf')).toString().should.containEql("Hi, I'm the prey.conf");
                fs.readFileSync(join(logs_dir, 'commands.db')).toString().should.containEql("I store commands");
                fs.readFileSync(join(logs_dir, 'winsvc.log')).toString().should.containEql("Admin service log!");
                fs.readFileSync(join(logs_dir, 'updater.log')).toString().should.containEql("Updater log for win service");

                done();
              })
            })
          });
        });
      });
    });

    describe('when the compression of one file fails', () => {

      it('compress the other files', (done) => {
        fs.chmod(conf_file, '0000', () => {
          logretrieval.start(id ,{}, (err, em) => {
            em.once('end', (id, err) => {
              should.not.exist(err);
              fs.existsSync(logs_zip).should.be.true;

              unzip(logs_zip, () => {
                fs.existsSync(logs_dir).should.be.equal(true);
                fs.existsSync(join(logs_dir, 'prey.log')).should.be.equal(true);
                fs.existsSync(join(logs_dir, 'prey.conf')).should.be.equal(false);
                fs.existsSync(join(logs_dir, 'commands.db')).should.be.equal(true);

                // Check files content
                fs.readFileSync(join(logs_dir, 'prey.log')).toString().should.containEql("And I'm the f***ing log");
                fs.readFileSync(join(logs_dir, 'commands.db')).toString().should.containEql("I store commands");

                done();
              });
            });
          });
        });
      });
    });
  });

  describe('upload request', () => {

    before(() => {
      uploader_stub = sinon.stub(needle, 'post').callsFake((url, data, opts, cb) => {
        let res = { statusCode: 400 }
        return cb(null, res);
      });
      upload_spy = sinon.spy(logretrieval, 'upload_zip');
    })

    after(() => {
      uploader_stub.restore();
      upload_spy.restore();
    })

    describe('upload fails', () => {

      it('returns an error', (done) => {
        logretrieval.start(id, {}, (err, em) => {
          em.once('end', (id, err) => {
            should.exist(err);
            err.message.should.be.equal("There was an error uploading logs file");
            done();
          });
        });
      })

    });
      
  })
});