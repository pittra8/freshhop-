// netlify/functions/notify-new-order.js
//
// Sends an email to the shop owner whenever a new order comes in.
// Requires this environment variable set in Netlify:
//   RESEND_API_KEY

exports.handler = async function (event, context) {
  console.log("notify-new-order: function invoked, method =", event.httpMethod);

  if (event.httpMethod !== "POST") {
    console.log("notify-new-order: rejected, not POST");
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let body;
  try {
    body = JSON.parse(event.body);
    console.log("notify-new-order: parsed body ok, order_id =", body.order_id);
  } catch (err) {
    console.log("notify-new-order: JSON parse error:", err.message);
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const {
    store_name,
    customer_name,
    customer_phone,
    mode,
    address,
    order_id,
  } = body;

  console.log("notify-new-order: RESEND_API_KEY present?", !!process.env.RESEND_API_KEY);

  const html = `
    <h2>New FreshHop order</h2>
    <p><strong>Store:</strong> ${store_name || "N/A"}</p>
    <p><strong>Customer:</strong> ${customer_name || "N/A"} (${customer_phone || "N/A"})</p>
    <p><strong>Mode:</strong> ${mode || "N/A"}</p>
    ${mode === "delivery" ? `<p><strong>Delivery address:</strong> ${address || "N/A"}</p>` : ""}
    <p>Open the shopper page to price and confirm this order.</p>
  `;

  try {
    console.log("notify-new-order: calling Resend API...");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "FreshHop <onboarding@resend.dev>",
        to: "pittra71@atomicmail.io",
        subject: `New order: ${store_name || "FreshHop order"}`,
        html,
      }),
    });

    console.log("notify-new-order: Resend responded with status", res.status);

    if (!res.ok) {
      const errText = await res.text();
      console.log("notify-new-order: Resend error body:", errText);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to send email", details: errText }),
      };
    }

    const resData = await res.text();
    console.log("notify-new-order: Resend success body:", resData);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.log("notify-new-order: unexpected error:", err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Unexpected error", details: err.message }),
    };
  }
};
