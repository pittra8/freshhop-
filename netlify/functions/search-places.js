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
    const overpassRes = await fetch("https://overpass.kumi.systems/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "FreshHopApp/1.0 (contact@freshhop.app)",
      },
      body: "data=" + encodeURIComponent(query),
    });

    if (!overpassRes.ok) {
      throw new Error(`O
