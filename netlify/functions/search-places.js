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
