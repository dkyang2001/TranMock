import polyline from "@mapbox/polyline";

export async function getAgency(bounds) {
  console.log("agency");
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
    console.error(error);
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
  console.log("routes");
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
    console.error(error);
  }
}
export async function getAllSegments(agencyList) {
  console.log("segments");
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
      const coordinateList = polyline
        .decode(result[key])
        .map((coordinate) => [coordinate[1], coordinate[0]]);
      result[key] = {
        type: "Feature",
        geometry: { type: "LineString", coordinates: coordinateList },
      };
    });
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getRouteSegments(agencyList, route) {
  console.log("segments");
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
        const coordinateList = polyline
          .decode(result[key])
          .map((coordinate) => [coordinate[1], coordinate[0]]);
        decodedSegments.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: coordinateList },
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
export async function getStops(agencyList) {
  console.log("stops");
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
    console.error(error);
  }
}
function getColor(routes, routeID) {
  for (let i = 0; i < routes.length; i++) {
    if (routes[i].route_id == routeID) {
      return routes[i].color;
    }
  }
}
export async function getBuses(agencyList, routes) {
  console.log("buses");
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
    if (vehicleList.length === 0) return;
    return vehicleList.map((bus) => {
      return { ...bus, color: getColor(routes, bus.route_id) };
    });
  } catch (error) {
    console.error(error);
  }
}
export async function getArrivalEstimates(agencyList) {
  console.log("arrival");
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
    console.error(error);
  }
}