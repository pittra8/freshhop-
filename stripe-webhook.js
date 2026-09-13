exports.handler = async function (event) {
  const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  const { createClient } = require("@supabase/supabase-js");

  const sig = event.headers["stripe-signature"];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return {
      statusCode: 400,
      body: "Webhook signature verification failed: " + err.message,
    };
  }

  if (stripeEvent.type === "checkout.session.completed") {
    const session = stripeEvent.data.object;
    const orderId = session.metadata && session.metadata.order_id;

    if (orderId) {
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );

      await supabase
        .from("orders")
        .update({ payment_status: "paid" })
        .eq("id", orderId);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ received: true }),
  };
};
