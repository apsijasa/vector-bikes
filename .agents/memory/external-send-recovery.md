---
name: Recuperación de envíos externos
description: Límite de idempotencia de WhatsApp Cloud API y criterio para recuperar envíos inciertos en Autoscale.
---

No tratar un timeout, una instancia pausada o una concesión vencida como prueba de que un mensaje no salió. La recuperación requiere verificar el resultado externo y que el proceso original terminó antes de permitir otro intento.

**Why:** Meta Cloud API no ofrece una clave de idempotencia para este envío. Una fila única y bloqueos SQL evitan intentos concurrentes normales, pero no pueden deshacer un mensaje aceptado cuya respuesta se perdió. Una instancia suspendida también podría reanudarse después de vencer un plazo.

**How to apply:** Mantener bloqueados los resultados inciertos; usar evidencia explícita en la conciliación administrativa. Al ampliar proveedores o automatizar recuperación, no reemplazar esa verificación por un simple timeout. Separar aceptación de Meta de entrega efectiva al teléfono.