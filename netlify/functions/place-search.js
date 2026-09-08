// netlify/functions/place-search.js

export default async (req, context) => {
  const url = new URL(req.url);
  const query = url.searchParams.get("query");
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const radius = parseFloat(url.searchParams.get("radius")) || 5000;

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

  const apiUrl = "https://places.googleapis.com/v1/places:searchText";

  const body = query
    ? { textQuery: query }
    : {
        textQuery: "restaurants",
        locationBias: {
          circle: {
            center: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
            radius: radius
          }
        }
      };

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.id,places.location,places.currentOpeningHours.openNow"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Google Places API error`, details: data.error?.message || data }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }

    const results = (data.places || []).map((place) => ({
      name: place.displayName?.text,
      address: place.formattedAddress,
      rating: place.rating,
      userRatingsTotal: place.userRatingCount,
      priceLevel: place.priceLevel,
      placeId: place.id,
      location: place.location,
      openNow: place.currentOpeningHours?.openNow
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
