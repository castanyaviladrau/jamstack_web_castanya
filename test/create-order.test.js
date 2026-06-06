const test = require("node:test");
const assert = require("node:assert/strict");

function freshRequire(modulePath) {
  delete require.cache[require.resolve(modulePath)];
  return require(modulePath);
}

test("create-order handler stores pickup fulfillment fields", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

  const originalFetch = global.fetch;
  const fetchCalls = [];
  global.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options });

    if (String(url).includes("/rest/v1/orders?select=*")) {
      return {
        ok: true,
        json: async () => [
          {
            id: "order-pickup-1",
            public_order_code: "CV-TEST-PICKUP",
            status: "pending_payment",
            payment_status: "pending",
            currency: "EUR",
          },
        ],
      };
    }

    if (String(url).includes("/rest/v1/order_items")) {
      return {
        ok: true,
        json: async () => null,
      };
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  };

  try {
    const mod = freshRequire("../netlify/functions/create-order.js");
    const response = await mod.handler({
      httpMethod: "POST",
      body: JSON.stringify({
        items: [{ sku: "castanya-viladrau-torrada-250", quantity: 2 }],
        customer: {
          name: "Buyer",
          email: "buyer@example.com",
          phone: "+34123456789",
          country: "Espanya",
          address: "Carrer Major 1",
          city: "Viladrau",
          postalCode: "17406",
          isPickup: "on",
          pickupStore: "Barcelona",
          notes: "Pickup after 5pm",
        },
      }),
    });

    assert.equal(response.statusCode, 200);
    const orderInsertPayload = JSON.parse(fetchCalls[0].options.body);
    assert.equal(orderInsertPayload.fulfillment_method, "pickup");
    assert.equal(orderInsertPayload.pickup_store, "Barcelona");
    assert.deepEqual(orderInsertPayload.shipping_address_json, {
      address_line_1: "Carrer Major 1",
      city: "Viladrau",
      postal_code: "17406",
      country: "Espanya",
    });

    const orderItemsPayload = JSON.parse(fetchCalls[1].options.body);
    assert.equal(orderItemsPayload[0].sku, "castanya-viladrau-torrada-250");
  } finally {
    global.fetch = originalFetch;
  }
});

test("create-order handler rejects invalid pickup store", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("Fetch should not be called for invalid payloads");
  };

  try {
    const mod = freshRequire("../netlify/functions/create-order.js");
    const response = await mod.handler({
      httpMethod: "POST",
      body: JSON.stringify({
        items: [{ sku: "castanya-viladrau-torrada-250", quantity: 1 }],
        customer: {
          name: "Buyer",
          email: "buyer@example.com",
          phone: "+34123456789",
          country: "Espanya",
          address: "Carrer Major 1",
          city: "Viladrau",
          postalCode: "17406",
          isPickup: "on",
          pickupStore: "Madrid",
        },
      }),
    });

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.details, "Invalid pickup store");
  } finally {
    global.fetch = originalFetch;
  }
});

test("create-order handler rejects shipping orders below 50 EUR", async () => {
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";

  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("Fetch should not be called for invalid payloads");
  };

  try {
    const mod = freshRequire("../netlify/functions/create-order.js");
    const response = await mod.handler({
      httpMethod: "POST",
      body: JSON.stringify({
        items: [{ sku: "castanya-viladrau-torrada-250", quantity: 1 }],
        customer: {
          name: "Buyer",
          email: "buyer@example.com",
          phone: "+34123456789",
          country: "Espanya",
          address: "Carrer Major 1",
          city: "Viladrau",
          postalCode: "17406",
        },
      }),
    });

    assert.equal(response.statusCode, 400);
    const body = JSON.parse(response.body);
    assert.equal(body.details, "Minimum shipping order amount is 50 EUR");
  } finally {
    global.fetch = originalFetch;
  }
});
