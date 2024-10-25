import React, { useState, useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import styles from "./App.module.css";
import {
  getRoutes,
  getAllSegments,
  getBuses,
  getStops,
  getSchedule,
} from "./ApiFunctions.js";
import {
  createGeoLocElement,
  createBusElement,
  createBusStopElement,
  rotateThis,
  moveAnimation,
} from "./animationHelper.js";
import PopUpMap from "./popUpMap.jsx";
import Sidebar from "./Sidebar.jsx";
import cx from "classnames";
import * as turf from "@turf/turf";
import duplicates from "./combineStop.json";
function App() {
  /*********************   State/Ref Declaration *********************************/
  //viewport state
  const [viewport, setViewport] = useState({
    lat: 38.0336,
    long: -78.508,
    zoom: 12,
  });
  const [geoLocMarker, setGeoLocMarker] = useState({ marker: null });
  const [geoLocCoord, setGeoLocCoord] = useState({});
  const [heading, setHeading] = useState(null);
  const [prevBound, setPrevBound] = useState(null);
  //api data storage states
  const [agencyList, setAgencyList] = useState([]);
  const [routeList, setRouteList] = useState({});
  const [busStops, setBusStops] = useState(new Map());
  const [busMap, setBusMap] = useState(new Map());
  const [arrivals, setArrivals] = useState(new Map());
  const [schedules, setSchedules] = useState({});
  //bus marker storage state
  const [busMarkers, setBusMarkers] = useState({ markers: new Map() });
  /******user input settings*****************************************************/
  const [geoLocSetting, setGeoLocSetting] = useState(false);
  const [routeSetting, setRouteSetting] = useState({ routes: new Map() });
  const [sidebarSetting, setSidebarSetting] = useState({
    state: 2,
    stopID: null,
    marker: null,
  });

  //for sidebar open/close animation
  const [sidebarPosition, setSidebarPosition] = useState({
    active: false,
    marker: null,
  });
  const [popUpSetting, setPopUpSetting] = useState({
    active: false,
    stopID: null,
    marker: null,
  });
  const [favorites, setFavorites] = useState({});
  /****************************************************************************/
  //app refs
  const mapContainer = useRef(null);
  const map = useRef(null);
  const popUpMap = useRef(null);
  const sidebar = useRef(null);
  /*****************************************************************************/
  /********************** Map Initiator ****************************************/
  //create map on first render
  useEffect(() => {
    if (map.current) return;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      center: [viewport.long, viewport.lat],
      zoom: viewport.zoom,
      /*  maxBounds: [
        [-79.30649038019007, 37.07593093665458],
        [-77.77970744982255, 38.507663235091985],
      ],*/
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      attributionControl: false,
    }).addControl(
      new maplibregl.AttributionControl({
        compact: true,
        collapsed: true,
      }),
      "bottom-left"
    );
    setPrevBound(map.current.getBounds());
    //disable 3d tilt
    map.current.touchPitch.disable();
    //viewport set on move
    map.current.on("move", () => {
      const newLong = map.current.getCenter().lng.toFixed(4);
      const newLat = map.current.getCenter().lat.toFixed(4);
      const newZoom = map.current.getZoom().toFixed(2);
      setViewport({ lat: newLat, long: newLong, zoom: newZoom });
    });
    //get fetch favorites stored in browser memory
    if (localStorage.getItem("favorites")) {
      setFavorites(JSON.parse(localStorage.getItem("favorites")));
    }
    setAgencyList([
      {
        long_name: "University of Virginia",
        name: "uva",
        short_name: "UVA",
        agency_id: "347",
      },
    ]);
    //fetch and set CAT Schedule
    getSchedule().then((scheduleDic) => {
      setSchedules(scheduleDic);
    });
  }, []);

  //map stop click
  useEffect(() => {
    if (sidebarSetting.marker !== null) {
      stopFilter(false);
    }
    const onClick = (e) => {
      //bbox for increasing click tolerance by 5px
      const bbox = [
        [e.point.x - 10, e.point.y - 10],
        [e.point.x + 10, e.point.y + 10],
      ];
      // Find features intersecting the bounding box.
      if (map.current.getSource("stops")) {
        const selectedFeatures = map.current.queryRenderedFeatures(bbox, {
          layers: ["stops"],
        });
        if (
          selectedFeatures &&
          selectedFeatures.length > 0 &&
          selectedFeatures[0].layer.paint["circle-opacity"] === 1
        ) {
          map.current.flyTo({
            center: selectedFeatures[0].geometry.coordinates,
            padding: { bottom: 250 },
            duration: 200,
          });
          if (sidebarSetting.marker !== null) {
            sidebarSetting.marker.remove();
          }
          const el = createBusStopElement();
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat(selectedFeatures[0].geometry.coordinates)
            .addTo(map.current);
          setSidebarSetting({
            state: 3,
            stopID: selectedFeatures[0].properties.stopID,
            marker: marker,
          });
          setSidebarPosition({ active: true, stopClick: true });
        }
      }
    };
    map.current.on("click", onClick);
    return () => {
      map.current.off("click", onClick);
    };
  }, [sidebarSetting]);
  /********************** User location tracking ************************/
  useEffect(() => {
    if (!geoLocSetting) return;
    let id;
    // if geolocation is supported by the users browser
    if (navigator.geolocation) {
      function success(position) {
        // get geolocation positions
        let { latitude, longitude } = position.coords;
        setGeoLocCoord({
          lng: longitude,
          lat: latitude,
        });
      }
      function error(error) {
        //console.error("Error getting user location:", error);
      }
      // get the current users location
      id = navigator.geolocation.watchPosition(success, error, {
        maximumAge: 30000,
        timeout: 100,
        enableHighAccuracy: true,
      });
    }
    // if geolocation is not supported by the users browser
    else {
      console.error("Geolocation is not supported by this browser.");
    }

    return () => {
      setGeoLocCoord({});
      navigator.geolocation.clearWatch(id);
      window.removeEventListener("deviceorientation", configureHeading);
    };
  }, [geoLocSetting]);
  useEffect(() => {
    if (!geoLocSetting) {
      //geoloc setting is disabled but marker still remains-remove marker
      if (geoLocMarker.marker && Object.keys(geoLocCoord).length === 0) {
        geoLocMarker.marker.remove();
        setGeoLocMarker({ marker: null });
      }
      return;
    }
    //check geoloc Marker already exists
    if (geoLocMarker.marker) {
      //check coordinates are valid
      if (geoLocCoord.lat) {
        //update marker coordinates and heading
        geoLocMarker.marker.setLngLat([geoLocCoord.lng, geoLocCoord.lat]);
        //get the arrow and set angle
        if (heading) {
          geoLocMarker.marker.getElement().firstChild.children[1].style.transform =
            "rotate(" + heading + "deg) translateY(-13px)";
        }
      }
    } else {
      //check coordinates are valid
      if (geoLocCoord.lat) {
        //create user marker and set map center
        const el = createGeoLocElement(heading);
        const marker = new maplibregl.Marker({
          element: el,
          rotationAlignment: "map",
        })
          .setLngLat([geoLocCoord.lng, geoLocCoord.lat])
          .addTo(map.current);
        if (sidebarPosition.active) {
          map.current.flyTo({
            center: [geoLocCoord.lng, geoLocCoord.lat],
            padding: { bottom: 400 },
            duration: 0,
          });
        } else {
          map.current.flyTo({
            center: [geoLocCoord.lng, geoLocCoord.lat],
            padding: { bottom: 100 },
            duration: 0,
          });
        }
        setGeoLocMarker({ marker: marker });
      }
    }
  }, [geoLocCoord, heading]);
  function configureHeading(e) {
    setHeading(e.webkitCompassHeading || Math.abs(e.alpha - 360));
  }
  //enable geoLocation tracking
  function enableGeo() {
    if (!geoLocSetting) {
      //mobile checker using regex
      const mobileCheck = function () {
        let check = false;
        (function (a) {
          if (
            /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(
              a
            ) ||
            /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
              a.substr(0, 4)
            )
          )
            check = true;
        })(navigator.userAgent || window.opera);
        return check;
      };
      //only activate gyroscope sensor on mobile
      //is working but commented out for now
      //users would have to accept request twice(location/orientation)
      //need to do polling of users
      /*
      if (mobileCheck() && window.DeviceOrientationEvent) {
        var isIOS = (function () {
          var iosQuirkPresent = function () {
            var audio = new Audio();

            audio.volume = 0.5;
            return audio.volume === 1; // volume cannot be changed from "1" on iOS 12 and below
          };

          var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          var isAppleDevice = navigator.userAgent.includes("Macintosh");
          var isTouchScreen = navigator.maxTouchPoints >= 1; // true for iOS 13 (and hopefully beyond)

          return (
            isIOS || (isAppleDevice && (isTouchScreen || iosQuirkPresent()))
          );
        })();
        //event listeners for device orientation to get heading
        if (isIOS) {
          DeviceOrientationEvent.requestPermission()
            .then((response) => {
              if (response === "granted") {
                window.addEventListener(
                  "deviceorientation",
                  configureHeading,
                  true
                );
              }
            })
            .catch(() => alert("not supported"));
        } else {
          //android chromium
          window.addEventListener(
            "deviceorientationabsolute",
            configureHeading,
            true
          );
        }
      }*/
      //start gps tracking for devices
      setGeoLocSetting(true);
    } else {
      //check if coord are valid
      if (geoLocCoord.lng) {
        map.current.flyTo({
          center: [geoLocCoord.lng, geoLocCoord.lat],
          duration: 0,
        });
      }
    }
  }
  function disableGeo() {
    setGeoLocSetting(false);
  }
  /**********************************************************************/
  /**********Configure stationary data & draw layers in mapbox **********/
  useEffect(() => {
    /*This agency useEffect is an old remnant before I realized the transloc api
    is rate limited by api key, so I had to limit it to only uva agency. Thus,
    the agencyList is not required anymore, it just triggers the siebarSetting
    and route/stop config. I am still keeping this code instead of deleting just
    in case I use it later on.*/
    function getBoundDistance() {
      const bound = map.current.getBounds();
      var travelLine = turf.lineString([
        [bound._ne.lng, bound._ne.lat],
        [bound._sw.lng, bound._sw.lat],
      ]);
      return Number(turf.length(travelLine, { units: "miles" })).toFixed(1);
    }
    if (agencyList === null) return;
    if (agencyList.length > 0) {
      setSidebarSetting({ ...sidebarSetting, state: 2 });
      configureRoutes();
      configureStops();
    } else {
      //remove everything
      setRouteList([]);
      setBusStops(new Map());
      setBusMap(new Map());
      setArrivals(new Map());
      setSidebarSetting({
        ...sidebarSetting,
        state: 1,
        distance: getBoundDistance(),
      });
    }
    return () => {
      if (map.current.getLayer("routes")) {
        //route removal
        map.current.removeLayer("routes");
        map.current.removeSource("routes");
        popUpMap.current.getMap().removeLayer("routes");
        popUpMap.current.getMap().removeSource("routes");
      }
      if (map.current.getLayer("stops")) {
        //stop removal
        map.current.removeLayer("stops_shadow");
        map.current.removeLayer("stops");
        map.current.removeSource("stops");
        popUpMap.current.getMap().removeLayer("stops_shadow");
        popUpMap.current.getMap().removeLayer("stops");
        popUpMap.current.getMap().removeSource("stops");
      }
      //deleting every busMarker if it exists
      busMarkers.markers.forEach((busItem, vehicleID) => {
        busItem.marker.remove();
      });
      setBusMarkers({ markers: new Map() });
    };
  }, [agencyList]);
  //routes fetcher
  function configureRoutes() {
    function getBounds(routeCoordinates) {
      //shorten by half for faster bound calculation
      routeCoordinates = routeCoordinates.filter(
        (route, index) => index % 2 === 0
      );
      //calculate the bounds of the specific route
      return routeCoordinates.reduce(function (bounds, coord) {
        return bounds.extend(coord);
      }, new maplibregl.LngLatBounds(routeCoordinates[0], routeCoordinates[0]));
    }
    //grab routes and segments from api at the same time
    Promise.all([getRoutes(), getAllSegments()]).then((results) => {
      //store results
      const routes = results[0];
      const segments = results[1];
      if (routes) {
        /*************TRANSLOC SECTION***************** */
        //for storing routes
        const translocRouteList = [];
        //for creating default setting
        const routeConfig = new Map();
        let num = 0; //for setting active on routes
        //limit set for active routes:8 including favorited routes
        const limit = 8 - Object.keys(favorites).length;
        routes.transloc_routes.map((route) => {
          if (route.segments !== null && route.segments.length > 0) {
            let routeCoordinates = []; //for calculating bounds
            const routeSegments = route.segments.map((segment) => {
              //grab segment in feature object from map
              const decodedSegment = segments.transloc_segments[segment[0]];
              //add coordinates from feature
              routeCoordinates.push(...decodedSegment.geometry.coordinates);
              //add more info about the route within the map feature for drawing
              return {
                ...decodedSegment,
                properties: {
                  color: route.color,
                  routes: [route.route_id],
                },
              };
            });
            //calculate route bounds
            const bounds = getBounds(routeCoordinates);
            //place processed route for storage
            translocRouteList.push({
              ...route,
              segmentFeature: routeSegments,
              agencyName: "University of Virginia",
              bounds: bounds,
            });
            routeConfig.set(route.route_id, {
              route_id: route.route_id,
              active: favorites[route.route_id] || num < limit, //set Active on routes
              popUp: false, //no routes are on popUp yet
              color: route.color,
            });
            //don't increase count if it was not in favorites
            if (!favorites[route.route_id]) {
              num++;
            }
          }
        });
        /************************************************/
        /******************CAT SECTION*******************/
        const catRouteList = [];
        //save the CAT routes
        routes.cat_routes.map((route) => {
          const routeSegments = segments.cat_segments[route.route_id];
          const routeCoordinates = [];
          routeSegments.map((segment) => {
            routeCoordinates.push(...segment.geometry.coordinates);
          });
          //calculate route bounds
          const bounds = getBounds(routeCoordinates);
          catRouteList.push({
            ...route,
            bounds: bounds,
            agencyName: "Charlottesville Area Transit",
            segmentFeature: routeSegments,
          });
          routeConfig.set(route.route_id, {
            route_id: route.route_id,
            active: favorites[route.route_id] || num < limit, //set Active on routes
            popUp: false,
            color: route.color,
          });
          //don't increase count if it was not in favorites
          if (!favorites[route.route_id]) {
            num++;
          }
        });
        /*******************************************/
        //save all route data in state
        setRouteList({ transloc: translocRouteList, cat: catRouteList });
        //save route settings in state
        setRouteSetting({ routes: routeConfig });
        //place layer in map
        configureRouteLayer(translocRouteList.concat(catRouteList));
        //open sidebar
        setSidebarPosition({ active: true });
      }
    });
  }
  function configureStops() {
    //fetch stops
    getStops().then((result) => {
      let stopMap = new Map();
      /*****************TRANSLOC SECTION*********************/
      const stops = result.transloc_stops;
      //turn list into maplibre features
      stops.map((stop) => {
        //store stop data
        stopMap.set(stop.stop_id, {
          name: stop.name,
          routes: stop.routes,
          stop_id: stop.stop_id,
          coordinates: [stop.location.lng, stop.location.lat],
        });
      });
      /*******************CAT SECTION**********************/
      //push CAT stops into them and combine stops with transloc if needed
      const CATStops = result.cat_stops;
      CATStops.map((CATStop) => {
        const stopID = duplicates[CATStop.stop_id]
          ? duplicates[CATStop.stop_id]
          : CATStop.stop_id;
        if (stopMap.has(stopID)) {
          stopMap.get(stopID).routes.push(CATStop.route_id);
        } else {
          stopMap.set(stopID, {
            name: CATStop.name,
            routes: [CATStop.route_id],
            stop_id: stopID,
            coordinates: CATStop.coordinates,
          });
        }
      });
      //push the stops into features
      const stopFeatureList = [];
      stopMap.forEach((stop, stopID) => {
        stopFeatureList.push({
          type: "Feature",
          properties: {
            stopID: stop.stop_id,
            routes: stop.routes,
          },
          geometry: {
            type: "Point",
            coordinates: stop.coordinates,
          },
        });
      });
      //store all stop data in state
      setBusStops(stopMap);
      //place layer in map
      configureStopLayer(stopFeatureList);
    });
  }
  //painter method - Route
  function configureRouteLayer(routeList) {
    const routeSegmentList = [];
    routeList.map((route) => routeSegmentList.push(...route.segmentFeature));
    //places route layer in map and popUp map
    if (!map.current.getSource("routes")) {
      map.current.addSource("routes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: routeSegmentList },
      });
      map.current.addLayer(
        {
          id: "routes",
          type: "line",
          source: "routes",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": ["get", "color"],
            "line-width": 3,
          },
        },
        "watername_ocean" //putting above this symbol layer(specific to applied style) for removing glitches
      );
      popUpMap.current.getMap().addSource("routes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: routeSegmentList },
      });
      popUpMap.current.getMap().addLayer(
        {
          id: "routes",
          type: "line",
          source: "routes",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": ["get", "color"],
            "line-width": 3,
          },
        },
        "watername_ocean"
      );
    }
  }
  //painter method- Stops
  function configureStopLayer(stopList) {
    //place stop layer in map and popUp map
    if (!map.current.getSource("stops")) {
      map.current.addSource("stops", {
        type: "geojson",
        data: { type: "FeatureCollection", features: stopList },
      });
      popUpMap.current.getMap().addSource("stops", {
        type: "geojson",
        data: { type: "FeatureCollection", features: stopList },
      });
      map.current.addLayer({
        id: "stops_shadow",
        type: "circle",
        source: "stops",
        paint: {
          "circle-radius": 6.5,
          "circle-opacity": 0,
          "circle-stroke-color": "black",
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0,
          "circle-stroke-opacity-transition": { duration: 500 }, //transition for zoom
        },
      });
      map.current.addLayer({
        id: "stops",
        type: "circle",
        source: "stops",
        paint: {
          "circle-radius": 4,
          "circle-color": "black",
          "circle-opacity": 0,
          "circle-opacity-transition": { duration: 500 }, //transition for zoom
          "circle-stroke-color": "white",
          "circle-stroke-width": 2.5,
          "circle-stroke-opacity": 0,
          "circle-stroke-opacity-transition": { duration: 500 }, //transition for zoom
        },
      });
      popUpMap.current.getMap().addLayer({
        id: "stops_shadow",
        type: "circle",
        source: "stops",
        paint: {
          "circle-radius": 6.5,
          "circle-opacity": 0,
          "circle-stroke-color": "black",
          "circle-stroke-width": 1,
          "circle-stroke-opacity": 0,
          "circle-stroke-opacity-transition": { duration: 500 }, //transition for zoom
        },
      });
      popUpMap.current.getMap().addLayer({
        id: "stops",
        type: "circle",
        source: "stops",
        paint: {
          "circle-radius": 4,
          "circle-color": "black",
          "circle-opacity": 0,
          "circle-opacity-transition": { duration: 500 }, //transition for zoom
          "circle-stroke-color": "white",
          "circle-stroke-width": 2.5,
          "circle-stroke-opacity": 0,
          "circle-stroke-opacity-transition": { duration: 500 }, //transition for zoom
        },
      });
    }
  }
  //stops/stop_shadow layer fade animation
  useEffect(() => {
    if (map.current.getSource("stops")) {
      if (viewport.zoom > 12) {
        map.current.setPaintProperty("stops", "circle-opacity", 1);
        map.current.setPaintProperty("stops", "circle-stroke-opacity", 1);
        map.current.setPaintProperty(
          "stops_shadow",
          "circle-stroke-opacity",
          0.1
        );
      } else {
        map.current.setPaintProperty("stops", "circle-opacity", 0);
        map.current.setPaintProperty("stops", "circle-stroke-opacity", 0);
        map.current.setPaintProperty(
          "stops_shadow",
          "circle-stroke-opacity",
          0
        );
      }
    }
  }, [viewport.zoom]);
  /*****************************************************************************/
  /**************************Route/stops filtering******************************/
  function routeFilter() {
    if (map.current.getSource("routes")) {
      let tagFilters = [];
      const allRoutes = routeList.transloc.concat(routeList.cat);
      allRoutes.map((route) => {
        //show only active routes
        if (routeSetting.routes.get(route.route_id).active)
          tagFilters.push(["in", route.route_id, ["get", "routes"]]);
      });
      tagFilters = ["any"].concat(tagFilters);
      map.current.setFilter("routes", tagFilters);
    }
  }
  function stopFilter(ignoreStop) {
    //check if layer exists
    if (map.current.getSource("stops")) {
      let tagFilters = [];
      const allRoutes = routeList.transloc.concat(routeList.cat);
      allRoutes.map((route) => {
        //show only active routes
        if (routeSetting.routes.get(route.route_id).active)
          tagFilters.push(["in", route.route_id, ["get", "routes"]]);
      });
      tagFilters = ["any"].concat(tagFilters);
      if (ignoreStop) {
        map.current.setFilter("stops", tagFilters);
        map.current.setFilter("stops_shadow", tagFilters);
      } else {
        let stopFilters = [...tagFilters];
        //filter out the selected stop to make space for custom marker
        if (sidebarSetting.marker !== null) {
          stopFilters = [
            "all",
            stopFilters,
            ["!=", sidebarSetting.stopID, ["get", "stopID"]],
          ];
        }
        map.current.setFilter("stops", stopFilters);
        map.current.setFilter("stops_shadow", stopFilters);
      }
    }
  }
  /*****************************************************************************/

  /**************************Bus/Arrival fetching******************************/
  //update route/stop filtering by checking active state
  useEffect(() => {
    //converting fetched bus array into map
    function storeBuses(result) {
      const busMap = new Map();
      const arrivalMap = new Map();
      /****************** Transloc Section *********************/
      result.transloc_vehicles.map((bus) => {
        const routeInfo = routeSetting.routes.get(bus.route_id);
        if (bus.location[0] && routeInfo) {
          //add color to transloc buses
          const toStore = {
            ...bus,
            color: routeInfo.color,
          };
          if (!busMap.has(bus.route_id)) {
            busMap.set(bus.route_id, [toStore]);
          } else {
            busMap.get(bus.route_id).push(toStore);
          }
          //arrivals
          bus.arrival_estimates.map((arrival) => {
            //store estimates as remaining min
            const toStore = {
              call_name: bus.call_name,
              remaining: Math.floor(
                (new Date(arrival.arrival_at) - new Date()) / 60000
              ),
            };
            if (arrivalMap.has(arrival.route_id)) {
              const arrivalRoute = arrivalMap.get(arrival.route_id);
              if (arrivalRoute.has(arrival.stop_id)) {
                arrivalRoute.get(arrival.stop_id).push(toStore);
              } else {
                arrivalRoute.set(arrival.stop_id, [toStore]);
              }
            } else {
              const arrivalStop = new Map();
              arrivalStop.set(arrival.stop_id, [toStore]);
              arrivalMap.set(arrival.route_id, arrivalStop);
            }
          });
        }
      });
      /*****************************************************/
      /******************* CAT Section *********************/
      result.cat_vehicles.map((bus) => {
        const routeInfo = routeSetting.routes.get(bus.route_id);
        if (bus.location[0] && routeInfo) {
          //add color to transloc buses
          const toStore = {
            ...bus,
            color: routeInfo.color,
          };
          if (!busMap.has(bus.route_id)) {
            busMap.set(bus.route_id, [toStore]);
          } else {
            busMap.get(bus.route_id).push(toStore);
          }
          //arrivals
          bus.minutesToNextStops.map((arrival) => {
            //store estimates as remaining min
            const toStore = {
              call_name: arrival.equipmentID,
              remaining: arrival.minutes,
            };
            //convert duplicates to transloc stops
            const stop_id = duplicates[String(arrival.stopID)]
              ? duplicates[String(arrival.stopID)]
              : String(arrival.stopID);
            if (arrivalMap.has(bus.route_id)) {
              const arrivalRoute = arrivalMap.get(bus.route_id);
              if (arrivalRoute.has(stop_id)) {
                arrivalRoute.get(stop_id).push(toStore);
              } else {
                arrivalRoute.set(stop_id, [toStore]);
              }
            } else {
              const arrivalStop = new Map();
              arrivalStop.set(stop_id, [toStore]);
              arrivalMap.set(bus.route_id, arrivalStop);
            }
          });
        }
      });
      /*****************************************************/
      setBusMap(busMap);
      setArrivals(arrivalMap);
    }
    if (Object.keys(routeList).length === 0) return;
    //update bus markers every 5 seconds
    getBuses().then((result) => {
      storeBuses(result);
    });
    const busInterval = setInterval(() => {
      getBuses().then((result) => {
        storeBuses(result);
      });
    }, 5000);

    return () => {
      clearInterval(busInterval);
    };
  }, [routeList]);
  useEffect(() => {
    //main code lines for use effect
    if (Object.keys(routeList).length === 0) return;
    //place or move busMarkers
    prepareBusMarkers(filterBus());
    routeFilter();
    stopFilter(false);
    //end of main code

    //helper functions for main code below

    //filter only buses from active or popUp routes
    function filterBus() {
      const busArray = [];
      const allRoutes = routeList.transloc.concat(routeList.cat);
      allRoutes.map((route) => {
        if (busMap.has(route.route_id)) {
          const setting = routeSetting.routes.get(route.route_id);
          //add buses in active routes
          if (setting.active) {
            busArray.push(
              ...busMap.get(route.route_id).map((bus) => {
                return { ...bus, forPopUp: false };
              })
            );
          }
          //add extra buses for popUp to popUp
          if (setting.popUp) {
            busArray.push(
              ...busMap.get(route.route_id).map((bus) => {
                return { ...bus, forPopUp: true };
              })
            );
          }
        }
      });
      return busArray;
    }
    //draw busMarkers in map or update their locations
    function prepareBusMarkers(buses) {
      //convert api heading variable to correct angle
      let toCorrectAngle = (angle) => (angle + 180) % 360;
      // busMarker helper functions
      let addBusMarker = (id, busItem) => {
        setBusMarkers(() => {
          busMarkers.markers.set(id, busItem);
          return { markers: busMarkers.markers };
        });
      };
      let deleteBusMarker = (id) => {
        setBusMarkers(() => {
          busMarkers.markers.delete(id);
          return { markers: busMarkers.markers };
        });
      };

      //deleting unused busMarkers before animating
      busMarkers.markers.forEach((busItem, vehicleID) => {
        for (let i = 0; i < buses.length; i++) {
          const busID = buses[i].forPopUp
            ? buses[i].vehicle_id + "pop"
            : buses[i].vehicle_id;
          if (vehicleID === busID) {
            return;
          }
        }
        busItem.marker.remove();
        deleteBusMarker(vehicleID);
      });

      //creating or animating buses
      buses.map((bus) => {
        const busID = bus.forPopUp ? bus.vehicle_id + "pop" : bus.vehicle_id;
        if (!busMarkers.markers.has(busID)) {
          //create bus element
          const el = createBusElement(bus.color, toCorrectAngle(bus.heading));
          let marker;
          /*
            2 cases of marker creation:
            1. First App Load or Refresh(All markers are recreated) 
               OR API inserts a new bus within route
            2. Inactive route activated as PopUp-
               controlled by forPopUp below
          */
          if (!bus.forPopUp) {
            marker = new maplibregl.Marker({
              element: el,
              rotationAlignment: "map",
            })
              .setLngLat(bus.location)
              .addTo(map.current);
          } else {
            marker = new maplibregl.Marker({ element: el })
              .setLngLat(bus.location)
              .addTo(popUpMap.current.getMap());
          }
          //store marker,angle,and location
          addBusMarker(busID, {
            marker: marker,
            angle: toCorrectAngle(bus.heading),
            loc: bus.location,
            prevLoc: null,
          });
        } else {
          //grab the specific marker and info
          const busInfo = busMarkers.markers.get(busID);
          //rotate to appropriate angle
          const newAngle = rotateThis(
            busInfo.marker.getElement().firstChild,
            toCorrectAngle(bus.heading),
            busInfo.angle
          );
          addBusMarker(busID, {
            marker: busInfo.marker,
            angle: newAngle,
            loc: bus.location,
            prevLoc: busInfo.loc,
          });
        }
      });
    }
  }, [routeSetting, busMap]);
  /*****************************************************************************/

  /*********************  Bus location/angle animation updater******************/

  //this effect is used for getting rid of previous lagging bus movement
  useEffect(() => {
    if (busMarkers.markers.size === 0) {
      return;
    }
    const intervalIDArr = [];
    busMarkers.markers.forEach((busInfo, keys) => {
      moveAnimation(busInfo.marker, busInfo.prevLoc, busInfo.loc).then((id) => {
        if (id !== null) {
          intervalIDArr.push(id);
        }
      });
    });
    return () => {
      intervalIDArr.map((id) => {
        clearInterval(id);
      });
    };
  }, [busMarkers]);
  /*****************************************************************************/

  /************************** Sidebar Position effect **************************/
  useEffect(() => {
    function mapMoveEvent(e) {
      //detect move by user and set sidebar to close if it is open
      //might need  e.originalEvent.type === "touchmove" && in the future
      if (e.originalEvent && sidebarPosition.active) {
        setSidebarPosition({
          active: false,
          mapMove: true,
        });
      }
    }
    map.current.on("move", mapMoveEvent); //apply event
    const target = sidebar.current.getContainer();
    //set final height depending on current state
    const maxHeight = document.body.clientHeight > 700 ? 300 : 240;
    const height = sidebarPosition.active ? maxHeight : 0;
    const difference = height - target.clientHeight;
    function easing(t) {
      return t * (2 - t);
    }
    //update attribution height based on sidebarContainer
    function updateAttributionMargin() {
      const target = sidebar.current.getContainer();
      const attributionSection = document.querySelector(
        ".maplibregl-ctrl-bottom-left"
      );
      const titleHeight = target.parentElement.children[2].clientHeight;
      attributionSection.style.marginBottom =
        target.clientHeight + titleHeight + "px";
    }
    //animate attribution margin along with sidebar
    let marginInterval = setInterval(() => {
      updateAttributionMargin();
    }, 20);

    //create the animation on sidebar
    let animation = target.animate(
      [{ height: target.clientHeight + "px" }, { height: height + "px" }],
      {
        duration: 200,
        iterations: 1,
        fill: "forwards",
      }
    );
    //on finish cancel animation to remove forward fill and set height
    animation.onfinish = function () {
      animation.cancel();
      //end updating interval
      clearInterval(marginInterval);
      target.style.height = height + "px";
      //update margin for the last time
      updateAttributionMargin();
    };
    //move map along with sidebar animation only if user slided up/down sidebar
    if (!sidebarPosition.mapMove && !sidebarPosition.stopClick) {
      map.current.panBy([0, difference / 2], {
        duration: 200,
        easing,
      });
    }
    return () => {
      map.current.off("move", mapMoveEvent); //remove event
    };
  }, [sidebarPosition]);
  /*****************************************************************************/

  /********************* functions/data to be passed to sidebar ******************/
  //filter Routes to be used by sidebar
  function filterRoutes() {
    //route sorting function
    function compareRoutes(a, b) {
      if (favorites[a.route_id]) {
        return favorites[b.route_id] ? 0 : -1;
      } else {
        return favorites[b.route_id] ? 1 : 0;
      }
    }
    if (Object.keys(routeList).length === 0) return [];
    const allRoutes = routeList.transloc.concat(routeList.cat);
    //attach active tag for css
    let processedRouteList = allRoutes.map((route, i) => {
      return {
        ...route,
        active: routeSetting.routes.get(route.route_id).active,
        favorite: favorites[route.route_id],
      };
    });
    //sort for favorites
    processedRouteList = processedRouteList.sort(compareRoutes);
    if (sidebarSetting.stopID === null) return processedRouteList;
    const stop = busStops.get(sidebarSetting.stopID);
    //filter to only have stop's routes
    const filteredRoute = processedRouteList.filter((route) => {
      for (let i = 0; i < stop.routes.length; i++) {
        if (stop.routes[i] === route.route_id) return true;
      }
      return false;
    });
    //get arrival data for the stop if it exists
    return filteredRoute.map((route, i) => {
      if (arrivals.has(route.route_id)) {
        const arrivalRoute = arrivals.get(route.route_id);
        if (arrivalRoute.has(sidebarSetting.stopID)) {
          const sortedArrivals = arrivalRoute
            .get(sidebarSetting.stopID)
            .sort((a, b) => a.remaining - b.remaining);
          return {
            ...route,
            remaining: sortedArrivals[0].remaining,
          };
        }
      }
      return {
        ...route,
        remaining: null,
      };
    });
  }
  //onclick function for toggling route
  function toggleActive(route_id) {
    setRouteSetting(() => {
      const selected = routeSetting.routes.get(route_id);
      routeSetting.routes.set(route_id, {
        ...selected,
        active: !selected.active,
      });
      return { routes: routeSetting.routes };
    });
  }
  //onclick functions for passing route to popUp
  function routeClick(route_id) {
    const allRoutes = routeList.transloc.concat(routeList.cat);
    //get first stop of route
    function getFirstStop(route_id) {
      let id;
      //grab route's stops
      allRoutes.some((route) => {
        if (route.route_id === route_id) {
          id = String(route.stops[0]);
          return true;
        }
      });
      if (duplicates[id]) {
        id = duplicates[id];
      }
      return id;
    }
    //get closest stop using distance
    function getClosestStop(route_id) {
      let stops;
      //grab route's stops
      allRoutes.some((route) => {
        if (route.route_id === route_id) {
          stops = route.stops;
          return true;
        }
      });
      let minStopID = String(stops[0]);
      let minDistance = Infinity;
      const currentLoc = [geoLocCoord.lng, geoLocCoord.lat];
      //pick the closest stop
      stops.map((stopID) => {
        stopID = String(stopID);
        const translocID = duplicates[stopID];
        const correctID = translocID ? translocID : stopID;
        const stopInfo = busStops.get(correctID);
        const travelLine = turf.lineString([currentLoc, stopInfo.coordinates]);
        const distance = Number(turf.length(travelLine, { units: "miles" }));
        if (distance < minDistance) {
          minDistance = distance;
          minStopID = correctID;
        }
      });
      return minStopID;
    }

    //get a stop if there is no stopId prepared
    const stopID =
      sidebarSetting.stopID !== null
        ? sidebarSetting.stopID
        : geoLocSetting && geoLocCoord.lat
        ? getClosestStop(route_id)
        : getFirstStop(route_id);
    const coordinates = busStops.get(stopID).coordinates;
    //create stop marker for popUp and store for later deletion
    const marker = createBusStopMarker(coordinates);
    setPopUpSetting({
      active: true,
      haveStop: sidebarSetting.stopID !== null, //for fitting route vs specific stop
      routeID: route_id,
      stopID: stopID,
      marker: marker,
    });
    //set route popUp to active for buses to move
    setRouteSetting(() => {
      const selected = routeSetting.routes.get(route_id);
      routeSetting.routes.set(route_id, {
        ...selected,
        popUp: true,
      });
      return { routes: routeSetting.routes };
    });
  }
  function touchStart(e) {
    let target = sidebar.current.getContainer();
    //set offset to null to indicate touchStart
    target.offset = null;
  }
  function touchMove(e) {
    if (e.touches.length == 1) {
      //   e.preventDefault();
      let target = sidebar.current.getContainer();
      //if user started moving
      if (target.offset !== null) {
        const move = target.offset - e.touches[0].pageY;
        //move map up/down according to distance but by half
        map.current.panBy([0, move / 2], {
          duration: 1,
        });
        const maxHeight = document.body.clientHeight > 700 ? 300 : 240;
        const newHeight = Math.min(maxHeight, target.clientHeight + move);
        //set new height
        target.style.height = newHeight + "px";
        //set attribution margin;
        const attributionSection = document.querySelector(
          ".maplibregl-ctrl-bottom-left"
        );
        const titleHeight = target.parentElement.children[2].clientHeight;
        attributionSection.style.marginBottom = newHeight + titleHeight + "px";
      }
      //set new offset on current position
      target.offset = e.touches[0].pageY;
    }
  }
  function touchEnd(e) {
    //depending on ending position choose active state of sidebar
    let active = false;
    let target = sidebar.current.getContainer();
    if (!sidebarPosition.active) {
      if (target.clientHeight > 25) {
        active = true;
      }
    } else {
      if (target.clientHeight > 275) {
        active = true;
      }
    }
    setSidebarPosition({ active: active });
  }
  function clickOpen(e) {
    setSidebarPosition({ active: true });
  }
  /*****************************************************************************/

  /********************** functions for popUp **********************************/
  //create and add bus stop marker to popUp map
  function createBusStopMarker(coordinates) {
    const el = createBusStopElement();
    const marker = new maplibregl.Marker({ element: el })
      .setLngLat(coordinates)
      .addTo(popUpMap.current.getMap());
    return marker;
  }
  //onclick function for popup close button
  function closePopUp(route_id) {
    //remove popUp marker
    if (popUpSetting.marker !== null) {
      popUpSetting.marker.remove();
    }
    //deactivate popUp setting and route
    setPopUpSetting({ ...popUpSetting, active: false, marker: null });
    setRouteSetting(() => {
      const selected = routeSetting.routes.get(route_id);
      routeSetting.routes.set(route_id, {
        ...selected,
        popUp: false,
      });
      return { routes: routeSetting.routes };
    });
  }

  function popUpSetBusStop(feature) {
    //fly to stop
    popUpMap.current.getMap().flyTo({
      center: feature.geometry.coordinates,
    });
    //remove previous stop marker and set a new one
    if (popUpSetting.marker !== null) {
      popUpSetting.marker.remove();
    }
    const marker = createBusStopMarker(feature.geometry.coordinates);
    setPopUpSetting({
      ...popUpSetting,
      stopID: feature.properties.stopID,
      marker: marker,
    });
  }
  function toggleFavorite(route_id) {
    if (favorites[route_id]) {
      //if it was already in favorites
      //delete favorite and deactivate route
      setFavorites(() => {
        delete favorites[route_id];
        localStorage.setItem("favorites", JSON.stringify(favorites));
        return { ...favorites };
      });
      setRouteSetting(() => {
        const selected = routeSetting.routes.get(route_id);
        routeSetting.routes.set(route_id, {
          ...selected,
          active: false,
        });
        return { routes: routeSetting.routes };
      });
    } else {
      //add favorite and activate route
      setFavorites(() => {
        favorites[route_id] = true;
        localStorage.setItem("favorites", JSON.stringify(favorites));
        return { ...favorites };
      });
      setRouteSetting(() => {
        const selected = routeSetting.routes.get(route_id);
        routeSetting.routes.set(route_id, {
          ...selected,
          active: true,
        });
        return { routes: routeSetting.routes };
      });
    }
  }
  //when gps is on, display distance of device to selected stop
  function getDistance() {
    const travelLine = turf.lineString([
      [geoLocCoord.lng, geoLocCoord.lat],
      busStops.get(popUpSetting.stopID).coordinates,
    ]);
    const distance = Number(
      turf.length(travelLine, { units: "miles" })
    ).toFixed(0);
    return distance + " miles away";
  }
  function getRouteInfo() {
    const allRoutes = routeList.transloc.concat(routeList.cat);
    let routeInfo = null;
    //retrieve route info
    allRoutes.map((route, i) => {
      if (route.route_id === popUpSetting.routeID) {
        routeInfo = {
          ...route,
          active: routeSetting.routes.get(popUpSetting.routeID).active,
          favorite: favorites[popUpSetting.routeID],
        };
      }
    });
    return routeInfo;
  }
  function filterSchedules() {
    //time formatting functions ex: 9:30am to new Date() format
    const formatTime = (timeString) => {
      const d = new Date(),
        parts = timeString.match(/(\d+)\:(\d+)(\w+)/),
        hours = /am/i.test(parts[3])
          ? parseInt(parts[1], 10)
          : parseInt(parts[1], 10) == 12 //fix 12 with pm bug
          ? parseInt(parts[1], 10)
          : parseInt(parts[1], 10) + 12, //for all pm except 12
        minutes = parseInt(parts[2], 10);
      d.setHours(hours, minutes, 0, 0);
      return d;
    };
    //check if schedule for route exists
    if (schedules[popUpSetting.routeID]) {
      const stopSchedule = schedules[popUpSetting.routeID][popUpSetting.stopID];
      //check if stop schedule exists
      if (stopSchedule) {
        const currentTime = new Date();
        const duplicateTime = {};
        const filteredSchedule = stopSchedule.filter((schedule) => {
          const convertTime = formatTime(schedule.stopTime);
          if (convertTime - currentTime > 0) {
            if (!duplicateTime[convertTime]) {
              duplicateTime[convertTime] = true;
              return true;
            }
            return false;
          }
          return false;
        });
        return filteredSchedule;
      }
    }

    return null;
  }
  function getArrivals() {
    if (arrivals.has(popUpSetting.routeID)) {
      const arrivalRoute = arrivals.get(popUpSetting.routeID);
      if (arrivalRoute.has(popUpSetting.stopID))
        return arrivalRoute.get(popUpSetting.stopID);
    }
    return null;
  }
  /*****************************************************************************/

  /**************************map reset button functions ********************/
  //checking if center is outside prevBound- to be used for reset button opacity
  function movedOutOfBounds() {
    if (prevBound === null) return false;
    const isVerticalLeave = !(
      viewport.lat > prevBound._sw.lat && viewport.lat < prevBound._ne.lat
    );
    const isHorizontalLeave = !(
      viewport.long < prevBound._ne.lng && viewport.long > prevBound._sw.lng
    );
    //needs to be at certain zoom to trigger
    //had to be one of the leaves
    return (isVerticalLeave || isHorizontalLeave) && viewport.zoom > 12;
  }

  //function for checking what to reset based on results
  //current resetMap will only check for transloc route changes
  //such as number of routes or segment changes
  //Because CAT Routes segments don't change during the day.
  function resetMap() {
    function isRouteListSame(routes) {
      routes = routes.transloc_routes;
      //set routeList if more or less route to be added
      const filteredRoute = routes.filter((route) => route.is_active);
      if (filteredRoute.length !== routeList.transloc.length) return false;
      for (let i = 0; i < filteredRoute.length; i++) {
        //routes are fetched always in order so they should be the same
        //the only way in which they could be out of order is if they didn't
        //have segments which is also a valid reason why they should
        //fetch route anyways, so check if order matches
        if (filteredRoute[i].route_id !== routeList.transloc[i].route_id)
          return false;
        if (
          filteredRoute[i].segments.length !==
          routeList.transloc[i].segments.length
        )
          return false;
        //check if all segments matches or route segments have changed
        for (let j = 0; j < filteredRoute[i].segments.length; j++) {
          if (
            filteredRoute[i].segments[j][0] !==
            routeList.transloc[i].segments[j][0]
          )
            return false;
        }
      }
      return true;
    }
    //routes are updated, trigger update on routes
    getRoutes().then((routes) => {
      if (!isRouteListSame(routes)) {
        map.current.removeLayer("routes");
        map.current.removeSource("routes");
        popUpMap.current.getMap().removeLayer("routes");
        popUpMap.current.getMap().removeSource("routes");
        //deleting every busMarker if it exists
        busMarkers.markers.forEach((busItem, vehicleID) => {
          busItem.marker.remove();
        });
        setBusMarkers({ markers: new Map() });
        configureRoutes();
      }
    });
    //remove markers
    if (sidebarSetting.marker !== null) sidebarSetting.marker.remove();
    if (popUpSetting.marker !== null) popUpSetting.marker.remove();
    //readd previous stop feature by ignoring stop in stop filtering
    stopFilter(true);
    //reset all settings state
    setSidebarSetting({ state: 2, stopID: null, marker: null });
    setPopUpSetting({ active: false, stopID: null, marker: null });
    setSidebarPosition({ active: true });
    //set prevBound to currentBound
    setPrevBound(map.current.getBounds());
  }
  /*****************************************************************************/
  return (
    <>
      <div className={styles.appContainer}>
        <div
          className={cx(
            styles.resetButton,
            sidebarSetting.stopID !== null || movedOutOfBounds()
              ? styles.active
              : null
          )}
          onClick={resetMap}
        >
          <svg
            width="20px"
            height="20px"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21 3V8M21 8H16M21 8L18 5.29168C16.4077 3.86656 14.3051 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21C16.2832 21 19.8675 18.008 20.777 14"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Load routes in this area
        </div>
        <div ref={mapContainer} className={styles.mapContainer} />
        <Sidebar
          ref={sidebar}
          open={sidebarPosition.active}
          state={sidebarSetting.state}
          stop={
            sidebarSetting.stopID !== null
              ? busStops.get(sidebarSetting.stopID)
              : null
          }
          routes={filterRoutes()}
          geoLocState={!geoLocSetting ? 0 : !geoLocCoord.lat ? 1 : 2}
          distance={sidebarSetting.state === 1 ? sidebarSetting.distance : null}
          functions={{
            toggleActive: toggleActive,
            routeClick: routeClick,
            touchStart: touchStart,
            touchMove: touchMove,
            touchEnd: touchEnd,
            clickOpen: clickOpen,
            enableGeo: enableGeo,
            disableGeo: disableGeo,
          }}
        />
      </div>
      <PopUpMap
        active={popUpSetting.active}
        haveStop={popUpSetting.haveStop} //a boolean config for init zoom on route/stop
        routeInfo={popUpSetting.active ? getRouteInfo() : null} //route infos for popUp
        stop={popUpSetting.active ? busStops.get(popUpSetting.stopID) : null} //stop infos for popUp
        currLoc={
          popUpSetting.active && geoLocSetting && geoLocCoord.lat
            ? getDistance()
            : null
        } //how far away the stop is from your current location
        arrival={popUpSetting.active ? getArrivals() : null} //arrival info
        schedule={popUpSetting.active ? filterSchedules() : null} //schedule info
        ref={popUpMap}
        functions={{
          closePopUp: closePopUp,
          popUpSetBusStop: popUpSetBusStop,
          toggleFavorite: toggleFavorite,
        }}
      />
    </>
  );
}

export default App;
