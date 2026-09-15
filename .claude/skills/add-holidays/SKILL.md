---
name: add-holidays
description: Cargar los feriados nacionales de Chile de un año nuevo (por ejemplo 2027) en Vector Bikes. Usar cuando el panel admin avisa que faltan feriados o cuando se publican los feriados oficiales del año siguiente.
---

# Agregar feriados de un año

## Cuándo usar
- `/admin` muestra "Las reservas llegan a <año> y ese año no tiene feriados cargados".
- Se publicaron oficialmente los feriados del año siguiente.

## Pasos
1. Obtener la lista oficial del año en dos fuentes (https://www.feriadoslegales.cl/ y https://festivos.online/chile/) y confirmar que coinciden. No inventar fechas.
2. Agregar cada feriado a `src/data/feriados-cl.json` como `{ "date": "AAAA-MM-DD", "name": "…" }`, en orden cronológico.
3. En `tests/unit/slots.test.ts`, agregar una aserción con un feriado del año nuevo (`computeDay` devuelve `status: "holiday"`) y actualizar la aserción de `missingHolidayYears` si ese año dejó de faltar.
4. Ejecutar `pnpm gate`, hacer commit y publicar (los feriados viajan en el build).

## Verify
```bash
pnpm test tests/unit/slots.test.ts   # expect: exit 0, 0 failed
pnpm gate                            # expect: exit 0
```

## No hacer
- Cargar feriados regionales o no confirmados oficialmente.
- Borrar años anteriores del archivo.
