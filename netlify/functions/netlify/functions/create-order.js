// netlify/functions/create-order.js
//
// Requires these environment variables set in Netlify (Site settings > Environment variables):
//   SUPABASE_URL          - your Supabase project URL
//   SUPABASE_SERVICE_KEY   - your Supabase service role key (not the anon key —
//                            this function writes on the customer's behalf, so it
//                            needs write access without a logged-in user)
//
// Requires the "@supabase/supabase-js" package. Add it to package.json:
//   npm install @supabase/supabase-js

import { createClient } from "@supabase/supabase-js";

export default async (req, context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  const {
    place_name,
    place_address,
    place_phone,
    customer_name,
    customer_phone,
    delivery_address,
    fulfillment_type,
    notes,
    time_slot
  } = body;

  // Basic required-field validation
  const missing = [];
  if (!place_name) missing.push("place_name");
  if (!customer_name) missing.push("customer_name");
  if (!customer_phone) missing.push("customer_phone");
  if (!fulfillment_type) missing.push("fulfillment_type");
  if (!notes) missing.push("notes");
  if (fulfillment_type === "delivery" && !delivery_address) missing.push("delivery_address");

  if (missing.length) {
    return new Response(
      JSON.stringify({ error: `Missing required fields: ${missing.join(", ")}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Netlify.env.get("SUPABASE_URL");
  const supabaseKey = Netlify.env.get("SUPABASE_SERVICE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      JSON.stringify({ error: "Server is not configured (missing Supabase credentials)" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from("orders")
    .insert([{
      place_name,
      place_address: place_address || null,
      place_phone: place_phone || null,
      customer_name,
      customer_phone,
      delivery_address: delivery_address || null,
      fulfillment_type,
      notes,
      time_slot: time_slot || "asap",
      status: "pending"
    }])
    .select()
    .single();

  if (error) {
    return new Response(
      JSON.stringify({ error: "Could not save order", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ success: true, order: data }), {
    status: 201,
    headers: { "Content-Type": "application/json" }
  });
};

export const config = {
  path: "/.netlify/functions/create-order"
};
