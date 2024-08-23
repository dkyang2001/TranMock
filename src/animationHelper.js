import * as turf from "@turf/turf";
import styles from "./App.module.css";
/***************Bus Animation Helper Methods **************************/
export function createGeoLocElement(angle) {
  const container = document.createElement("div");
  const circle = document.createElement("div");
  circle.className = styles.circle;
  const circleShadow = document.createElement("div");
  circleShadow.className = styles.circleShadow;
  const arrow_up = document.createElement("div");
  arrow_up.className = styles.arrow_up;
  arrow_up.style.transform = "rotate(" + angle + "deg) translateY(-13px)";
  circle.append(circleShadow, arrow_up);
  container.append(circle);
  return container;
}
export function rotateGeoLoc(element, nR, prevR) {
  var aR;
  prevR = prevR || 0; // if rot undefined or 0, make 0, else rot
  aR = prevR % 360;
  if (aR < 0) {
    aR += 360;
  }
  if (aR < 180 && nR > aR + 180) {
    prevR -= 360;
  }
  if (aR >= 180 && nR <= aR - 180) {
    prevR += 360;
  }
  prevR += nR - aR;
  element.style.transform = "rotate(" + prevR + "deg) translateY(-13px)";
  return prevR;
}
export function createBusElement(color, angle) {
  const container = document.createElement("div");
  const el = document.createElement("div");
  el.className = styles.marker;
  el.innerHTML = `<svg width="30px" height="30px" viewBox="0 0 24 24" id="magicoon-Regular" xmlns="http://www.w3.org/2000/svg">
  <g id="map-marker-Regular">
  <path  stroke="black" stroke-width="2px" id="map-marker-Regular-2" data-name="map-marker-Regular"  d="M12,2.25A7.578,7.578,0,0,0,4.25,10c0,6.208,4.736,10.076,6.771,11.45a1.736,1.736,0,0,0,1.948,0C15.008,20.075,19.75,16.2,19.75,10A7.582,7.582,0,0,0,12,2.25Z"
  />
   <circle fill="none" stroke="black" stroke-width="2px" cx="12" cy="9" r="3" />
  <polygon fill="black" stroke="black" stroke-width="1px" stroke-linecap="round" stroke-linejoin="round" points="12,18.5  10.5,16 12,16.5  13.5,16" />
  </g>
  </svg>`;
  el.firstChild.style.fill = color;
  el.style.transform = "rotate(" + angle + "deg)";
  container.append(el);
  return container;
}
export function createBusStopElement() {
  const container = document.createElement("div");
  container.className = styles.stopMarker;
  const bigCircle = document.createElement("div");
  bigCircle.className = styles.bigCircle;
  const stick = document.createElement("div");
  stick.className = styles.stick;
  const smallCircle = document.createElement("div");
  smallCircle.className = styles.smallCircle;
  container.append(...[bigCircle, stick, smallCircle]);
  return container;
}
//provide a two-way rotation for transform:rotate
export function rotateThis(element, nR, prevR) {
  var aR;
  prevR = prevR || 0; // if rot undefined or 0, make 0, else rot
  aR = prevR % 360;
  if (aR < 0) {
    aR += 360;
  }
  if (aR < 180 && nR > aR + 180) {
    prevR -= 360;
  }
  if (aR >= 180 && nR <= aR - 180) {
    prevR += 360;
  }
  prevR += nR - aR;
  element.style.transform = "rotate( " + prevR + "deg )";
  return prevR;
}
//return intervalId to be cleared for dismount/rerender from setinterval
function animateMarker(marker, arc, steps) {
  let frame = 0;
  const id = setInterval(() => {
    if (frame >= steps) {
      clearInterval(id);
    }
    if (arc[frame]) {
      marker.setLngLat([arc[frame][0], arc[frame][1]]);
    }
    frame++;
  }, 1000 / steps);
  return id;
}
//move along an arc from previous coordinate to current
export async function moveAnimation(marker, prev, curr) {
  if (prev === null) {
    return null;
  }
  var travelLine = turf.lineString([prev, curr]);
  var lineDistance = turf.length(travelLine);
  const arc = [];
  if (lineDistance > 0) {
    //steps determine the fps, currently 60
    const steps = 60;
    for (let i = 0; i < lineDistance; i += lineDistance / steps) {
      const segment = turf.along(travelLine, i);
      arc.push(segment.geometry.coordinates);
    }
    return animateMarker(marker, arc, steps);
  }
  return null;
}
