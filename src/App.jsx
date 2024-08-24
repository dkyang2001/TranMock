import React, { useState, useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import styles from "./App.module.css";
import {
  getAgency,
  getRoutes,
  getAllSegments,
  getRouteSegments,
  getBuses,
  getCATBuses,
  getStops,
  getArrivalEstimates,
} from "./ApiFunctions.js";
import {
  createGeoLocElement,
  createBusElement,
  createBusStopElement,
  rotateThis,
  rotateGeoLoc,
  moveAnimation,
} from "./animationHelper.js";
import PopUpMap from "./popUpMap.jsx";
import Sidebar from "./Sidebar.jsx";
import cx from "classnames";
import * as turf from "@turf/turf";
import polyline from "@mapbox/polyline";
import data from "./CATRoutes.json";
import stopData from "./CATStops.json";
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
  const [heading, setHeading] = useState(0);
  const [prevBound, setPrevBound] = useState(null);
  //api data storage states
  const [agencyList, setAgencyList] = useState(null);
  const [routeList, setRouteList] = useState({});
  const [busStops, setBusStops] = useState(new Map());
  const [busMap, setBusMap] = useState(new Map());
  const [arrivals, setArrivals] = useState(new Map());
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
    //fetch agency
    getAgency(map.current.getBounds()).then((agencyList) =>
      setAgencyList(agencyList)
    );
    if (localStorage.getItem("favorites")) {
      setFavorites(JSON.parse(localStorage.getItem("favorites")));
    }
    if (window.DeviceOrientationEvent) {
      const isIOS = !(
        navigator.userAgent.match(/(iPod|iPhone|iPad)/) &&
        navigator.userAgent.match(/AppleWebKit/)
      );
      if (typeof DeviceOrientationEvent !== "function") {
        alert("DeviceOrientationEvent not detected");
      }
      DeviceOrientationEvent.requestPermission()
        .then((response) => {
          if (response === "granted") {
            window.addEventListener(
              "deviceorientation",
              (e) => {
                setHeading(e.webkitCompassHeading);
              },
              true
            );
          } else {
            alert("has to be allowed!");
          }
        })
        .catch(() => alert("not supported"));
    }
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
    // define the function that finds the users geolocation
    const getUserLocation = () => {
      // if geolocation is supported by the users browser
      if (navigator.geolocation) {
        function success(position) {
          // get geolocation positions
          let { latitude, longitude, heading } = position.coords;
          setGeoLocCoord({
            lng: longitude,
            lat: latitude,
          });
        }
        function error(error) {
          console.error("Error getting user location:", error);
        }
        // get the current users location
        navigator.geolocation.watchPosition(success, error, {
          maximumAge: 60000,
          timeout: 1000,
          enableHighAccuracy: true,
        });
      }
      // if geolocation is not supported by the users browser
      else {
        console.error("Geolocation is not supported by this browser.");
      }
    };
    getUserLocation();
    const id = setInterval(() => {
      getUserLocation();
    }, 1000);
    return () => {
      clearInterval(id);
      if (geoLocMarker.marker) {
        geoLocMarker.marker.remove();
        setGeoLocMarker({ marker: null });
        setGeoLocCoord({});
      }
    };
  }, [geoLocSetting]);
  useEffect(() => {
    if (!geoLocSetting) return;
    //convert heading variable to correct angle on screen
    let toCorrectAngle = (angle) => (angle + 180) % 360;
    //check geoloc Marker already exists
    if (geoLocMarker.marker) {
      //check coordinates are valid
      if (geoLocCoord.lat) {
        //filter out invalid heading to prev angle
        const angle = !heading
          ? geoLocMarker.prevAngle
          : toCorrectAngle(heading);
        //update marker coordinates and heading
        geoLocMarker.marker.setLngLat([geoLocCoord.lng, geoLocCoord.lat]);
        rotateGeoLoc(
          geoLocMarker.marker.getElement().firstChild.children[1],
          angle,
          geoLocMarker.prevAngle
        );
        setGeoLocMarker({ ...geoLocMarker, prevAngle: angle });
      }
    } else {
      //check coordinates are valid
      if (geoLocCoord.lat) {
        //filter out invalid heading to 0 degree
        const angle = !heading ? 0 : toCorrectAngle(heading);
        //create user marker and set map center
        const el = createGeoLocElement(angle);
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([geoLocCoord.lng, geoLocCoord.lat])
          .addTo(map.current);
        map.current.flyTo({
          center: [geoLocCoord.lng, geoLocCoord.lat],
          duration: 0,
        });
        setGeoLocMarker({ marker: marker, prevAngle: angle });
      }
    }
  }, [geoLocCoord, heading]);
  //enable geoLocation tracking
  function enableGeo() {
    if (!geoLocSetting) {
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
    if (geoLocSetting) {
      setGeoLocSetting(false);
    }
  }
  /**********************************************************************/
  /**********Configure stationary data & draw layers in mapbox **********/
  useEffect(() => {
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
    //getting corresponding agencyName from agencyList
    function getAgencyName(agencyID) {
      let result;
      agencyList.some((agency) => {
        if (Number(agency.agency_id) === agencyID) {
          result = agency.long_name;
          return true;
        }
      });
      return result;
    }
    //grab routes and segments from api at the same time
    Promise.all([getRoutes(agencyList), getAllSegments(agencyList)]).then(
      (results) => {
        const routes = results[0];
        const segmentMap = results[1];
        if (routes && routes.length > 0) {
          //for storing routes
          const translocRouteList = [];
          //for creating default setting
          const routeConfig = new Map();
          //get lists that doesn't have segments
          const failedRouteList = [];
          let num = 0; //for setting active on routes
          //limit set for active routes:8 including favorited routes
          const limit = 8 - Object.keys(favorites).length;
          routes.map((route) => {
            if (route.is_active) {
              if (route.segments !== null && route.segments.length > 0) {
                let routeCoordinates = []; //for calculating bounds
                const routeSegments = route.segments.map((segment) => {
                  //grab segment in feature object from map
                  const decodedSegment = segmentMap[segment[0]];
                  //add coordinates from feature
                  routeCoordinates.push(...decodedSegment.geometry.coordinates);
                  //add more info about the route within the map feature for drawing
                  return {
                    ...decodedSegment,
                    properties: {
                      color: "#" + route.color,
                      routes: [route.route_id],
                    },
                  };
                });
                //shorten by half for faster bound calculation
                routeCoordinates = routeCoordinates.filter(
                  (route, index) => index % 2 === 0
                );
                //calculate the bounds of the specific route
                let bounds = routeCoordinates.reduce(function (bounds, coord) {
                  return bounds.extend(coord);
                }, new maplibregl.LngLatBounds(
                  routeCoordinates[0],
                  routeCoordinates[0]
                ));
                //place processed route for storage
                translocRouteList.push({
                  ...route,
                  color: "#" + route.color,
                  segmentFeature: routeSegments,
                  from: "transloc",
                  agencyName: getAgencyName(route.agency_id),
                  bounds: bounds,
                });
                routeConfig.set(route.route_id, {
                  route_id: route.route_id,
                  active: favorites[route.route_id] || num < limit, //set Active on routes
                  popUp: false, //no routes are on popUp yet
                });
                //don't increase count if it was not in favorites
                if (!favorites[route.route_id]) {
                  num++;
                }
              } else {
                failedRouteList.push(route); //for routes from api that didn't have segments data
              }
            }
          });
          //for failed routes, try to get segments from segments api
          //after specifying the route this time
          if (failedRouteList.length > 0) {
            Promise.all(
              failedRouteList.map((route) =>
                getRouteSegments(agencyList, route)
              )
            ).then((result) => {
              failedRouteList.map((route, index) => {
                const routeSegments = result[index];
                if (routeSegments) {
                  //for succesful fetches
                  let routeCoordinates = [];
                  //grab all coordinates for route and filter them out
                  routeSegments.map((segment) => {
                    routeCoordinates.push(segment.geometry.coordinates);
                  });
                  routeCoordinates = routeCoordinates.filter(
                    (route, index) => index % 2 === 0
                  );
                  //calculate the bounds of the specific route
                  let bounds = routeCoordinates.reduce(function (
                    bounds,
                    coord
                  ) {
                    return bounds.extend(coord);
                  },
                  new maplibregl.LngLatBounds(routeCoordinates[0], routeCoordinates[0]));
                  //place processed route for storage
                  translocRouteList.push({
                    ...route,
                    color: "#" + route.color,
                    from: "transloc",
                    segmentFeature: routeSegments,
                    agencyName: getAgencyName(route.agency_id),
                    bounds: bounds,
                  });
                  routeConfig.set(route.route_id, {
                    route_id: route.route_id,
                    active: favorites[route.route_id] || num < limit, //set Active on routes
                    popUp: false,
                  });
                  //don't increase number if it was not in favorites
                  if (!favorites[route.route_id]) {
                    num++;
                  }
                }
              });
            });
          }
          const catRouteList = [];
          //save the CAT routes
          data.get_routes.map((route) => {
            let segment = route.encLine;
            const coordinateList = polyline
              .decode(segment)
              .map((coordinate) => [coordinate[1], coordinate[0]]);
            //filter coordinate list for faster compute of bound
            const routeCoordinates = coordinateList.filter(
              (route, index) => index % 2 === 0
            );
            //calculate the bounds of the specific route
            let bounds = routeCoordinates.reduce(function (bounds, coord) {
              return bounds.extend(coord);
            }, new maplibregl.LngLatBounds(
              routeCoordinates[0],
              routeCoordinates[0]
            ));
            catRouteList.push({
              ...route,
              route_id: String(route.id),
              from: "cat",
              long_name: route.name,
              short_name: route.name,
              bounds: bounds,
              agencyName: "Charlottesville Area Transit",
              segmentFeature: [
                {
                  type: "Feature",
                  geometry: { type: "LineString", coordinates: coordinateList },
                  properties: {
                    color: route.color,
                    routes: [String(route.id)],
                  },
                },
              ],
            });
            routeConfig.set(String(route.id), {
              route_id: String(route.id),
              active: favorites[route.id] || num < limit, //set Active on routes
              popUp: false,
            });
            //don't increase count if it was not in favorites
            if (!favorites[route.id]) {
              num++;
            }
          });
          //save all route data in state
          setRouteList({ transloc: translocRouteList, cat: catRouteList });
          //save route settings in state
          setRouteSetting({ routes: routeConfig });
          //place layer in map
          configureRouteLayer(translocRouteList.concat(catRouteList));
          //open sidebar
          setSidebarPosition({ active: true });
        }
      }
    );
  }
  function configureStops() {
    //fetch stops
    getStops(agencyList).then((stops) => {
      let stopMap = new Map();
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
      //push CAT stops into them and combine stops with transloc if needed
      Object.keys(stopData).forEach((stopID) => {
        const stop = stopData[stopID];
        const translocID = duplicates[stopID];
        if (translocID) {
          if (stopMap.has(translocID)) {
            stopMap.get(translocID).routes.push(...stop.routes);
            stopMap.get(translocID).name = stop.name;
          }
        } else {
          stopMap.set(stop.extID, {
            name: stop.name,
            routes: stop.routes,
            stop_id: stop.extID,
            coordinates: [stop.lng, stop.lat],
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
            coordinates: [stop.coordinates[0], stop.coordinates[1]],
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
      //initial so ignore any stop filtering
      //stopFilter(true);
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
      result[0].map((bus) => {
        if (bus.location) {
          if (!busMap.has(bus.route_id)) {
            busMap.set(bus.route_id, [bus]);
          } else {
            busMap.get(bus.route_id).push(bus);
          }
        }
      });
      result[1].map((bus) => {
        if (bus.inService === 1) {
          const toStore = {
            heading: bus.h,
            vehicle_id: String(bus.trainID),
            location: { lat: bus.lat, lng: bus.lng },
            color: bus.color,
          };
          if (!busMap.has(String(bus.routeID))) {
            busMap.set(String(bus.routeID), [toStore]);
          } else {
            busMap.get(String(bus.routeID)).push(toStore);
          }
        }
      });
      setBusMap(busMap);
    }
    //converting fetched arrival array into map and process data within
    function arrivalUpdate() {
      getArrivalEstimates(agencyList).then((arrivals) => {
        const arrivalMap = new Map();
        arrivals.map((arrival) => {
          arrival.arrivals = arrival.arrivals.map((item) => {
            return {
              ...item,
              remaining: Math.floor(
                //calculate remaining time
                (new Date(item.arrival_at) - new Date()) / 60000
              ),
            };
          });
          arrivalMap.set(arrival.stop_id, arrival);
        });
        setArrivals(arrivalMap);
      });
    }
    if (Object.keys(routeList).length === 0) return;
    routeFilter();
    //update bus markers every 5 seconds
    Promise.all([
      getBuses(agencyList, routeList.transloc),
      getCATBuses(routeList.cat),
    ]).then((result) => {
      storeBuses(result);
    });
    const busInterval = setInterval(
      () =>
        Promise.all([
          getBuses(agencyList, routeList.transloc),
          getCATBuses(routeList.cat),
        ]).then((result) => {
          storeBuses(result);
        }),
      5000
    );
    //update busStop arrivals every 30 seconds
    arrivalUpdate();
    const arrivalInterval = setInterval(() => {
      arrivalUpdate();
    }, 30000);

    return () => {
      clearInterval(busInterval);
      clearInterval(arrivalInterval);
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
        const setting = routeSetting.routes.get(route.route_id);
        if (setting.active || setting.popUp) {
          if (busMap.has(route.route_id)) {
            busArray.push(
              ...busMap.get(route.route_id).map((bus) => {
                return { ...bus, forPopUp: !setting.active && setting.popUp }; //create indication for inactive popUp
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
          if (vehicleID === buses[i].vehicle_id) {
            return;
          }
        }
        busItem.marker.remove();
        deleteBusMarker(vehicleID);
      });

      //creating or animating buses
      buses.map((bus) => {
        if (!busMarkers.markers.has(bus.vehicle_id)) {
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
            marker = new maplibregl.Marker({ element: el })
              .setLngLat([bus.location.lng, bus.location.lat])
              .addTo(map.current);
          } else {
            marker = new maplibregl.Marker({ element: el })
              .setLngLat([bus.location.lng, bus.location.lat])
              .addTo(popUpMap.current.getMap());
          }
          //store marker,angle,and location
          addBusMarker(bus.vehicle_id, {
            marker: marker,
            angle: toCorrectAngle(bus.heading),
            loc: [bus.location.lng, bus.location.lat],
            prevLoc: null,
          });
        } else {
          //grab the specific marker and info
          const busInfo = busMarkers.markers.get(bus.vehicle_id);
          //rotate to appropriate angle
          const newAngle = rotateThis(
            busInfo.marker.getElement().firstChild,
            toCorrectAngle(bus.heading),
            busInfo.angle
          );
          addBusMarker(bus.vehicle_id, {
            marker: busInfo.marker,
            angle: newAngle,
            loc: [bus.location.lng, bus.location.lat],
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
      if (arrivals.has(sidebarSetting.stopID)) {
        const arrivalList = arrivals.get(sidebarSetting.stopID).arrivals;
        for (let i = 0; i < arrivalList.length; i++) {
          if (arrivalList[i].route_id === route.route_id)
            //attach arrival info to specific routes
            return {
              ...route,
              remaining: arrivalList[i].remaining,
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
      allRoutes.some((route) => {
        if (route.route_id === route_id) {
          id = route.stops[0];
          return true;
        }
      });
      if (duplicates[id]) {
        id = duplicates[id];
      }
      return String(id);
    }
    let routeInfo = null;
    //retrieve route info
    allRoutes.map((route, i) => {
      if (route.route_id === route_id) {
        routeInfo = {
          ...route,
          active: routeSetting.routes.get(route_id).active,
        };
      }
    });
    //get a stop if there is no stopId prepared
    const stopID =
      sidebarSetting.stopID === null
        ? getFirstStop(route_id)
        : sidebarSetting.stopID;
    const coordinates = busStops.get(stopID).coordinates;
    //create stop marker for popUp and store for later deletion
    const marker = createBusStopMarker(coordinates);
    setPopUpSetting({
      active: true,
      haveStop: sidebarSetting.stopID !== null, //for fitting route vs specific stop
      routeInfo: routeInfo,
      stopID: stopID,
      marker: marker,
    });
    //set route popUp to active
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
  //functions for moving busMarkers to popUp and main
  function moveBusToPopUp(vehicleID) {
    if (busMarkers.markers.has(vehicleID))
      busMarkers.markers.get(vehicleID).marker.addTo(popUpMap.current.getMap());
  }
  function moveBusToOriginal(vehicleID) {
    if (busMarkers.markers.has(vehicleID))
      busMarkers.markers.get(vehicleID).marker.addTo(map.current);
  }

  function popUpSetBusStop(e) {
    //bbox for increasing click tolerance by 5px
    const bbox = [
      [e.point.x - 10, e.point.y - 10],
      [e.point.x + 10, e.point.y + 10],
    ];
    //if visible stop is clicked
    // Find features intersecting the bounding box.
    const selectedFeatures = popUpMap.current
      .getMap()
      .queryRenderedFeatures(bbox, {
        layers: ["stops"],
      });
    if (
      selectedFeatures &&
      selectedFeatures[0].layer.paint["circle-opacity"] === 1
    ) {
      //fly to stop
      popUpMap.current.getMap().flyTo({
        center: e.features[0].geometry.coordinates,
      });
      //remove previous stop marker and set a new one
      if (popUpSetting.marker !== null) {
        popUpSetting.marker.remove();
      }
      const marker = createBusStopMarker(e.features[0].geometry.coordinates);
      setPopUpSetting({
        ...popUpSetting,
        stopID: e.features[0].properties.stopID,
        marker: marker,
      });
    }
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
  function resetMap() {
    function isAgencyListSame(list) {
      if (agencyList.length === 0 || list.length !== agencyList.length)
        return false;
      for (let i = 0; i < list.length; i++) {
        if (list[i].agency_id !== agencyList[i].agency_id) {
          return false;
        }
      }
      return true;
    }
    function isRouteListSame(routes) {
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
    //fetch agency
    getAgency(map.current.getBounds()).then((list) => {
      //agency length or items within are different, trigger update routes
      if (!isAgencyListSame(list)) {
        setAgencyList(list);
      } else {
        //routes are updated, trigger update on routes
        getRoutes(agencyList).then((routes) => {
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
          geoLocOn={geoLocSetting}
          heading={heading}
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
        haveStop={popUpSetting.haveStop}
        routeInfo={popUpSetting.routeInfo}
        stop={popUpSetting.active ? busStops.get(popUpSetting.stopID) : null}
        arrival={popUpSetting.active ? arrivals.get(popUpSetting.stopID) : null}
        busArray={
          popUpSetting.active
            ? busMap.get(popUpSetting.routeInfo.route_id)
            : null
        }
        favorite={
          popUpSetting.active
            ? favorites[popUpSetting.routeInfo.route_id]
            : null
        }
        ref={popUpMap}
        functions={{
          closePopUp: closePopUp,
          moveBusToPopUp: moveBusToPopUp,
          moveBusToOriginal: moveBusToOriginal,
          popUpSetBusStop: popUpSetBusStop,
          toggleFavorite: toggleFavorite,
        }}
      />
    </>
  );
}

export default App;
