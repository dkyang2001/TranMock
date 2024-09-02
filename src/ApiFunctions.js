export async function getRoutes() {
  const url = "http://localhost:3000/routes";
  // const url = "https://421421421.ddns.net/routes";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getAllSegments() {
  const url = "http://localhost:3000/segments";
  // const url = "https://421421421.ddns.net/segments";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getStops() {
  const url = "http://localhost:3000/stops";
  // const url = "https://421421421.ddns.net/stops";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getBuses() {
  const url = "http://localhost:3000/vehicles";
  //const url = "https://421421421.ddns.net/vehicles";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getSchedule() {
  const url = "http://localhost:3000/schedules";
  //  const url = "https://421421421.ddns.net/schedules";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
