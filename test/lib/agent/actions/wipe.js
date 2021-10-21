var helpers        = require('./../../../helpers'),
    path           = require('path'),
    os             = require('os'),
    should         = require('should'),
    sinon          = require('sinon'),
    lib_path       = helpers.lib_path(),
    join           = require('path').join,
    custom_dirs    = require(join(lib_path, 'agent', 'utils', 'custom-dirs'))
    wipe_path      = join(lib_path, 'agent', 'actions', 'wipe'),
    wipe2          = require(join(lib_path, 'agent', 'actions', 'wipe', 'wipe')),
    wipe           = require(wipe_path),
    wipe_win       = require(wipe_path + '/windows'),
    sys_index_path = helpers.lib_path('system'),
    sys_index      = require(sys_index_path),
    sys_win        = require(join(sys_index_path, 'windows'))
    api_path       = join(lib_path, 'agent', 'plugins', 'control-panel', 'api'),
    keys           = require(join(api_path, 'keys'));

var outlook_versions = {
  old: {
    '2002': '10',
    '2003': '11',
    '2007': '12',
    '2010': '14'
  },
  new: {
    '2013': '15',
    '2016': '16',
  }
};

var OUTLOOK_NEW = 15,
    OUTLOOK_OLD = 10;

var registryPath = {
  outlook_version: join('HKEY_CLASSES_ROOT', 'Outlook.Application', 'CurVEr'),
  profileRegistry: join('HKEY_CURRENT_USER', 'Software', 'Microsoft'),
  firefox:         join('HKEY_CLASSES_ROOT', 'FirefoxHTML', 'DefaultIcon'),
  thunderbird:     join('HKEY_CLASSES_ROOT', 'ThunderbirdEML', 'DefaultIcon')
};

var hash;

describe('wipe valid types', function() {
  before(function() {
    hash = {
      wipe_cloud: false,
      wipe_directories: false,
      wipe_documents: false,
      wipe_passwords: false,
      wipe_cookies: false,
      wipe_emails: false
    }
  });

  describe('when one type is selected', function() {

    describe('and is not directories', function() {
      before(function() {
        hash.wipe_documents = true;
      });
      after(function() {
        hash.wipe_documents = false;
        wipe.directories = [];
      });

      it('should return documents', function(done) {
        var out = wipe.valid_types(hash);
        out.should.be.Array;
        out.length.should.equal(1);
        out[0].should.equal('documents');
        done();
      })
    });

    describe('and is directories', function() {

      describe('and is only one path', function() {
        describe('and the path is blank', function() {
          before(function() {
            hash.wipe_directories = '';
          });
          after(function() {
            hash.wipe_directories = false;
            wipe.directories = [];
          });

          it('should an empty array', function(done){
            var out = wipe.valid_types(hash);
            out.should.be.Array;
            out.length.should.equal(0);
            done();
          })
        })

        describe('and the path is invalid', function() {
          before(function() {
            hash.wipe_directories = 'not a path';
          });
          after(function() {
            hash.wipe_directories = false;
            wipe.directories = [];
          });

          it('should an empty array', function(done){
            var out = wipe.valid_types(hash);
            out.should.be.Array;
            out.length.should.equal(0);
            done();
          })
        })

        describe('and the path is valid', function() {
          before(function() {
            hash.wipe_directories = '/Users/one/path/to/wipe';
          });
          after(function() {
            hash.wipe_directories = false;
            wipe.directories = [];
          });

          it('should return directories', function(done) {
            var out = wipe.valid_types(hash);
            out.should.be.Array;
            out.length.should.equal(1);
            out[0].should.equal('directories');
            wipe.directories.length.should.equal(1);
            wipe.directories[0].should.equal('/Users/one/path/to/wipe');
            done();
          })
        })
      })

      describe('and there are more than one path', function() {
        describe('and one path is blank', function() {
          before(function() {
            hash.wipe_directories = '/Users/one/path/to/wipe, ';
          });
          after(function() {
            hash.wipe_directories = false;
            wipe.directories = [];
          });

          it('should return documents', function(done) {
            var out = wipe.valid_types(hash);
            out.should.be.Array;
            out.length.should.equal(1);
            out[0].should.equal('directories');

            wipe.directories.length.should.equal(1);
            wipe.directories[0].should.equal('/Users/one/path/to/wipe');
            done();
          })

        })

        describe('and one path is invalid', function() {
          describe('and one path is blank', function() {
            before(function() {
              hash.wipe_directories = '/Users/one/path/to/wipe, invalidpath, /Users/another/valid/path';
            });
            after(function() {
              hash.wipe_directories = false;
              wipe.directories = [];
            });

            it('should return documents', function(done) {
              var out = wipe.valid_types(hash);
              out.should.be.Array;
              out.length.should.equal(1);
              out[0].should.equal('directories');
              wipe.directories.length.should.equal(2);
              wipe.directories[0].should.equal('/Users/one/path/to/wipe');
              wipe.directories[1].should.equal('/Users/another/valid/path');
              done();
            })
          })
        })

        describe('and all paths are valid', function() {
          before(function() {
            hash.wipe_directories = '/Users/one/path/to/wipe,/Users/another/valid/path,/Users/lastvalid';
          });
          after(function() {
            hash.wipe_directories = false;
            wipe.directories = [];
          });

          it('should return documents', function(done) {
            var out = wipe.valid_types(hash);
            out.should.be.Array;
            out.length.should.equal(1);
            out[0].should.equal('directories');
            wipe.directories.length.should.equal(3);
            wipe.directories[0].should.equal('/Users/one/path/to/wipe');
            wipe.directories[1].should.equal('/Users/another/valid/path');
            wipe.directories[2].should.equal('/Users/lastvalid');
            done();
          })
        })
      })
    })
  })

  describe('when more than one type is selected', function() {
    describe('and no includes directories', function() {
      before(function() {
        hash.wipe_documents = true;
        hash.wipe_passwords = true;
        hash.wipe_emails = true;
      });
      after(function() {
        hash.wipe_documents = false;
        hash.wipe_passwords = false;
        hash.wipe_emails = false;
        wipe.directories = [];
      });

      it('should return documents', function(done) {
        var out = wipe.valid_types(hash);
        out.should.be.Array;
        out.length.should.equal(3);
        out[0].should.equal('documents');
        out[1].should.equal('passwords');
        out[2].should.equal('emails');
        done();
      })
    });

    describe('and includes directories', function() {
      describe('and the path is valid', function() {
        before(function() {
          hash.wipe_directories = '/Users/valid/path';
          hash.wipe_passwords = true;
        });
        after(function() {
          hash.wipe_directories = false;
          hash.wipe_passwords = false;
          wipe.directories = [];
        });

        it('should return documents', function(done) {
          var out = wipe.valid_types(hash);
          out.should.be.Array;
          out.length.should.equal(2);
          out[0].should.equal('directories');
          out[1].should.equal('passwords');
          wipe.directories[0].should.equal('/Users/valid/path');
          done();
        })
      })
      describe('and the path is invalid', function() {
        before(function() {
          hash.wipe_directories = 'invalidpath';
          hash.wipe_passwords = true;
        });
        after(function() {
          hash.wipe_directories = false;
          hash.wipe_passwords = false;
          wipe.directories = [];
        });

        it('should return documents', function(done) {
          var out = wipe.valid_types(hash);
          out.should.be.Array;
          out.length.should.equal(1);
          out[0].should.equal('passwords');
          wipe.directories.length.should.equal(0);
          done();
        })
      })
    });
  });
});

