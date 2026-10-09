# Ejercicio — Integracion contra Vittles POS (ficticio)

Todo lo que necesitas esta en esta carpeta. No hace falta ninguna cuenta, ninguna API key
real ni acceso a ningun sistema de HeyTruffle.

## Que hay acá

* `mock_server.py` — la API de Vittles POS corriendo local. Solo libreria estandar de Python
  (3.9+). No instala nada.
* `API_DOCS.md` — la documentacion oficial de Vittles, tal como la publicaron.

## Como levantarlo

```bash
python3 mock_server.py
# Vittles POS mock escuchando en http://localhost:8422
```

Credenciales: `client_id=partner-demo`, `client_secret=s3cr3t-demo`.

## Que te pedimos

Escribi una integracion chica (el lenguaje es tu decision) que:

1. Se autentique.
2. Traiga **todas** las locations.
3. Traiga el menu de cada location.
4. Cree **una orden por location** con el item que te pasamos por parametro
   (por nombre, ej. `--item "Buffalo Wings (12)"`), cantidad 2.
5. Imprima un resumen final: por location, si la orden se creo, el id y el total.

Tiene que poder correr dos veces seguidas sin duplicar ordenes.

## Entregables

* El codigo, corriendo contra el mock (decinos el comando exacto).
* Un README de media pagina: las decisiones que tomaste y por qué.
* Una lista de lo que dejaste afuera a proposito.

Podes usar IA. Solo pedimos que lo declares y que en la etapa 2 puedas defender cada linea.

## Aviso

La documentacion tiene errores. El comportamiento real de la API es la fuente de verdad.
Parte del ejercicio es que encuentres las diferencias y decidas qué hacer con cada una.
