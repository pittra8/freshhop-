exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { createClient } = require("@supabase/supabase-js");
    const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

    const body = JSON.parse(event.body);
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

    const amount = order.final_total || order.total;

    if (!amount || amount <= 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Order has no valid total to charge" }),
      };
    }

    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "FreshHop order" + (order.store_name ? " - " + order.store_name : ""),
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
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
          error: "Payment link created but failed to save to order",
          details: updateError.message,
          payment_link_url: paymentLink.url,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, payment_link_url: paymentLink.url }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
