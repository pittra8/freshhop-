// netlify/functions/create-order.js
//
// Requires these environment variables set in Netlify:
//   SUPABASE_URL              - your Supabase project URL
//   SUPABASE_SERVICE_KEY      - your Supabase service role key
//                                this function writes to the database and
//                                needs write access
//
// Requires the "@supabase/supabase-js" package.
//   npm install @supabase/supabase-js

const { createClient } = require("@supabase/supabase-js");

module.exports = async (req, context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const {
    mode,
    address,
    store_id,
    store_name,
    store_address,
    time_slot_id,
    customer_name,
    customer_phone,
    order_type,
    total,
    budget_cap,
    items,
  } = body;

  // Basic required-field validation
  const missing = [];
  if (!mode) missing.push("mode");
  if (!customer_name) missing.push("customer_name");
  if (!customer_phone) missing.push("customer_phone");
  if (mode === "delivery" && !address) missing.push("address");

  if (missing.length) {
    return new Response(
      JSON.stringify({ error: "Missing required fields", missing }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert([
      {
        mode,
        address: address || null,
        store_id: store_id || null,
        store_name: store_name || null,
        store_address: store_address || null,
        time_slot_id: time_slot_id || null,
        customer_name,
        customer_phone,
        order_type: order_type || "catalog",
        total: total || null,
        budget_cap: budget_cap || null,
      },
    ])
    .select()
    .single();

  if (orderError) {
    return new Response(
      JSON.stringify({ error: "Failed to create order", details: orderError.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // If line items were provided, insert them linked to this order
  if (Array.isArray(items) && items.length > 0) {
    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id || null,
      quantity: item.quantity || 1,
      unit_price: item.unit_price || null,
      item_description: item.item_description || null,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      return new Response(
        JSON.stringify({
          error: "Order created but failed to add items",
          details: itemsError.message,
          order_id: order.id,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  }

  return new Response(
    JSON.stringify({ success: true, order_id: order.id, order }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};
