var sinon   = require('sinon'),
    should  = require('should'),
    keys    = require('./../keys'),
    request = require('./../request'),
    push    = require('./../push');

var data_spec = { 
  specs: { 
    processor_info: { 
      model: 'Intel(R) Core(TM) i5-5350U CPU @ 1.80GHz',
      speed: '1800',
      cores: '4' 
    },
    network_interfaces_list: [],
    ram_module_list: [],
    firmware_info: { device_type: 'Laptop',
       model_name: 'MacBook',
       vendor_name: 'Apple',
       bios_vendor: 'Apple',
       bios_version: 'MBAXX',
       mb_version: '2.27f2',
       serial_number: 'XXXXXXXXXXXXXs', 
    } 
  } 
};

var opts_spec = {
  multipart: false 
}

var opts_json_spec = {
  multipart: false,
  json: true
}

var args;

describe('push', function() {
  var keys_present_stub;
  var keys_get_stub;
  var post_stub;

  before(function() {
    keys_present_stub = sinon.stub(keys, 'present').callsFake(() => {
      return true;
    })
    keys_get_stub = sinon.stub(keys, 'get').callsFake(() => {
      return { api: 'aaaaaaaaaa', device: 'bbbbbb' }
    })
    post_stub = sinon.stub(request, 'post').callsFake((url, data, opts, cb) => {
      args = opts;
      cb();
    })
  })

  after(function() {
    keys_present_stub.restore();
    keys_get_stub.restore();
    post_stub.restore();
  })

  describe('all requests', function() {
    it('includes user agent prey', function(done) {
      push.response(data_spec, opts_spec, function(err, resp, body) {
        args.user_agent.should.exist;
        args.user_agent.should.containEql('Prey/')
        done();
      })
    })
  })

  describe('when includes json true', function() {
    it('includes the content-type as json', function(done) {
      push.event(data_spec, opts_json_spec, function(err, resp, body) {
        args.json.should.exist;
        args.json.should.be.equal(true);
        done();
      })
    })
  })

  describe('when doesnt include json option', function() {
    it('includes the content-type as url-encoded', function(done) {
      push.event(data_spec, opts_spec, function(err, resp, body) {
        should.not.exist(args.json);
        done();
      })
    })
  })
})
