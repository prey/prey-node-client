declare module "windows.devices.geolocation" {
  export class BasicGeoposition {
    latitude: Number;
    longitude: Number;
    altitude: Number;
    constructor();
  }

  export enum PositionAccuracy {
    default,
    high,
  }

  export enum PositionStatus {
    ready,
    initializing,
    noData,
    disabled,
    notInitialized,
    notAvailable,
  }

  export enum PositionSource {
    cellular,
    satellite,
    wiFi,
    iPAddress,
    unknown,
  }

  export enum GeoshapeType {
    geopoint,
    geocircle,
  }

  export enum AltitudeReferenceSystem {
    unspecified,
    terrain,
    ellipsoid,
    geoid,
    surface,
  }

  export class IGeoshape {
    altitudeReferenceSystem: AltitudeReferenceSystem;
    geoshapeType: GeoshapeType;
    spatialReferenceId: Number;
    constructor();

  }

  export class Geopoint {
    position: BasicGeoposition;
    altitudeReferenceSystem: AltitudeReferenceSystem;
    geoshapeType: GeoshapeType;
    spatialReferenceId: Number;
    constructor();
    constructor(position: BasicGeoposition);
    constructor(position: BasicGeoposition, altitudeReferenceSystem: AltitudeReferenceSystem);
    constructor(position: BasicGeoposition, altitudeReferenceSystem: AltitudeReferenceSystem, spatialReferenceId: Number);

  }

  export class GeocoordinateSatelliteData {
    horizontalDilutionOfPrecision: Number;
    positionDilutionOfPrecision: Number;
    verticalDilutionOfPrecision: Number;
    constructor();

  }

  export class Geocoordinate {
    accuracy: Number;
    altitude: Number;
    altitudeAccuracy: Number;
    heading: Number;
    latitude: Number;
    longitude: Number;
    speed: Number;
    timestamp: Date;
    positionSource: PositionSource;
    satelliteData: GeocoordinateSatelliteData;
    point: Geopoint;
    constructor();

  }

  export class CivicAddress {
    city: String;
    country: String;
    postalCode: String;
    state: String;
    timestamp: Date;
    constructor();

  }

  export class Geoposition {
    civicAddress: CivicAddress;
    coordinate: Geocoordinate;
    constructor();

  }

  export class PositionChangedEventArgs {
    position: Geoposition;
    constructor();

  }

  export class StatusChangedEventArgs {
    status: PositionStatus;
    constructor();

  }

  export class Geolocator {
    reportInterval: Number;
    movementThreshold: Number;
    desiredAccuracy: PositionAccuracy;
    locationStatus: PositionStatus;
    desiredAccuracyInMeters: Number;
    constructor();

    getGeopositionAsync(callback: (error: Error, result: Geoposition) => void): void ;
    getGeopositionAsync(maximumAge: Number, timeout: Number, callback: (error: Error, result: Geoposition) => void): void ;

    addListener(type: "PositionChanged", listener: (ev: Event) => void): void ;
    removeListener(type: "PositionChanged", listener: (ev: Event) => void): void ;
    on(type: "PositionChanged", listener: (ev: Event) => void): void ;
    off(type: "PositionChanged", listener: (ev: Event) => void): void ;
    
    addListener(type: "StatusChanged", listener: (ev: Event) => void): void ;
    removeListener(type: "StatusChanged", listener: (ev: Event) => void): void ;
    on(type: "StatusChanged", listener: (ev: Event) => void): void ;
    off(type: "StatusChanged", listener: (ev: Event) => void): void ;
    
    addListener(type: string, listener: (ev: Event) => void): void ;
    removeListener(type: string, listener: (ev: Event) => void): void ;
    on(type: string, listener: (ev: Event) => void): void ;
    off(type: string, listener: (ev: Event) => void): void ;
    

  }

  export class Geocircle {
    center: BasicGeoposition;
    radius: Number;
    altitudeReferenceSystem: AltitudeReferenceSystem;
    geoshapeType: GeoshapeType;
    spatialReferenceId: Number;
    constructor();
    constructor(position: BasicGeoposition, radius: Number);
    constructor(position: BasicGeoposition, radius: Number, altitudeReferenceSystem: AltitudeReferenceSystem);
    constructor(position: BasicGeoposition, radius: Number, altitudeReferenceSystem: AltitudeReferenceSystem, spatialReferenceId: Number);

  }

}



