
var fs      = require('fs'),
    join    = require('path').join,
    should  = require('should');

describe('prey_conf_spec', function(){
  var conf_file_path = join(__dirname, '..', 'prey.conf.default');

  it('it should be valid ini format (with # instead of ; though)', function(){
    var lines = fs.readFileSync(conf_file_path, 'utf8').split('\n');

    lines.forEach(function(line){
      if (line.length > 0)
        line[0].should.not.be.equal(';');
    });
  });

  it('driver should be set to control-panel', function(){
    var driver = fs.readFileSync(conf_file_path, 'utf8').match(/\ndriver\s=\s(.*)\n/)[1]
    driver.should.be.equal('control-panel');
  });

  it('host should be set to control.preyproject.com', function(){
    var host = fs.readFileSync(conf_file_path, 'utf8').match(/\nhost\s=\s(.*)\n/)[1]
    host.should.be.equal('control.preyproject.com');
  });

  it('protocol should be set to https', function(){
    var protocol = fs.readFileSync(conf_file_path, 'utf8').match(/\nprotocol\s=\s(.*)\n/)[1]
    protocol.should.be.equal('https');
  });

  it('api_key should be empty', function(){
    var api_key = fs.readFileSync(conf_file_path, 'utf8').match(/\napi_key\s=\s(.*)\n/)[1]
    api_key.should.be.empty;
  });

  it('device_key should be empty', function(){
    var device_key = fs.readFileSync(conf_file_path, 'utf8').match(/\ndevice_key\s=\s(.*)\n/)[1]
    device_key.should.be.empty;
  });
});
