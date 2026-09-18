// netlify/functions/create-payment-link.js
//
// Requires these environment variables set in Netlify:
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY
//   STRIPE_SECRET_KEY

const { createClient } = require("@supabase/supabase-js");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

exports.handler = async function (event, context) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (err) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const orderId = body.order_id;
  if (!orderId) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Missing order_id" }),
    };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { data: order, error: fetchError } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (fetchError || !order) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Order not found" }),
    };
  }

  const itemTotal = order.item_total || 0;
  const deliveryFee = order.delivery_fee || 0;

  if (!itemTotal || itemTotal <= 0) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Order has no valid item total" }),
    };
  }

  const lineItems = [
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: "FreshHop order" + (order.store_name ? " — " + order.store_name : ""),
        },
        unit_amount: Math.round(itemTotal * 100),
      },
      quantity: 1,
    },
  ];

  if (deliveryFee > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: {
          name: "Delivery fee",
        },
        unit_amount: Math.round(deliveryFee * 100),
      },
      quantity: 1,
    });
  }

  const paymentLink = await stripe.paymentLinks.create({
    line_items: lineItems,
    managed_payments: { enabled: false },
    metadata: {
      order_id: order.id,
    },
  });

  const { error: updateError } = await supabase
    .from("orders")
    .update({
      payment_link_url: paymentLink.url,
      stripe_payment_link_id: paymentLink.id,
      payment_status: "pending",
    })
    .eq("id", order.id);

  if (updateError) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "Order created but failed to save payment link",
        details: updateError.message,
        order_id: order.id,
      }),
    };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      success: true,
      order_id: order.id,
      payment_link_url: paymentLink.url,
    }),
  };
};
