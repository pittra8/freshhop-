export default async (req, context) => {
  const url = new URL(req.url);
  const query = url.searchParams.get("query");
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const radius = url.searchParams.get("radius") || 5000;

  if (!query && !(lat && lng)) {
    return new Response(
      JSON.stringify({ error: "Provide a 'query' or 'lat'/'lng' parameter." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const apiKey = Netlify.env.get("GOOGLE_PLACES_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Missing GOOGLE_PLACES_API_KEY environment variable." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const apiUrl = query
    ? `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`
    : `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=restaurant&key=${apiKey}`;

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return new Response(
        JSON.stringify({ error: `Google Places API error: ${data.status}`, details: data.error_message }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const results = (data.results || []).map((place) => ({
      name: place.name,
      address: place.formatted_address || place.vicinity,
      rating: place.rating,
      userRatingsTotal: place.user_ratings_total,
      priceLevel: place.price_level,
      placeId: place.place_id,
      location: place.geometry?.location,
      openNow: place.opening_hours?.open_now
    }));

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch from Google Places API", details: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};

export const config = {
  path: "/api/place-search"
};
