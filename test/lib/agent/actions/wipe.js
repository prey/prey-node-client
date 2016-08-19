var helpers = require('./../../../helpers'),
    should = require('should'),
    sinon = require('sinon'),
    lib_path = helpers.lib_path(),
    os   = require('os'),
    join = require('path').join,
    exec = require('child_process').exec,
    wipe_path = join(lib_path, 'agent', 'actions', 'wipe', 'windows'),
    wipe_win = require(wipe_path);

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

var regispath = {
  outlook_version: join('HKEY_CLASSES_ROOT', 'Outlook.Application', 'CurVEr'),
  profileRegistry: join('HKEY_CURRENT_USER', 'Software', 'Microsoft'),
  firefox:         join('HKEY_CLASSES_ROOT', 'FirefoxHTML', 'DefaultIcon'),
  thunderbird:     join('HKEY_CLASSES_ROOT', 'ThunderbirdEML', 'DefaultIcon')
};

describe('in Windows OS', function() {

  var platform_stub,
      outlook_version;

  describe('on registry commands', function() {
    wipe_win.registry.query.toString().should.containEql('reg query');
    wipe_win.registry.add.toString().should.containEql('reg add');
    wipe_win.registry.delete.toString().should.containEql('reg delete');
    wipe_win.registry.killtask.toString().should.containEql('taskkill');
    wipe_win.registry.createProfile.toString().should.containEql('-CreateProfile default');
  })

  describe('when running in old Outlook version', function() {
    iterate_versions(outlook_versions.old);
  });

  describe('when running in new Outlook version', function() {
    iterate_versions(outlook_versions.new);
  });

  function iterate_versions(versions) {
    Object.keys(versions).forEach(function(k) {
      test_outlook_version(k, versions[k]);
    });
  }

  function get_outlook_path(version) {
    if (parseInt(version) >= 15) {
      return join(regispath.profileRegistry, 'Office', version + '.0', 'Outlook', 'Profiles');
    } else {
      return join(regispath.profileRegistry, 'Windows NT', 'CurrentVersion', 'Windows Messaging Subsystem', 'Profiles');
    }
  }

  function test_outlook_version(version_type, version) {
    var stub_path;
    
    describe(version_type, function() {
      before(function() {
        stub_path = sinon.stub(wipe_win, 'getOutlookVersion', function(cb){
          cb(null, version);
        })
      });

      after(function() {
        stub_path.restore();
      });

      it('returns path', function(done) {
        wipe_win.getProfileRegistry(function(err, out) {
          out.should.equal(get_outlook_path(version));
          done();
        });
      });
    });
  };
});