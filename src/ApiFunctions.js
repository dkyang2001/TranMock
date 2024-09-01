export async function getRoutes() {
  const url = "https://3.95.137.105:8443/routes";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getAllSegments() {
  const url = "https://3.95.137.105:8443/segments";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getStops() {
  const url = "https://3.95.137.105:8443/stops";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getBuses() {
  const url = "https://3.95.137.105:8443/vehicles";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
export async function getSchedule() {
  const url = "https://3.95.137.105:8443/schedules";
  try {
    const response = await fetch(url);
    const result = await response.json();
    return result;
  } catch (error) {
    console.error(error);
  }
}
