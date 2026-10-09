import type { Customer, OrderResult, SubmitResult, PosClient } from "./pos.ts";

export const createOrder = async (
  pos: PosClient,
  locationId: string,
  customer: Customer,
  item: string,
  quantity: number,
): Promise<OrderResult> => {
  const clientRef =
    `${locationId}:${customer.name}:${customer.phone}:${item}:${quantity}`.toLowerCase();

  const existingOrders = await pos.findOrdersByRef(clientRef);
  if (existingOrders.length > 0) {
    return {
      ok: true,
      created: false,
      orderId: existingOrders[0].id,
      total: existingOrders[0].total,
      note: "already existed",
    };
  }

  const menuItems = await pos.getMenu(locationId);
  const menuItem = menuItems.find(
    (i) => i.name.toLowerCase() === item.toLowerCase(),
  );

  if (!menuItem) {
    return {
      ok: false,
      reason: `Item ${item} not found in location ${locationId}`,
    };
  }
  if (!menuItem.available) {
    return {
      ok: false,
      reason: `Item ${item} is not available in location ${locationId}`,
    };
  }

  let result: SubmitResult;
  try {
    result = await pos.submitOrder({
      locationId,
      clientRef,
      customer,
      itemId: menuItem.id,
      quantity,
    });
  } catch (error) {
    const [existing] = await pos.findOrdersByRef(clientRef);
    if (existing) {
      return {
        ok: true,
        created: true,
        orderId: existing.id,
        total: existing.total,
        note: "POST errored, but a client_ref lookup confirmed the order exists.",
      };
    }
    throw error;
  }

  if (result.accepted) {
    return {
      ok: true,
      created: true,
      orderId: result.orderId,
      total: result.total,
    };
  }
  return {
    ok: false,
    reason: result.reason,
  };
};
