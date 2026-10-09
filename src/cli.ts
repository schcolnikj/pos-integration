import { parseArgs } from "util";
import { createOrder } from "./order.ts";
import { vittles } from "./vittles/client.ts";
import type { OrderResult } from "./pos.ts";

let values;
try {
  ({ values } = parseArgs({
    options: {
      item: { type: "string" },
      quantity: { type: "string" },
      location: { type: "string" },
    },
  }));
} catch (error) {
  console.error(
    "Invalid arguments:",
    error instanceof Error ? error.message : String(error),
  );
  console.log(
    'Usage: npm start -- [--item <name>] [--location <id>] [--quantity <n>]',
  );
  process.exit(1);
}

const itemName = values.item?.trim();
const itemQuantity = values.quantity ? Number(values.quantity) : 2;
const locationId = values.location?.trim();

const createOrders = async () => {
  const results: (OrderResult & { location: string })[] = [];
  const customer = { name: "John Doe", phone: "1234567890" };
  const locations: string[] = [];

  if (!itemName) {
    console.log('Error creating order: Item name is required.');
    console.log('Usage: npm start -- [--item <name>] [--location <id>] [--quantity <n>]');
    process.exit(1);
  }

  if (
    isNaN(itemQuantity) ||
    itemQuantity <= 0 ||
    !Number.isInteger(itemQuantity)
  ) {
    console.log('Error creating order: Quantity must be a positive number.');
    console.log(
      'Usage: npm start -- [--item <name>] [--location <id>] [--quantity <n>]',
    );
    process.exit(1);
  }

  if (locationId) {
    locations.push(locationId);
  } else {
    const allLocations = await vittles.getLocations().catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
    locations.push(...allLocations.filter((l) => l.active).map((l) => l.id));
  }

  for (const location of locations) {
    try {
      const order = await createOrder(
        vittles,
        location,
        customer,
        itemName,
        itemQuantity,
      );
      results.push({ location, ...order });
    } catch (error) {
      results.push({ location, ok: false, reason: String(error) });
    }
  }
  console.table(results);
};

await createOrders();
