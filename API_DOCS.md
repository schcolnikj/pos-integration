# Vittles POS — Partner API

**Version 1.2** · Last updated: 2024-11-08 · Contact: api@vittles.example (respuesta en 3-5 dias habiles)

> Nota: esta documentacion es ficticia y fue escrita a proposito con errores, huecos y
> afirmaciones desactualizadas. Es parte del ejercicio.

## Getting started

The Vittles Partner API lets you read locations, read menus and push orders.
Base URL: `http://localhost:8422`

All endpoints return JSON. All requests must include the header:

```
Authorization: Bearer <access_token>
```

## Authentication

```
POST /oauth/token
Content-Type: application/json

{ "client_id": "partner-demo", "client_secret": "s3cr3t-demo" }
```

Response:

```json
{ "access_token": "…", "token_type": "bearer", "expires_in": 3600 }
```

Tokens are valid for 1 hour.

## Locations

```
GET /v1/locations
```

Returns every location for the authenticated partner.

```json
{
  "data": [
    { "id": "loc_1001", "name": "Vittles Demo — Midtown", "timezone": "America/New_York", "active": true }
  ]
}
```

## Menu

```
GET /v1/locations/{location_id}/menu
```

Response:

```json
{
  "menu_items": [
    { "id": "itm_88", "name": "Buffalo Wings (12)", "price": 15.50, "available": true, "category": "wings" }
  ]
}
```

`price` is a decimal number in USD. `available` is a boolean.

## Create an order

```
POST /v1/orders
Content-Type: application/json

{
  "location_id": "loc_1001",
  "client_ref": "your-own-unique-id",
  "customer": { "name": "Jane D.", "phone": "+13055550101" },
  "items": [ { "item_id": "itm_88", "quantity": 2 } ]
}
```

* Returns `201` with the created order.
* Returns `400` with `{ "error": … }` if the payload is invalid.
* `client_ref` makes the call **idempotent**: repeating the same `client_ref` returns the
  original order instead of creating a new one.

## Read an order

```
GET /v1/orders/{order_id}
```

```json
{
  "id": "ord_5501",
  "status": "ACCEPTED",
  "created_at": "2026-03-04T19:12:00Z",
  "total": 31.00
}
```

`created_at` is UTC (ISO-8601).

## Rate limits

The API allows 60 requests per minute per token. Over the limit you get `429` and a
`Retry-After` header, in seconds.

## Errors

| Code | Meaning |
| --- | --- |
| 400 | Invalid payload |
| 401 | Missing or expired token |
| 404 | Unknown resource |
| 429 | Rate limited |
| 500 | Something went wrong on our side. Please retry. |

## Changelog

* **1.2** — added `category` to menu items.
* **1.1** — added `GET /v1/orders/{id}`.
* **1.0** — initial release.
