/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
const { expect } = require('chai');
const rewire = require('rewire');

describe('Geo Linux Native Provider', () => {
  let linuxGeo;

  beforeEach(() => {
    linuxGeo = rewire('../../../../../lib/agent/providers/geo/linux/index');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('parse', () => {
    it('should parse valid dbus output with lat, lng and altitude', (done) => {
      const parse = linuxGeo.__get__('parse');
      const output = 'double 37.7749\ndouble -122.4194\ndouble 15.8';

      parse(output, (err, res) => {
        expect(err).to.be.null;
        expect(res).to.deep.equal({ lat: 37.7749, lng: -122.4194, altitude: 15.8 });
        done();
      });
    });

    it('should return error when dbus output has insufficient coordinates', (done) => {
      const parse = linuxGeo.__get__('parse');

      parse('double 37.7749', (err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Unable to get location.');
        done();
      });
    });

    it('should parse lat and lng even when altitude is missing', (done) => {
      const parse = linuxGeo.__get__('parse');

      parse('double 12.2\ndouble -70.1', (err, res) => {
        expect(err).to.be.null;
        expect(res).to.deep.equal({ lat: 12.2, lng: -70.1, altitude: undefined });
        done();
      });
    });
  });

  describe('geoclue_one', () => {
    it('should execute provider-specific command and parse response', (done) => {
      const execStub = sinon.stub().callsFake((cmd, opts, cb) => {
        expect(cmd).to.include('org.freedesktop.Geoclue.Providers.Skyhook');
        cb(null, 'double 1.0\ndouble 2.0\ndouble 3.0');
      });
      const geoclueOne = linuxGeo.__get__('geoclue_one');

      linuxGeo.__set__('exec', execStub);

      geoclueOne('Skyhook', (err, res) => {
        expect(err).to.be.null;
        expect(res).to.deep.equal({ lat: 1, lng: 2, altitude: 3 });
        expect(execStub.calledOnce).to.be.true;
        done();
      });
    });
  });

  describe('geoclue_two', () => {
    it('should execute command from get_command_two()', (done) => {
      const execStub = sinon.stub().callsFake((cmd, opts, cb) => {
        expect(cmd).to.be.a('string');
        expect(cmd).to.include('org.freedesktop.GeoClue2');
        cb(null, 'double 10.5\ndouble -20.5\ndouble 100.0');
      });
      const geoclueTwo = linuxGeo.__get__('geoclue_two');

      linuxGeo.__set__('exec', execStub);

      geoclueTwo((err, res) => {
        expect(err).to.be.null;
        expect(res).to.deep.equal({ lat: 10.5, lng: -20.5, altitude: 100 });
        expect(execStub.calledOnce).to.be.true;
        done();
      });
    });
  });

  describe('get_location', () => {
    it('should return result directly when geoclue_two succeeds', (done) => {
      const geoclueTwoStub = sinon.stub().callsFake((cb) => {
        cb(null, { lat: 8, lng: 9, altitude: 10 });
      });
      const geoclueOneStub = sinon.stub();

      linuxGeo.__set__('geoclue_two', geoclueTwoStub);
      linuxGeo.__set__('geoclue_one', geoclueOneStub);

      linuxGeo.get_location((err, res) => {
        expect(err).to.be.null;
        expect(res).to.deep.equal({ lat: 8, lng: 9, altitude: 10 });
        expect(geoclueTwoStub.calledOnce).to.be.true;
        expect(geoclueOneStub.called).to.be.false;
        done();
      });
    });

    it('should fallback from Skyhook to UbuntuGeoIP when needed', (done) => {
      const geoclueTwoStub = sinon.stub().callsFake((cb) => cb(null, null));
      const geoclueOneStub = sinon.stub();

      geoclueOneStub.onFirstCall().callsFake((provider, cb) => {
        expect(provider).to.equal('Skyhook');
        cb(null, null);
      });
      geoclueOneStub.onSecondCall().callsFake((provider, cb) => {
        expect(provider).to.equal('UbuntuGeoIP');
        cb(null, { lat: -33.4, lng: -70.6, altitude: 520 });
      });

      linuxGeo.__set__('geoclue_two', geoclueTwoStub);
      linuxGeo.__set__('geoclue_one', geoclueOneStub);

      linuxGeo.get_location((err, res) => {
        expect(err).to.be.null;
        expect(res).to.deep.equal({ lat: -33.4, lng: -70.6, altitude: 520 });
        expect(geoclueTwoStub.calledOnce).to.be.true;
        expect(geoclueOneStub.calledTwice).to.be.true;
        done();
      });
    });
  });

  describe('askLocationNativePermission', () => {
    it('should call callback when provided', (done) => {
      linuxGeo.askLocationNativePermission(() => {
        done();
      });
    });

    it('should not throw when callback is not provided', () => {
      expect(() => linuxGeo.askLocationNativePermission()).to.not.throw();
    });
  });
});