describe('in Windows OS', function() {

  var platform_stub,
      outlook_version,
      spy_fetch_dirs;

  var opts = { "wipe_directories": "/Users/user/Desktop/file.txt" };

  before(() => {
    wipe.node_bin = '/usr/local/bin/node';
    sys_index.os_name = "windows";
    sys_index.check_service = sys_win.check_service;
    sys_index.run_as_admin = sys_win.run_as_admin;
    platform_stub = sinon.stub(os, 'platform').callsFake(() => { return 'win32'; });
    keys_get_stub = sinon.stub(keys, 'get').callsFake(() => {
      return { api: 'aaaaaaaaaa', device: 'bbbbbb' }
    });
  })

  after(() => {
    platform_stub.restore();
    keys_get_stub.restore();
  })

  describe('on registry commands', function() {
    wipe_win.registryManager.query.toString().should.containEql('reg query');
    wipe_win.registryManager.add.toString().should.containEql('reg add');
    wipe_win.registryManager.delete.toString().should.containEql('reg delete');
    wipe_win.registryManager.killtask.toString().should.containEql('taskkill');
  })

  describe('when running in old Outlook version', function() {
    iterate_versions(outlook_versions.old);
  });

  describe('when running in new Outlook version', function() {
    iterate_versions(outlook_versions.new);
  });

  describe('when service is available', () => {
    before(() => {
      spy_fetch_dirs = sinon.spy(wipe2, 'fetch_dirs');
      sys_win.monitoring_service_go = true;
    });

    after(() => {
      spy_fetch_dirs.restore();
    })

    it('should wipe through the service', (done) => {
      wipe.start("123",opts, (err, em) => {
        em.on('end', (err, out) => {
          spy_fetch_dirs.calledOnce.should.equal(true);
          done();
        })
      })
    })
  })

  describe('when service is not available', () => {
    before(() => {
      sys_win.monitoring_service_go = false;
    })

    it('should not wipe through the service', (done) => {
      wipe.start("1234",opts, (err, em) => {
        em.on('end', (id,err, out) => {
          should.exist(err);
          err.message.should.containEql("Wipe command failed.")
          done();
        })
      })
    })
  })

  function iterate_versions(versions) {
    Object.keys(versions).forEach(function(k) {
      test_outlook_version(k, versions[k]);
    });
  }

  function get_outlook_path(version) {
    if (parseInt(version) >= 15) {
      return join('HKEY_USERS', 'User1', 'Software', 'Microsoft', 'Office', `${version}.0`, 'Outlook', 'Profiles');
    } else if (parseInt(version) < OUTLOOK_NEW && parseInt(version) >= OUTLOOK_OLD) {
      return join('HKEY_USERS', 'Software', 'Microsoft', 'User1', 'Windows NT', 'CurrentVersion', 'Windows Messaging Subsystem', 'Profiles');
    } else {
      return join('HKEY_USERS', 'Software', 'Microsoft', `User1`, 'Windows Messaging Subsystem', 'Profiles');
    }
  }

  function test_outlook_version(version_type, version) {
    var stub_path;
    var stub_registry;
    
    describe(version_type, function() {
      before(function() {
        stub_path = sinon.stub(wipe_win, 'getOutlookVersion').callsFake(cb => {
          cb(null, version);
        })
        stub_registry = sinon.stub(wipe_win.registryManager, 'query').callsFake((query, cb) => {
          return cb(null, '\r\nUser1\r\n')
        })
      });

      after(function() {
        stub_registry.restore();
        stub_path.restore();
      });

      it('returns path', function(done) {
        wipe_win.getProfileRegistry(function(err, out) {
          out[0].should.equal(get_outlook_path(version));
          done();
        });
      });
    });
  };
});