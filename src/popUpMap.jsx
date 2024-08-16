import React, {
  useState,
  useRef,
  forwardRef,
  useEffect,
  useImperativeHandle,
} from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import cx from "classnames";
import styles from "./popUpMap.module.css";
import Sidebar from "./Sidebar";
const PopUpMap = forwardRef(function PopUpMap(
  { active, routeInfo, busArray, stop, arrival, haveStop, functions },
  popUpMap
) {
  //viewport state
  const [viewport, setViewport] = useState({ long: 0, lat: 0, zoom: 5 });
  //for sidebar open/close animation
  const [sidebarPosition, setSidebarPosition] = useState({ active: false });
  //popUp  refs
  const mapContainer = useRef(null);
  const map = useRef(null);
  const sidebar = useRef(null);
  /*************************** map initiing/layer&marker animation ***********************/
  useEffect(() => {
    if (map.current) return;
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      center: [viewport.long, viewport.lat],
      zoom: viewport.zoom,
      minZoom: 2,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      attributionControl: false,
    }).addControl(
      new maplibregl.AttributionControl({
        compact: true,
      }),
      "top-right"
    );
    //set viewport on move
    map.current.on("move", () => {
      const newLong = map.current.getCenter().lng.toFixed(4);
      const newLat = map.current.getCenter().lat.toFixed(4);
      const newZoom = map.current.getZoom().toFixed(2);
      setViewport({ lat: newLat, long: newLong, zoom: newZoom });
    });
  }, []);

  // prepare forward ref for use in App.jsx
  useImperativeHandle(popUpMap, () => ({
    getMap: () => {
      return map.current;
    },
  }));

  //stops/stop_shadow layer fade animation
  useEffect(() => {
    if (map.current.getSource("stops")) {
      if (viewport.zoom > 13) {
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

  //Since BusStop Marker changes in state, need to reset onClick
  useEffect(() => {
    map.current.on("click", "stops", functions[3]);
    return () => {
      map.current.off("click", "stops", functions[3]);
    };
  }, [functions[3]]);
  /*******************************************************************************/

  /*************************** popUp activation **********************************/
  //initiating popUp when open
  useEffect(() => {
    function setRouteStopFilters() {
      const tagFilter = ["any"].concat([
        ["in", routeInfo.route_id, ["get", "routes"]],
      ]);
      map.current.setFilter("routes", tagFilter);
      let stopFilter = [...tagFilter];
      stopFilter = ["all", stopFilter, ["!=", stop.stop_id, ["get", "stopID"]]];
      map.current.setFilter("stops", stopFilter);
      map.current.setFilter("stops_shadow", stopFilter);
    }
    if (!active) return;
    //fit bounds of popUp depending on haveStop variable
    if (haveStop) {
      map.current.setCenter(stop.coordinates);
      map.current.setZoom(14);
      setSidebarPosition({ active: true });
    } else {
      map.current.fitBounds(routeInfo.bounds, {
        padding: { top: 50, bottom: 100, left: 10, right: 10 },
        duration: 0,
      });
    }
    setRouteStopFilters();
    if (busArray && busArray.length > 0) {
      //if route was already active, move markers to popUp map
      if (routeInfo.active) {
        busArray.map((bus) => {
          functions[1](bus.vehicle_id);
        });
      }
    }
    return () => {
      //if route was already active,move markers back to original map
      if (routeInfo.active && busArray && busArray.length > 0) {
        busArray.map((bus) => {
          functions[2](bus.vehicle_id);
        });
      }
    };
  }, [active]);
  /*******************************************************************************/

  /*************************** sidebar animation **********************************/
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
    if (sidebar.current === null) return;
    map.current.on("move", mapMoveEvent); //apply event
    let target = sidebar.current.getContainer();
    //set final height depending on current state
    const height = sidebarPosition.active ? 300 : 0;
    const difference = height - target.clientHeight;
    function easing(t) {
      return t * (2 - t);
    }
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
      target.style.height = height + "px";
    };
    //move map along with sidebar animation only if user slided up/down sidebar
    if (!sidebarPosition.mapMove) {
      //user opened sidebar, fly to location
      if (sidebarPosition.active) {
        map.current.flyTo({
          center: stop.coordinates,
          padding: { bottom: 300 },
          zoom: 14,
          duration: 500,
        });
        //if it's closing, just move map down by a bit
      } else {
        map.current.panBy([0, difference / 2], {
          duration: 200,
          easing,
        });
      }
    }
    return () => {
      map.current.off("move", mapMoveEvent); //remove event
    };
  }, [sidebarPosition]);
  /*******************************************************************************/

  /***********************functions to be passed to sidebar **********************/
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
        //set new height
        target.style.height = Math.min(300, target.clientHeight + move) + "px";
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
  /*******************************************************************************/

  //process arrival for use in sidebar
  function processArrival() {
    //retrieve bus call name from array
    function getBusName(vehicleID) {
      let busName;
      busArray.some((bus) => {
        if (bus.vehicle_id === vehicleID) {
          busName = bus.call_name;
          return true;
        }
      });
      return busName;
    }
    //set up arrival data accordingly- There can be empty representations
    //for routes that either has few or no arrivals
    if (!arrival) {
      return [null, null];
    }
    let tempArr = arrival.arrivals
      .filter((item) => item.route_id === routeInfo.route_id)
      .map((item) => {
        return { ...item, busName: getBusName(item.vehicle_id) };
      });
    if (tempArr.length === 0) return [null, null];
    if (tempArr.length === 1) return tempArr.concat([null]);
    return tempArr;
  }

  return (
    <div className={cx(styles.popUp, active ? styles.active : null)}>
      <div
        className={styles.header}
        style={{ backgroundColor: active ? "#" + routeInfo.color : "white" }}
      >
        <div
          className={styles.closeButton}
          onClick={() => {
            functions[0]();
            setSidebarPosition(false);
          }}
        >
          Close
        </div>
        {active && (
          <div className={styles.routeTitle}>
            <h4 className={styles.routeName}>
              {routeInfo.short_name === ""
                ? routeInfo.long_name
                : routeInfo.short_name + ": " + routeInfo.long_name}
            </h4>
            <h5>{routeInfo.agencyName}</h5>
          </div>
        )}
      </div>
      <div ref={mapContainer} className={styles.mapContainer} />
      {active ? (
        <Sidebar
          ref={sidebar}
          state={4}
          stop={stop}
          arrival={processArrival(arrival)}
          color={routeInfo.color}
          functions={[0, 0, touchStart, touchMove, touchEnd, clickOpen]}
        />
      ) : null}
    </div>
  );
});

export default PopUpMap;