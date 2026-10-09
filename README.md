# Integración con Vittles POS

CLI en TypeScript que se autentica, trae todas las locations y, en cada location activa (o solo en `--location`), busca el item en el menú y crea una orden. Después imprime un resumen. Correrlo dos veces no duplica órdenes.

## Cómo correrlo

Node 22.18+ (ejecuta los `.ts` directamente, no hay que instalar nada) y Python 3.9+. El mock server, `API_DOCS.md` y la consigna original (`EXERCISE.md`) están incluidos.

```bash
cp .env.example .env.local   # credenciales de demo
python3 mock_server.py       # terminal 1
npm start                    # terminal 2: "Buffalo Wings (12)", cantidad 2, todas las locations activas
```

En Windows (cmd o PowerShell):

```bat
copy .env.example .env.local
py mock_server.py
npm start
```

Opciones: `npm start -- --item "<nombre>" [--location <id>] [--quantity <n>]`. Con npm hace falta el `--` para que los flags lleguen al script; con pnpm no (`pnpm start --item "<nombre>"`).

Tests: `npm test` (no necesitan el mock server).

## Explorando la API

Probé cada endpoint en Postman y anoté dónde difería de la documentación:

| Docs | Realidad |
|---|---|
| El token dura 1h (`expires_in`) | 90s (`expires`) |
| Las locations vienen en una sola respuesta | Paginadas: `next_cursor`, que se reenvía como `?cursor=` |
| `menu_items`, `price` numérico, `available` booleano | `menuItems`, price número o string, `available` booleano o 0/1 |
| Una orden inválida devuelve `400` | `200` con `status: "REJECTED"` y un `reason` |
| Repetir un `client_ref` devuelve la orden original | Cada POST crea una orden nueva |
| 60 req/min, `Retry-After` en segundos | Menos de 60/min, `Retry-After-Ms` |
| `created_at` está en UTC | Tiene la marca de UTC (la `Z`) pero usa la hora local de la máquina |

Directamente no documentado: las órdenes necesitan un header `X-Vittles-Location` igual al `location_id` del body. El rechazo "missing location context" primero me hizo buscar datos faltantes en el body; se lo planteé a Claude y me ayudó a llegar a la solución: era un header, obligatorio en los dos lugares (mi primera idea fue sacar `location_id` del body una vez que estaba en el header). Además, los menús fallan al azar con `500` y devuelven `403` para locations inactivas.

## Decisiones

- **Estructura por responsabilidad**, separando lo propio de Vittles de las reglas del ejercicio:
  - `src/cli.ts` orquesta: argumentos, locations, órdenes, resumen. Si una location falla, aparece como una fila en el resumen en lugar de cortar la ejecución.
  - `src/order.ts` tiene las reglas: la clave anti-duplicados, buscar el item, chequear disponibilidad y, si el POST falla, verificar si la orden se creó igual.
  - `src/pos.ts` define los tipos que usa el programa y la interfaz `PosClient`, que cualquier POS tiene que cumplir.
  - `src/vittles/` es lo único que sabe que Vittles existe: `auth.ts` (token de 90s y su renovación), `http.ts` (timeouts y reintentos solo de lo que es seguro repetir: un 429 esperando `Retry-After-Ms`, y un 5xx o la falta de respuesta solo en GETs; un POST así no se reintenta porque la orden pudo haberse creado) y `client.ts` (endpoints, paginación, y el mapeo de los datos tal como vienen a los tipos de `pos.ts`).
- **Auth y HTTP viven dentro de `vittles/`** porque son de Vittles: Toast tendría su propio login y sus propios límites. Por la misma razón los tipos crudos de la API (`price: number | string`) quedan en `client.ts` y `pos.ts` solo tiene los limpios. La intención es que un segundo POS sea otra carpeta que cumpla `PosClient`. Todavía no es del todo así: el check-then-create de `order.ts` existe porque Vittles ignora `client_ref`; con un POS que respete idempotency keys, esa lógica pasaría al adapter de Vittles.
- **Idempotencia:** la API ignora `client_ref`, así que armo uno con location, cliente, item y cantidad, y consulto `GET /v1/orders?client_ref=` antes de crear. Noté que `GET /v1/orders` devolvía `[]` justo después de haber creado una orden, y Claude me ayudó a encontrar la búsqueda por `client_ref`.
- **Aceptar los nombres de campo de los docs y los reales.** Donde solo cambia el nombre, leo los dos: `menu_items ?? menuItems` y `expires_in ?? expires`. Si Vittles corrige la API para que coincida con los docs, la integración sigue andando sin cambios. Si no viene ninguno de los dos, falla con un error claro en lugar de un `undefined.map` o un `expiresAt` en `NaN`, que haría pedir un token nuevo en cada request.

## Lo que dejé afuera a propósito

- **Idempotency keys del lado del servidor.** Mi key trata como duplicado a un cliente que realmente quiere repetir una orden. Además, check-then-create tiene una condición de carrera si dos ejecuciones se superponen, y reintentar el POST de una orden después de un 5xx o un timeout no se puede hacer seguro desde el cliente. Las tres cosas necesitan una key que el servidor respete.
- **Persistencia.** La deduplicación depende de la memoria del servidor; si se reinicia, se olvida.
- **Esperar a que se libere el rate limit.** Los reintentos son acotados y después falla con un mensaje claro.
- **Concurrencia.** Las llamadas secuenciales alcanzan para cinco locations.

## Uso de IA

Usé Claude Code principalmente como revisor:

- Por la naturaleza del ejercicio, me parecio sensato limitar el uso de IA en la implementación y dejarlo como método de revisión y herramienta para explorar la API.
- Mi primer pedido fue un chequeo de seguridad de `mock_server.py`, así que Claude ya había leído el servidor cuando me ayudó a resolver el header de location y la búsqueda por `client_ref`. Todo lo del cuadro lo verifiqué yo en Postman.
- Sus revisiones y asistencias me ayudaron a encontrar bugs y discrepancias como el vencimiento del token temprano, headers por request que se pisaban en `request`, el uso de Location como header para crear ordenes, y un `client_ref` sin encodear en el query string.
- Sugirió unificar los casos de una location y de todas en un solo loop, y me ayudó con la lógica de reintentos. Cuando editó código sin que se lo pidiera, lo revertí y escribí el cambio yo. También me ayudó a pasar mis notas a este README.
- Los tests (`test/order.test.ts`) los escribió Claude completos, a partir de los casos que le pedí: idempotencia y los caminos de error. Los revisé yo, y comprobamos que fallan si se reintroducen los bugs que cubren.
