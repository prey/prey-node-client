var helpers = require('./../../../spec_helpers'),
    should = helpers.should,
    fs = require('fs'),
    provider   = helpers.load('providers').load('geo');

describe('coordinates', function(){

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
          helpers.stub_request('post', null, {}, 'Bad response');
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
            helpers.stub_request('post', null, {statusCode: 200}, data.toString());
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
