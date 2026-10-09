import type { Location, MenuItem, NewOrder, Order, PosClient, SubmitResult } from "../pos.ts";
import { send, VittlesError } from "./http.ts";
import { getToken } from "./auth.ts";

const api_version = "v1";

type RawMenuItem = {
  id: string;
  name: string;
  price: number | string;
  category: string;
  available: number | boolean;
};

type CreateOrderResponse =
  | ({ status: "ACCEPTED" } & Order)
  | { status: "REJECTED"; reason: string };

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const call = (token: string) =>
    send(path, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...init.headers },
    });

    let response = await call(await getToken());
    if (response.status === 401) {
        response = await call(await getToken(true));
    }

    if (!response.ok) {
        throw new VittlesError(`${init.method ?? "GET"} ${path} failed: ${response.status}.`, response.status);
    }
    return response.json() as Promise<T>;
};

export const getLocations = async (): Promise<Location[]> => {
  const locations: Location[] = [];
  let cursor: string | undefined;

  while (true) {
    const path: string =
      "/" + api_version + "/locations" + (cursor ? "?cursor=" + cursor : "");
    const res = await request<{ data: Location[]; next_cursor?: string }>(
      path,
      {
        method: "GET",
      },
    );
    locations.push(...res.data);
    if (!res.next_cursor) break;
    cursor = res.next_cursor;
  }
  return locations;
};

export const getMenu = async (locationId: string): Promise<MenuItem[]> => {
  const path = "/" + api_version + "/locations/" + locationId + "/menu";
  const res = await request<{ menuItems?: RawMenuItem[]; menu_items?: RawMenuItem[] }>(path, {
    method: "GET",
  });

  const items = res.menu_items ?? res.menuItems;
  if (!items) throw new VittlesError("Menu response missing menu_items", 502);

  return items.map((item) => ({
    id: item.id,
    name: item.name,
    price: Number(item.price),
    category: item.category,
    available: !!item.available,
  }));
};

const findOrdersByRef = async (clientRef: string): Promise<Order[]> => {
  const path = `/${api_version}/orders?client_ref=${encodeURIComponent(clientRef)}`;
  const res = await request<{ data: Order[] }>(path, { method: "GET" });
  return res.data;
};

const submitOrder = async (order: NewOrder): Promise<SubmitResult> => {
    const path = "/" + api_version + "/orders";
    const payload = {
        location_id: order.locationId,
        client_ref: order.clientRef,
        customer: order.customer,
        items: [
            {
                item_id: order.itemId,
                quantity: order.quantity,
            }
        ],
    };
    const res = await request<CreateOrderResponse>(path, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "X-Vittles-Location": order.locationId },
    });

    if (res.status === "ACCEPTED") {
        return {
            accepted: true,
            orderId: res.id,
            total: res.total,
        };
    }
    return {
        accepted: false,
        reason: res.reason,
    };
}



export const vittles: PosClient = {
    getLocations,
    getMenu,
    findOrdersByRef,
    submitOrder,
}