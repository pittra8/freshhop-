
exports.handler = async function (event) {
  const params = event.queryStringParameters || {};
  const location = params.location;
  const term = params.term || "restaurants";
  const limit = params.limit || "20";
  const offset = params.offset || "0";
  const categories = params.categories || "restaurants";

  if (!location) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required query param: location" }),
    };
  }

  const apiKey = process.env.YELP_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server is not configured with a Yelp API key" }),
    };
  }

  const yelpUrl = new URL("https://api.yelp.com/v3/businesses/search");
  yelpUrl.searchParams.set("location", location);
  yelpUrl.searchParams.set("term", term);
  yelpUrl.searchParams.set("categories", categories);
  yelpUrl.searchParams.set("limit", limit);
  yelpUrl.searchParams.set("offset", offset);

  try {
    const yelpRes = await fetch(yelpUrl.toString(), {
      headers: { Authorization: "Bearer " + apiKey },
    });

    if (!yelpRes.ok) {
      const errBody = await yelpRes.text();
      return {
        statusCode: yelpRes.status,
        body: JSON.stringify({ error: "Yelp API request failed", details: errBody }),
      };
    }

    const data = await yelpRes.json();

    const businesses = (data.businesses || []).map(function (b) {
      return {
        id: b.id,
        name: b.name,
        phone: b.display_phone,
        address: b.location && b.location.display_address ? b.location.display_address.join(", ") : "",
        categories: (b.categories || []).map(function (c) { return c.title; }),
        rating: b.rating,
        review_count: b.review_count,
        url: b.url,
        is_closed: b.is_closed,
      };
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ total: data.total, businesses: businesses }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Unexpected error calling Yelp API", details: String(err) }),
    };
  }
};
