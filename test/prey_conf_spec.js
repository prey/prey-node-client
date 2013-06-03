
var fs                  = require('fs'),
    join                = require('path').join,
    should              = require('should'),
    is_windows          = process.platform === 'win32',
    conf_file_contents  = fs.readFileSync(join(__dirname, '..', 'prey.conf.default'), 'utf8');

var get_value = function(key) {
  var regex = is_windows
      ? new RegExp('\\r\\n' + key + '\\s=\\s(.*)\\r\\n')
      : new RegExp('\\n' + key + '\\s=\\s(.*)\\n');

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

  it('driver should be set to control-panel', function(){
    var drivers = get_value('drivers');
    drivers.should.be.equal('interval, push');
  });

  it('endpoints should be set to control-panel', function(){
    var endpoints = is_windows?
      conf_file_contents.match(/\r\nendpoints\s=\s(.*)\r\n/)[1] :
      conf_file_contents.match(/\nendpoints\s=\s(.*)\n/)[1];
    endpoints.should.be.equal('control-panel');
  });

  it('triggers should be set to control-panel', function(){
    var triggers = is_windows?
      conf_file_contents.match(/\r\ntriggers\s=\s(.*)\r\n/)[1] :
      conf_file_contents.match(/\ntriggers\s=\s(.*)\n/)[1];
    triggers.should.be.equal('network, battery');
  });


  it('host should be set to control.preyproject.com', function(){
    var host = is_windows?
      conf_file_contents.match(/\r\nhost\s=\s(.*)\r\n/)[1] :
      conf_file_contents.match(/\nhost\s=\s(.*)\n/)[1];
    host.should.be.equal('control.preyproject.com');
  });

  it('protocol should be set to https', function(){
    var protocol = is_windows?
      conf_file_contents.match(/\r\nprotocol\s=\s(.*)\r\n/)[1] :
      conf_file_contents.match(/\nprotocol\s=\s(.*)\n/)[1];
    protocol.should.be.equal('https');
  });

  it('api_key should be empty', function(){
    var api_key = is_windows?
      conf_file_contents.match(/\r\napi_key\s=\s(.*)\r\n/)[1] :
      conf_file_contents.match(/\napi_key\s=\s(.*)\n/)[1];
    api_key.should.be.empty;
  });

  it('device_key should be empty', function(){
    var device_key = is_windows?
      conf_file_contents.match(/\r\ndevice_key\s=\s(.*)\r\n/)[1] :
      conf_file_contents.match(/\ndevice_key\s=\s(.*)\n/)[1];
    device_key.should.be.empty;
  });
});
