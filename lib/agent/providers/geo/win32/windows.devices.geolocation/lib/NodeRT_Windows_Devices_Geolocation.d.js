  
BasicGeoposition = (function () {
  var cls = function BasicGeoposition() {
      this.latitude = new Number();
      this.longitude = new Number();
      this.altitude = new Number();
    };
  return cls;
}) ();
exports.BasicGeoposition = BasicGeoposition;


_PositionAccuracy = function () {
  this.default = 0;
  this.high = 1;
}
exports.PositionAccuracy = new _PositionAccuracy();

_PositionStatus = function () {
  this.ready = 0;
  this.initializing = 1;
  this.noData = 2;
  this.disabled = 3;
  this.notInitialized = 4;
  this.notAvailable = 5;
}
exports.PositionStatus = new _PositionStatus();

_PositionSource = function () {
  this.cellular = 0;
  this.satellite = 1;
  this.wiFi = 2;
  this.iPAddress = 3;
  this.unknown = 4;
}
exports.PositionSource = new _PositionSource();

_GeoshapeType = function () {
  this.geopoint = 0;
  this.geocircle = 1;
}
exports.GeoshapeType = new _GeoshapeType();

_AltitudeReferenceSystem = function () {
  this.unspecified = 0;
  this.terrain = 1;
  this.ellipsoid = 2;
  this.geoid = 3;
  this.surface = 4;
}
exports.AltitudeReferenceSystem = new _AltitudeReferenceSystem();

IGeoshape = (function () {
  var cls = function IGeoshape() {
    this.altitudeReferenceSystem = new AltitudeReferenceSystem();
    this.geoshapeType = new GeoshapeType();
    this.spatialReferenceId = new Number();
  };
  

  return cls;
}) ();
exports.IGeoshape = IGeoshape;

Geopoint = (function () {
  var cls = function Geopoint() {
    this.altitudeReferenceSystem = new AltitudeReferenceSystem();
    this.geoshapeType = new GeoshapeType();
    this.spatialReferenceId = new Number();
    this.position = new BasicGeoposition();
  };
  
var cls = function Geopoint(position) {
      this.altitudeReferenceSystem = new AltitudeReferenceSystem();
      this.geoshapeType = new GeoshapeType();
      this.spatialReferenceId = new Number();
      this.position = new BasicGeoposition();
};

var cls = function Geopoint(position, altitudeReferenceSystem) {
      this.altitudeReferenceSystem = new AltitudeReferenceSystem();
      this.geoshapeType = new GeoshapeType();
      this.spatialReferenceId = new Number();
      this.position = new BasicGeoposition();
};

var cls = function Geopoint(position, altitudeReferenceSystem, spatialReferenceId) {
      this.altitudeReferenceSystem = new AltitudeReferenceSystem();
      this.geoshapeType = new GeoshapeType();
      this.spatialReferenceId = new Number();
      this.position = new BasicGeoposition();
};


  return cls;
}) ();
exports.Geopoint = Geopoint;

GeocoordinateSatelliteData = (function () {
  var cls = function GeocoordinateSatelliteData() {
    this.horizontalDilutionOfPrecision = new Number();
    this.positionDilutionOfPrecision = new Number();
    this.verticalDilutionOfPrecision = new Number();
  };
  

  return cls;
}) ();
exports.GeocoordinateSatelliteData = GeocoordinateSatelliteData;

Geocoordinate = (function () {
  var cls = function Geocoordinate() {
    this.positionSource = new PositionSource();
    this.satelliteData = new GeocoordinateSatelliteData();
    this.accuracy = new Number();
    this.altitude = new Number();
    this.altitudeAccuracy = new Number();
    this.heading = new Number();
    this.latitude = new Number();
    this.longitude = new Number();
    this.speed = new Number();
    this.timestamp = new Date();
    this.point = new Geopoint();
  };
  

  return cls;
}) ();
exports.Geocoordinate = Geocoordinate;

CivicAddress = (function () {
  var cls = function CivicAddress() {
    this.city = new String();
    this.country = new String();
    this.postalCode = new String();
    this.state = new String();
    this.timestamp = new Date();
  };
  

  return cls;
}) ();
exports.CivicAddress = CivicAddress;

Geoposition = (function () {
  var cls = function Geoposition() {
    this.civicAddress = new CivicAddress();
    this.coordinate = new Geocoordinate();
  };
  

  return cls;
}) ();
exports.Geoposition = Geoposition;

PositionChangedEventArgs = (function () {
  var cls = function PositionChangedEventArgs() {
    this.position = new Geoposition();
  };
  

  return cls;
}) ();
exports.PositionChangedEventArgs = PositionChangedEventArgs;

StatusChangedEventArgs = (function () {
  var cls = function StatusChangedEventArgs() {
    this.status = new PositionStatus();
  };
  

  return cls;
}) ();
exports.StatusChangedEventArgs = StatusChangedEventArgs;

Geolocator = (function () {
  var cls = function Geolocator() {
    this.desiredAccuracyInMeters = new Number();
    this.reportInterval = new Number();
    this.movementThreshold = new Number();
    this.desiredAccuracy = new PositionAccuracy();
    this.locationStatus = new PositionStatus();
  };
  

  cls.prototype.getGeopositionAsync = function getGeopositionAsync(callback) {
    /// <signature>
    /// <summary>Function summary.</summary>
    /// </signature>
  }

cls.prototype.getGeopositionAsync = function getGeopositionAsync(maximumAge, timeout, callback) {
    /// <signature>
    /// <summary>Function summary.</summary>
    /// <param name="maximumAge" type="Number">A param.</param>
    /// <param name="timeout" type="Number">A param.</param>
    /// </signature>
  }


    cls.prototype.addListener = function addListener(eventName, callback){}
    cls.prototype.removeListener = function removeListener(eventName, callback){}
    cls.prototype.on = function on(eventName, callback){}
    cls.prototype.off = function off(eventName, callback){}
  return cls;
}) ();
exports.Geolocator = Geolocator;

Geocircle = (function () {
  var cls = function Geocircle() {
    this.center = new BasicGeoposition();
    this.radius = new Number();
    this.altitudeReferenceSystem = new AltitudeReferenceSystem();
    this.geoshapeType = new GeoshapeType();
    this.spatialReferenceId = new Number();
  };
  
var cls = function Geocircle(position, radius) {
      this.center = new BasicGeoposition();
      this.radius = new Number();
      this.altitudeReferenceSystem = new AltitudeReferenceSystem();
      this.geoshapeType = new GeoshapeType();
      this.spatialReferenceId = new Number();
};

var cls = function Geocircle(position, radius, altitudeReferenceSystem) {
      this.center = new BasicGeoposition();
      this.radius = new Number();
      this.altitudeReferenceSystem = new AltitudeReferenceSystem();
      this.geoshapeType = new GeoshapeType();
      this.spatialReferenceId = new Number();
};

var cls = function Geocircle(position, radius, altitudeReferenceSystem, spatialReferenceId) {
      this.center = new BasicGeoposition();
      this.radius = new Number();
      this.altitudeReferenceSystem = new AltitudeReferenceSystem();
      this.geoshapeType = new GeoshapeType();
      this.spatialReferenceId = new Number();
};


  return cls;
}) ();
exports.Geocircle = Geocircle;

