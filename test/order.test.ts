import { test } from "node:test";
import assert from "node:assert/strict";
import { createOrder } from "../src/order.ts";
import { send } from "../src/vittles/http.ts";
import { vittles } from "../src/vittles/client.ts";
import type { Order, PosClient } from "../src/pos.ts";

const customer = { name: "John Doe", phone: "1234567890" };
const wings = {
  id: "itm_88",
  name: "Buffalo Wings (12)",
  price: 15.5,
  category: "wings",
  available: true,
};
const order = (pos: PosClient, item = "Buffalo Wings (12)") =>
  createOrder(pos, "loc_1", customer, item, 2);

// In-memory POS that, like Vittles, creates a new order on every submit.
const fakePos = () => {
  const orders: (Order & { ref: string })[] = [];
  const pos: PosClient = {
    getLocations: async () => [],
    getMenu: async () => [wings],
    findOrdersByRef: async (ref) => orders.filter((o) => o.ref === ref),
    submitOrder: async (o) => {
      orders.push({
        id: `ord_${orders.length + 1}`,
        total: 31,
        ref: o.clientRef,
      });
      return { accepted: true, orderId: `ord_${orders.length}`, total: 31 };
    },
  };
  return { pos, orders };
};

test("running twice creates only one order", async () => {
  const { pos, orders } = fakePos();
  const first = await order(pos);
  const second = await order(pos);
  assert.equal(orders.length, 1);
  assert.ok(first.ok && first.created);
  assert.ok(second.ok && !second.created);
  assert.equal(second.orderId, first.orderId);
});

test("POST errors but the order was created: reported as created", async () => {
  const { pos, orders } = fakePos();
  pos.submitOrder = async (o) => {
    orders.push({ id: "ord_1", total: 31, ref: o.clientRef });
    throw new Error("503");
  };
  const result = await order(pos);
  assert.ok(result.ok && result.created);
  assert.equal(result.orderId, "ord_1");
});

test("POST errors and no order exists: throws so the run fails", async () => {
  const { pos } = fakePos();
  pos.submitOrder = async () => {
    throw new Error("503");
  };
  await assert.rejects(order(pos), /503/);
});

test("unknown or unavailable item is never submitted", async () => {
  const { pos, orders } = fakePos();
  const unknown = await order(pos, "Pizza");
  pos.getMenu = async () => [{ ...wings, available: false }];
  const unavailable = await order(pos);
  assert.equal(orders.length, 0);
  assert.ok(!unknown.ok && unknown.reason.includes("not found"));
  assert.ok(!unavailable.ok && unavailable.reason.includes("not available"));
});

test("rejected order is reported with the POS reason", async () => {
  const { pos } = fakePos();
  pos.submitOrder = async () => ({
    accepted: false,
    reason: "item not on this menu",
  });
  assert.deepEqual(await order(pos), {
    ok: false,
    reason: "item not on this menu",
  });
});

test("a 5xx on POST is not retried, since the order may already exist", async (t) => {
  const fetch = t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("{}", { status: 503 }),
  );
  const res = await send("/v1/orders", { method: "POST" });
  assert.equal(res.status, 503);
  assert.equal(fetch.mock.callCount(), 1);
});

test("a GET retries after a 5xx and after a 429", async (t) => {
  const responses = [
    new Response("{}", { status: 500 }),
    new Response("{}", { status: 429, headers: { "Retry-After-Ms": "1" } }),
    new Response("{}"),
  ];
  const fetch = t.mock.method(globalThis, "fetch", async () =>
    responses.shift()!,
  );
  const res = await send("/v1/locations", { method: "GET" });
  assert.equal(res.status, 200);
  assert.equal(fetch.mock.callCount(), 3);
});

test("a 401 gets a fresh token and retries once", async (t) => {
  process.env.VITTLES_CLIENT_ID = "id";
  process.env.VITTLES_CLIENT_SECRET = "secret";
  let tokens = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).endsWith("/oauth/token")) {
        return Response.json({ access_token: `t${++tokens}`, expires: 90 });
      }
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === "Bearer t1"
        ? new Response("{}", { status: 401 })
        : Response.json({ menuItems: [wings] });
    },
  );
  const menu = await vittles.getMenu("loc_1");
  assert.equal(menu.length, 1);
  assert.equal(tokens, 2);
});
