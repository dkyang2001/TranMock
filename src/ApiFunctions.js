import polyline from "@mapbox/polyline";
export async function getAgency(bounds) {
  let url =
    "https://transloc-api-1-2.p.rapidapi.com/agencies.json?callback=call";
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": "f062b813d2mshb3006af2783d3bcp1babcbjsn0d0c0e05c095",
      "x-rapidapi-host": "transloc-api-1-2.p.rapidapi.com",
    },
  };
  const firstBound = bounds._ne;
  const secondBound = bounds._sw;
  const firstString =
    Number(firstBound.lat).toFixed(4) +
    "%2c" +
    Number(firstBound.lng).toFixed(4) +
    "%7c";
  const secondString =
    Number(secondBound.lat).toFixed(4) +
    "%2c" +
    Number(secondBound.lng).toFixed(4);
  url += "&geo_area=" + firstString + secondString;
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return data.data;
  } catch (error) {
    return [];
  }
}
function agencyToString(agencyList) {
  let agencyString = "";
  agencyList.map((agency, index, list) => {
    agencyString += agency.agency_id;
    if (index < list.length - 1) agencyString += "%2C";
  });
  return agencyString;
}
export async function getRoutes(agencyList) {
  let url = "https://transloc-api-1-2.p.rapidapi.com/routes.json?callback=call";
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": "f062b813d2mshb3006af2783d3bcp1babcbjsn0d0c0e05c095",
      "x-rapidapi-host": "transloc-api-1-2.p.rapidapi.com",
    },
  };
  url += "&agencies=" + agencyToString(agencyList);
  try {
    const response = await fetch(url, options);
    const result = await response.json();
    const routeList = [];
    Object.values(result.data).map((item) => {
      routeList.push(...item);
    });
    return routeList;
  } catch (error) {
    return [];
  }
}
export async function getCATRoutes() {
  let url =
    "https://catpublic.etaspot.net/service.php?service=get_routes&includeETAData=1&orderedETAArray=1&token=TESTING";
  try {
    const response = await fetch(url);
    const result = await response.json();
    //update encLine

    //replace original encLine with my cleaned encLine
    return result.get_routes;
  } catch (error) {
    console.error(error);
    return [];
  }
}
export async function getAllSegments(agencyList) {
  let url =
    "https://transloc-api-1-2.p.rapidapi.com/segments.json?callback=call";
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": "f062b813d2mshb3006af2783d3bcp1babcbjsn0d0c0e05c095",
      "x-rapidapi-host": "transloc-api-1-2.p.rapidapi.com",
    },
  };
  url += "&agencies=" + agencyToString(agencyList);
  try {
    const response = await fetch(url, options);
    let result = await response.json();
    result = result.data;
    //decode polyline data
    Object.keys(result).forEach((key) => {
      result[key] = {
        type: "Feature",
        geometry: polyline.toGeoJSON(result[key]),
      };
    });
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getRouteSegments(agencyList, route) {
  let url =
    "https://transloc-api-1-2.p.rapidapi.com/segments.json?callback=call";
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": "f062b813d2mshb3006af2783d3bcp1babcbjsn0d0c0e05c095",
      "x-rapidapi-host": "transloc-api-1-2.p.rapidapi.com",
    },
  };
  url += "&agencies=" + agencyToString(agencyList);
  url += "&routes=" + route.route_id;
  try {
    const response = await fetch(url, options);
    let result = await response.json();
    if (result) {
      result = result.data;
      const decodedSegments = [];
      //decode polyline data
      Object.keys(result).forEach((key) => {
        decodedSegments.push({
          type: "Feature",
          geometry: polyline.toGeoJSON(result[key]),
          properties: { color: "#" + route.color, routes: [route.route_id] },
        });
      });
      return decodedSegments;
    }
    return null;
  } catch (error) {
    console.error(error);
  }
}
export async function getCATRouteSegments() {
  let url =
    "https://catpublic.etaspot.net/service.php?service=get_patterns&includeETAData=1&orderedETAArray=1&token=TESTING";
  try {
    const response = await fetch(url);
    const result = await response.json();
    //update encLine

    //replace original encLine with my cleaned encLine
    const catSegmentDic = {};
    result.get_patterns.map((segment) => {
      const routeID = String(segment.routes[0]);
      const decodedSegment = {
        type: "Feature",
        geometry: polyline.toGeoJSON(segment.encLine),
        properties: { color: segment.color, routes: [routeID] },
      };
      if (catSegmentDic[routeID]) {
        catSegmentDic[routeID].push(decodedSegment);
      } else {
        catSegmentDic[routeID] = [decodedSegment];
      }
    });
    return catSegmentDic;
  } catch (error) {
    console.error(error);
    return {};
  }
}
export async function getStops(agencyList) {
  let url = "https://transloc-api-1-2.p.rapidapi.com/stops.json?callback=call";
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": "f062b813d2mshb3006af2783d3bcp1babcbjsn0d0c0e05c095",
      "x-rapidapi-host": "transloc-api-1-2.p.rapidapi.com",
    },
  };
  url += "&agencies=" + agencyToString(agencyList);
  try {
    const response = await fetch(url, options);
    const result = await response.json();
    return result.data;
  } catch (error) {
    return [];
  }
}
export async function getCATStops() {
  let url =
    "https://catpublic.etaspot.net/service.php?service=get_stops&includeETAData=1&orderedETAArray=1&token=TESTING";
  try {
    const response = await fetch(url);
    const result = await response.json();
    //update encLine

    //replace original encLine with my cleaned encLine
    return result.get_stops;
  } catch (error) {
    console.error(error);
    return [];
  }
}
function getColor(routes, routeID) {
  for (let i = 0; i < routes.length; i++) {
    if (routes[i].route_id == routeID) {
      return routes[i].color;
    }
  }
}
export async function getCATBuses(routes) {
  let url =
    "https://catpublic.etaspot.net/service.php?service=get_vehicles&includeETAData=1&inService=1&orderedETAArray=1&token=TESTING";
  try {
    const response = await fetch(url);
    let result = await response.json();
    const vehicleList = result.get_vehicles;

    //give bus the same color as its route
    if (!vehicleList || vehicleList.length === 0) return [];
    return vehicleList.map((bus) => {
      return { ...bus, color: getColor(routes, String(bus.routeID)) };
    });
  } catch (error) {
    return [];
  }
}
export async function getCATArrivals() {
  let url =
    "https://catpublic.etaspot.net/service.php?service=get_vehicles&includeETAData=1&inService=1&orderedETAArray=1&token=TESTING";
  try {
    const response = await fetch(url);
    let result = await response.json();
    return result.get_vehicles;
  } catch (error) {
    console.error(error);
  }
}
export async function getBuses(agencyList, routes) {
  let url =
    "https://transloc-api-1-2.p.rapidapi.com/vehicles.json?callback=call";
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": "f062b813d2mshb3006af2783d3bcp1babcbjsn0d0c0e05c095",
      "x-rapidapi-host": "transloc-api-1-2.p.rapidapi.com",
    },
  };
  url += "&agencies=" + agencyToString(agencyList);
  try {
    const response = await fetch(url, options);
    let result = await response.json();
    const vehicleList = [];
    result = Object.values(result.data).map((vehicles) => {
      vehicleList.push(...vehicles);
    });
    //give bus the same color as its route
    if (!vehicleList || vehicleList.length === 0) return [];
    return vehicleList.map((bus) => {
      return { ...bus, color: getColor(routes, bus.route_id) };
    });
  } catch (error) {
    return [];
  }
}
export async function getArrivalEstimates(agencyList) {
  let url =
    "https://transloc-api-1-2.p.rapidapi.com/arrival-estimates.json?callback=call";
  const options = {
    method: "GET",
    headers: {
      "x-rapidapi-key": "f062b813d2mshb3006af2783d3bcp1babcbjsn0d0c0e05c095",
      "x-rapidapi-host": "transloc-api-1-2.p.rapidapi.com",
    },
  };
  url += "&agencies=" + agencyToString(agencyList);
  try {
    const response = await fetch(url, options);
    const result = await response.json();
    return result.data;
  } catch (error) {
    return [];
  }
}
