export async function getRoutes() {
  const url = "http://44.211.130.74:3000/routes";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getAllSegments() {
  const url = "http://44.211.130.74:3000/segments";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getStops() {
  const url = "http://44.211.130.74:3000/stops";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getBuses() {
  const url = "http://44.211.130.74:3000/vehicles";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getSchedule() {
  const url = "http://44.211.130.74:3000/schedules";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
