// netlify/functions/orders.js
//
// Server-side proxy for the orders table. The browser never sees the
// Supabase URL or keys; all reads/writes go through this function using
// the service-role key stored in Netlify environment variables.
//
// Supported operations (driver page):
//   GET  /.netlify/functions/orders            -> list open orders
//   GET  /.netlify/functions/orders?id=<uuid>   -> fetch one order (payment-status checks)
//   POST /.netlify/functions/orders            -> create a new pickup order
//   PATCH /.netlify/functions/orders?id=<uuid> -> update fee / status of an order
//
// Only the fields the driver UI needs are accepted. Status transitions are
// restricted to the pickup-model workflow.

const ALLOWED_STATUSES = new Set([
  'confirmed',
  'preparing',
  'awaiting_payment',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'cancelled'
]);

const CREATE_FIELDS = new Set([
  'customer_name',
  'customer_phone',
  'store_name',
  'order_type',
  'mode',
  'pickup_code',
  'pickup_window',
  'delivery_address',
  'final_total',
  'payment_status',
  'status'
]);

const PATCH_FIELDS = new Set(['final_total', 'status']);

const OPEN_STATUSES = ['confirmed', 'preparing', 'awaiting_payment'];

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function serviceHeaders() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return {
    base: url.replace(/\/$/, ''),
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json'
    }
  };
}

async function supabaseFetch(svc, path, options = {}) {
  const res = await fetch(svc.base + path, {
    ...options,
    headers: { ...svc.headers, ...(options.headers || {}) }
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

const cleanString = (v, max = 200) =>
  typeof v === 'string' ? v.trim().slice(0, max) : undefined;

exports.handler = async (event) => {
  const svc = serviceHeaders();
  if (!svc) return json(500, { error: 'server misconfigured' });

  const method = event.httpMethod.toUpperCase();
  const id = event.queryStringParameters && event.queryStringParameters.id;

  try {
    // ---- READ ----
    if (method === 'GET') {
      if (id) {
        const { ok, data } = await supabaseFetch(
          svc,
          `/rest/v1/orders?id=eq.${encodeURIComponent(id)}&select=id,customer_name,customer_phone,store_name,order_type,mode,pickup_code,pickup_window,delivery_address,final_total,payment_status,status,created_at`
        );
        if (!ok || !Array.isArray(data) || data.length === 0) {
          return json(404, { error: 'order not found' });
        }
        return json(200, data[0]);
      }
      const statuses = OPEN_STATUSES.map(s => encodeURIComponent(s)).join(',');
      const { ok, data } = await supabaseFetch(
        svc,
        `/rest/v1/orders?order_type=eq.shopping_list&status=in.(${statuses})&order=created_at.asc&select=id,customer_name,customer_phone,store_name,order_type,mode,pickup_code,pickup_window,delivery_address,final_total,payment_status,status,created_at`
      );
      if (!ok) return json(502, { error: 'failed to load orders' });
      return json(200, data);
    }

    // ---- CREATE ----
    if (method === 'POST') {
      let body = {};
      try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'invalid JSON' }); }

      const payload = {};
      for (const key of CREATE_FIELDS) {
        if (body[key] === undefined) continue;
        payload[key] = typeof body[key] === 'number' ? body[key] : cleanString(body[key]);
      }

      if (!payload.customer_name || !payload.store_name) {
        return json(400, { error: 'customer_name and store_name are required' });
      }
      payload.order_type = 'shopping_list';
      payload.mode = payload.mode === 'delivery' ? 'delivery' : 'pickup';
      if (typeof payload.final_total !== 'number' || !(payload.final_total >= 0)) {
        payload.final_total = 0;
      }
      if (payload.status && !ALLOWED_STATUSES.has(payload.status)) {
        return json(400, { error: 'invalid status' });
      }
      if (!payload.status) payload.status = 'confirmed';
      if (payload.payment_status && !['unpaid', 'paid'].includes(payload.payment_status)) {
        return json(400, { error: 'invalid payment_status' });
      }

      const { ok, status, data } = await supabaseFetch(
        svc,
        '/rest/v1/orders',
        { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(payload) }
      );
      if (!ok) return json(status || 502, { error: 'failed to create order' });
      return json(200, Array.isArray(data) ? data[0] : data);
    }

    // ---- UPDATE ----
    if (method === 'PATCH') {
      if (!id) return json(400, { error: 'missing id' });
      let body = {};
      try { body = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'invalid JSON' }); }

      const patch = {};
      for (const key of PATCH_FIELDS) {
        if (body[key] === undefined) continue;
        patch[key] = key === 'final_total' ? body[key] : cleanString(body[key], 50);
      }
      if (Object.keys(patch).length === 0) {
        return json(400, { error: 'nothing to update' });
      }
      if (patch.status && !ALLOWED_STATUSES.has(patch.status)) {
        return json(400, { error: 'invalid status' });
      }
      if (patch.final_total !== undefined &&
          (typeof patch.final_total !== 'number' || !(patch.final_total >= 0))) {
        return json(400, { error: 'invalid final_total' });
      }

      const { ok, status } = await supabaseFetch(
        svc,
        `/rest/v1/orders?id=eq.${encodeURIComponent(id)}`,
        { method: 'PATCH', body: JSON.stringify(patch) }
      );
      if (!ok) return json(status || 502, { error: 'failed to update order' });
      return json(200, { ok: true });
    }

    return json(405, { error: 'method not allowed' });
  } catch (err) {
    console.error('orders function error:', err);
    return json(500, { error: 'server error' });
  }
};
