export async function getRoutes() {
  const url = "http://3.95.137.105/routes";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getAllSegments() {
  const url = "http://3.95.137.105/segments";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getStops() {
  const url = "http://3.95.137.105/stops";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getBuses() {
  const url = "http://3.95.137.105/vehicles";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getSchedule() {
  const url = "http://3.95.137.105/schedules";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
