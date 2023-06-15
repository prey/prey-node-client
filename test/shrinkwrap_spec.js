var fs          = require('fs'),
    join        = require('path').join,
    should      = require('should'),
    getset      = require('getset'),
    _           = require('underscore'),
    is_windows  = process.platform === 'win32',
    base_dir    = join(__dirname, '..'),
    package_obj = JSON.parse(fs.readFileSync(join(base_dir, 'package.json'), 'utf8')),
    shrinkwrap  = JSON.parse(fs.readFileSync(join(base_dir, 'npm-shrinkwrap.json'), 'utf8'));

function get_deps(obj) {
  return JSON.stringify(Object.keys(obj.dependencies).sort());
}

var shrinkwrap_mock = {
  dependencies: {
    "package1": {
      "version": "0.0.1",
      "from": "https://someurl.com/package1-0.0.1.tgz",
      "resolved": "https://someurl.com/package1-0.0.1.tgz"
    },
    "package2": {
      "version": "0.0.2",
      "from": "https://someurl.com/package2-0.0.2.tgz",
      "resolved": "https://someurl.com/package2-0.0.2.tgz"
    }
  }
};

describe('npm-shrinkwrap and package.json', function () {

  // testingception
  describe('when different', function() {

    var package_mock = {
      dependencies: {
        "package1": "0.0.1",
        "package2": "0.0.2",
        "package3": "0.0.3"
      }
    };

    it('equals false', function() {

      shrinkwrap_str = get_deps(shrinkwrap_mock);
      package_str = get_deps(package_mock);

      shrinkwrap_str.should.not.equal(package_str);
    });
  });

  // testingception the sequel
  describe('when equal', function() {

    var package_mock = {
      dependencies: {
        "package1": "0.0.1",
        "package2": "0.0.2",
      }
    };

    it('equals true', function() {

      shrinkwrap_str = get_deps(shrinkwrap_mock);
      package_str = get_deps(package_mock);

      shrinkwrap_str.should.equal(package_str);
    });
  });

  describe('actual files', function() {

    it('should have same dependencies', function() {

      shrinkwrap_str = get_deps(shrinkwrap);
      package_str = get_deps(package_obj);
      intersection = _.intersection(JSON.parse(shrinkwrap_str), JSON.parse(package_str))

      JSON.stringify(intersection).should.equal(package_str);
    });

  });

});