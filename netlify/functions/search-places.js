export const config = {
  path: "/api/place-search"
};

export default async (req, context) => {
  const url = new URL(req.url);
  const lat = url.searchParams.get("lat") || "45.7809";
  const lng = url.searchParams.get("lng") || "-122.5334";
  const radius = parseFloat(url.searchParams.get("radius")) || 5000;

  const categories = [
    { key: "amenity", value: "restaurant" },
    { key: "shop", value: "supermarket" },
    { key: "shop", value: "convenience" },
  ];

  const clauses = categories
    .map(
      ({ key, value }) => `
        node["${key}"="${value}"](around:${radius},${lat},${lng});
        way["${key}"="${value}"](around:${radius},${lat},${lng});
      `
    )
    .join("");

  const query = `
    [out:json][timeout:25];
    (
      ${clauses}
    );
    out center;
  `;

  try {
    const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
    });

    if (!overpassRes.ok) {
      throw new Error(`Overpass API returned ${overpassRes.status}`);
    }

    const data = await overpassRes.json();

    const results = data.elements
      .map((el) => {
        const placeLat = el.lat ?? el.center?.lat;
        const placeLng = el.lon ?? el.center?.lon;
        if (!placeLat || !placeLng) return null;

        return {
