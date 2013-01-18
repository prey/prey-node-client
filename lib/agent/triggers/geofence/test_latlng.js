var LatLon = require('./lib/latlng'),
	logger = require('./../../../common').logger;;

function calculateDistance(latlng1, latlng2){

	var p1 = new LatLon(latlng1[0], latlng1[1]);
	var p2 = new LatLon(latlng2[0], latlng2[1]);
	var dist = p1.distanceTo(p2);

	logger.info(p1);
	logger.info(p2);
	logger.info(dist);

}

calculateDistance([51.5136, -0.0983], [51.4778, -0.0015]);
calculateDistance([-33.4240, -70.6090], [-33.4236, -70.6067]); 
