exports.handler = async (event) => {
  const YELP_API_KEY = process.env.YELP_API_KEY;

  if (!YELP_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing YELP_API_KEY environment variable" }),
    };
  }

  const params = event.queryStringParameters || {};
  const location = params.location || "Seattle";
  const term = params.term || "restaurants";
  const limit = params.limit || "20";

  const yelpUrl = `https://api.yelp.com/v3/businesses/search?location=${encodeURIComponent(
    location
  )}&term=${encodeURIComponent(term)}&limit=${encodeURIComponent(limit)}`;

  try {
    const response = await fetch(yelpUrl, {
      headers: {
        Authorization: `Bearer ${YELP_API_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify(data),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
