var helpers  = require('./../../../helpers'),
    should   = helpers.must,
    fs       = require('fs'),
    provider = helpers.load('providers').load('geo');

describe('location', function(){

  describe('when access points return error', function(){

  });

  describe('when access points list is empty', function(){

  });

  describe('when access points is valid', function(){

    var list = require('./../fixtures/parsed_access_points_list');

    describe('and geolocation endpoint returns error', function(){

      it('returns error', function(){

      });

    });

    describe('and geolocation endpoint returns 200 OK', function(){

      describe('and response is not valid', function(){

        before(function(){
          helpers.stub_request('get', null, {}, 'Bad response');
        })

        it('returns error', function(done){

          provider.send_data(list, function(err, data){
            err.should.be.an.instanceof(Error);
            (typeof data).should.equal('undefined');
            done();
          })

        });

      });

      describe('and response contains valid coordinates', function(){

        before(function(done){
          fs.readFile(__dirname + '/../fixtures/location_response.json', function(err, data){
            helpers.stub_request('get', null, {statusCode: 200}, data.toString().trim());
            done()
          })
        })

        it('callsback coordinates', function(done){

          provider.send_data(list, function(err, data){
            // should.not.exist(err); TODO: fix this
            data.should.be.an.instanceof(Object);
            data.should.have.keys(['lat', 'lng', 'accuracy'])
            done();
          })

        });

      });

      describe('real endpoint', function(){

        it('works', function(done){

          this.timeout(3000); // response may take longer

          provider.send_data(list, function(err, data){
            if (err) {
              console.log('\n========================================');
              console.log(' Geolocation endpoint seems to be down!');
              console.log(' ' + err.message);
              console.log('========================================\n');
            }
            done();
          })

        });

      });

    });

  });

});
