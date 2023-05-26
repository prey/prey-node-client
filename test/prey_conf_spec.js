var fs                  = require('fs'),
    join                = require('path').join,
    should              = require('should'),
    getset              = require('getset'),
    is_windows          = process.platform === 'win32',
    file_path           = join(__dirname, '..', 'prey.conf.default'),
    conf_file_contents  = fs.readFileSync(file_path, 'utf8');

var get_value = function(key) {
  var regex = new RegExp(key + '\\s=(.*)');
  return conf_file_contents.match(regex)[1].trim();
};

describe('prey_conf_spec', function() {

  var config;

  before(function(done) {
    config = getset.load(file_path, done);
  })

  after(function() {
    config.unload();
  })

  it('it should be valid ini format (with # instead of ; though)', function(){
    var lines = conf_file_contents.split('\n');

    lines.forEach(function(line){
      if (line.length > 0)
        line[0].should.not.be.equal(';');
    });
  });

  it('plugin_list should default to control-panel', function(){
    var drivers = get_value('plugin_list');
    drivers.should.equal('control-panel');

    var val = config.get('plugin_list');
    val.should.be.a.Array;
    val[0].should.equal('control-panel');
  });

  it('host should be set to solid.preyproject.com', function(){
    var host = get_value('host');
    host.should.equal('solid.preyproject.com');

    // it should be under the control-panel subkey
    var val = config.get('control-panel', 'host');
    val.should.equal('solid.preyproject.com');
  });

  it('protocol should be set to https', function(){
    var protocol = get_value('protocol');
    protocol.should.equal('https');

    // it should be under the control-panel subkey
    var val = config.get('control-panel', 'protocol');
    val.should.equal('https');
  });

  it('api_key should be empty', function(){
    var api_key = get_value('api_key');
    api_key.should.be.empty;

    // it should be under the control-panel subkey
    var obj = config.get('control-panel');
    Object.keys(obj).should.containEql('api_key');
  });

  it('device_key should be empty', function(){
    var device_key = get_value('device_key');
    device_key.should.be.empty;

    // it should be under the control-panel subkey
    var obj = config.get('control-panel');
    Object.keys(obj).should.containEql('device_key');
  });

});
