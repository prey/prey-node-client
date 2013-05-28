
var fs                  = require('fs'),
    join                = require('path').join,
    should              = require('should'),
    is_windows          = process.platform === 'win32',
    conf_file_contents  = fs.readFileSync(join(__dirname, '..', 'prey.conf.default'), 'utf8');

describe('prey_conf_spec', function(){

  it('it should be valid ini format (with # instead of ; though)', function(){
    var lines = conf_file_contents.split('\n');

    lines.forEach(function(line){
      if (line.length > 0)
        line[0].should.not.be.equal(';');
    });
  });

  it('driver should be set to control-panel', function(){
    var driver = is_windows?
      conf_file_contents.match(/\r\ndriver\s=\s(.*)\r\n/)[1] :
      conf_file_contents.match(/\ndriver\s=\s(.*)\n/)[1];
    driver.should.be.equal('control-panel');
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
