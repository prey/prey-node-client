
var fs                  = require('fs'),
    join                = require('path').join,
    should              = require('should'),
    is_windows          = process.platform === 'win32',
    conf_file_contents  = fs.readFileSync(join(__dirname, '..', 'prey.conf.default'), 'utf8');

var get_value = function(key) {
  var regex = new RegExp(key + '\\s=\\s(.*)');
  return conf_file_contents.match(regex)[1];
};

describe('prey_conf_spec', function(){

  it('it should be valid ini format (with # instead of ; though)', function(){
    var lines = conf_file_contents.split('\n');

    lines.forEach(function(line){
      if (line.length > 0)
        line[0].should.not.be.equal(';');
    });
  });

  it('driver should be set to interval & push', function(){
    var drivers = get_value('drivers');
    drivers.should.be.equal('interval, push');
  });

  it('endpoints should be set to control-panel', function(){
    var endpoints = get_value('endpoints');
    endpoints.should.be.equal('control-panel');
  });

  it('triggers should be set to network, battery', function(){
    var triggers = get_value('triggers');
    triggers.should.be.equal('network, battery');
  });

  it('host should be set to control.preyproject.com', function(){
    var host = get_value('host');
    host.should.be.equal('control.preyproject.com');
  });

  it('protocol should be set to https', function(){
    var protocol = get_value('protocol');
    protocol.should.be.equal('https');
  });

  it('api_key should be empty', function(){
    var api_key = get_value('api_key');
    api_key.should.be.empty;
  });

  it('device_key should be empty', function(){
    var device_key = get_value('device_key');
    device_key.should.be.empty;
  });
});
