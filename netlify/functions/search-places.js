exports.handler = async function (event) {
  const params = event.queryStringParameters || {};
  const lat = params.lat || "45.7809";
  const lng = params.lng || "-122.5334";
  const radius = parseFloat(params.radius) || 5000;

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
const overpassRes = await fetch("https://overpass.kumi.systems/api/interpreter", {-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "FreshHopApp/1.0 (contact@freshhop.app)",
      },
      body: "data=" + encodeURIComponent(query),
    });

    if (!overpassRes.ok) {
      throw new Error(`Overpass API returned ${overpassRes.status}`);
    }

    const data = await overpassRes.json();

    const results = data.elements
      .map((el) => {
        const placeLat = el.lat ?? (el.center && el.center.lat);
        const placeLng = el.lon ?? (el.center && el.center.lon);
        if (!placeLat || !placeLng) return null;

        return {
          name: (el.tags && el.tags.name) || "Unnamed",
          address:
            el.tags && el.tags["addr:street"]
              ? `${el.tags["addr:housenumber"] || ""} ${el.tags["addr:street"]}`.trim()
              : null,
          placeId: el.id,
          location: { lat: placeLat, lng: placeLng },
          category: (el.tags && (el.tags.amenity || el.tags.shop)) || null,
          phone: (el.tags && (el.tags.phone || el.tags["contact:phone"])) || null,
          website: (el.tags && (el.tags.website || el.tags["contact:website"])) || null,
        };
      })
      .filter(Boolean);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results }),
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Failed to fetch places", details: err.message }),
    };
  }
};
