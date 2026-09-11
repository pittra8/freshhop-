exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
    const body = JSON.parse(event.body);
    const amount = body.amount;

    if (!amount || amount <= 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json"
