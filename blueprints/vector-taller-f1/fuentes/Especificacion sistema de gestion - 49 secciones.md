# Sistema de Gestión Integral — Vector Bikes

> Especificación original de requisitos, 49 secciones. Escrita por Andrés Psijas
> y entregada el 3 de octubre de 2026. Se conserva textual, sin editar, como
> fuente de la fase 1. Las decisiones que la modifican están en `../FASE1.md` §2.

---

## 1. Objetivo

Desarrollar una aplicación web interna para administrar integralmente la operación de Vector Bikes, desde que un cliente reserva una hora hasta que retira su bicicleta, manteniendo además el historial completo de cada cliente, bicicleta, componente, reparación, pago y mantenimiento futuro.

El sistema será inicialmente para una sola sucursal, con 2 mecánicos, administrador y recepción, pero deberá contemplar conceptualmente la futura incorporación de nuevas sucursales.

No existirá portal de clientes en esta primera etapa. La comunicación externa se concentrará principalmente en WhatsApp y secundariamente en correo electrónico.

---

## 2. Flujo principal del negocio

El flujo operativo será:

**Reserva web → Recepción → Inspección → Orden de trabajo → Presupuesto → Aprobación → Asignación a mecánico → Reparación → Control de calidad → Pago → Entrega → Informe final → Historial → Seguimiento futuro**

Estados principales:

**Reservada → Recibida → Diagnóstico/Inspección → Esperando aprobación → Esperando repuesto → En reparación → Control de calidad → Lista para retirar → Entregada**

También existirán estados excepcionales como cancelada o trabajo rechazado cuando corresponda.

---

# 3. Clientes

Cada cliente tendrá una ficha única.

Información:

- Nombre.
- RUT.
- Teléfono.
- Correo electrónico.
- Fecha de nacimiento.
- Canal por el cual conoció Vector Bikes.
- Bicicletas asociadas.
- Historial completo de visitas.
- Servicios realizados.
- Presupuestos.
- Pagos.
- Compras.
- Recomendaciones.
- Comunicaciones.
- Garantías.

Un cliente podrá tener múltiples bicicletas.

No existirán categorías como VIP, frecuente, etc.

---

# 4. Ficha de bicicleta

Cada bicicleta estará asociada a un cliente.

La información general será obligatoria, excepto el número de serie, considerando que puede estar borrado o ser ilegible.

Se registrará:

- Marca.
- Modelo.
- Año.
- Tipo de bicicleta.
- Talla.
- Color.
- Número de serie cuando exista.
- Kilometraje.
- Fotografías.
- Historial completo.

También podrá almacenar información específica de componentes cuando Vector Bikes haya trabajado directamente sobre ellos.

---

# 5. Historial de vida de la bicicleta

Una de las funciones centrales será mantener una línea de tiempo permanente.

Ejemplo:

**1.200 km — Mantención general**  
**2.300 km — Cambio de cadena**  
**3.800 km — Cambio de pastillas**  
**5.100 km — Servicio de suspensión**  
**5.800 km — Cambio de cadena y cassette**

Los componentes reemplazados nunca desaparecerán del historial.

Esto permitirá reconstruir completamente la evolución de cada bicicleta.

---

# 6. Registro de componentes

Cuando Vector Bikes instale un componente se creará un registro vinculado a la bicicleta.

Se almacenará:

- Tipo de componente.
- Marca.
- Modelo.
- Número de serie cuando corresponda.
- Fecha de instalación.
- Kilómetros de la bicicleta al instalarlo.
- Precio.
- Orden de trabajo donde fue instalado.
- Kilómetros recorridos posteriormente.
- Estado actual.
- Fecha de reemplazo cuando corresponda.

Componentes como cadenas, cassette, pastillas, neumáticos, suspensiones y otros podrán tener seguimiento individual.

---

# 7. Integración con Strava

Cada bicicleta podrá asociarse individualmente a la bicicleta correspondiente del cliente en Strava.

El sistema utilizará esa información para actualizar kilometraje y calcular utilización de los componentes.

Ejemplo:

**Cadena instalada:** 3.500 km  
**Kilometraje actual:** 5.100 km  
**Uso acumulado:** 1.600 km

El sistema permitirá clasificar componentes como:

**Bueno → Revisar pronto → Cambio recomendado → Crítico**

No se combinará inicialmente este cálculo con evaluación física automática del componente.

Cuando corresponda una revisión o cambio, podrá generarse una comunicación al cliente mediante WhatsApp.

---

# 8. Reserva

La reserva ya existe en vectorbikes.cl y continuará siendo el único mecanismo digital para que el cliente reserve.

El sistema recibirá desde allí:

- Cliente.
- Bicicleta.
- Servicio solicitado.
- Fecha.
- Hora.

También será posible registrar manualmente una reserva si fue recibida presencialmente, por teléfono o WhatsApp.

El recordatorio existente será enviado aproximadamente 2 horas antes.

---

# 9. Recepción de bicicleta

Cuando la bicicleta llegue al taller se realizará una recepción formal.

El mecánico o encargado:

1. Identifica al cliente.
2. Identifica la bicicleta.
3. Confirma el servicio solicitado.
4. Realiza inspección inicial.
5. Registra problemas adicionales.
6. Registra accesorios que fueron entregados junto con la bicicleta.
7. Toma fotografías.
8. Genera la orden de trabajo.
9. Define una fecha estimada de entrega propuesta por el sistema.
10. Obtiene firma digital de recepción del cliente.

No se requerirá una segunda autorización general de trabajo.

---

# 10. Inspección de recepción

Existirá un checklist estandarizado.

Debe contemplar como mínimo:

- Frenos.
- Cadena.
- Transmisión.
- Ruedas.
- Neumáticos.
- Estado general.
- Problemas visibles.
- Observaciones adicionales.

También se tomarán fotografías del estado en que ingresa la bicicleta.

Estas imágenes quedarán permanentemente asociadas a la orden.

---

# 11. Identificación física

Cada bicicleta recibirá una etiqueta física.

La etiqueta deberá incluir al menos:

- Número de orden.
- Cliente.
- Fecha estimada de entrega.
- Código QR.

Al escanear el QR, el personal autorizado podrá abrir directamente la orden correspondiente.

---

# 12. Presupuesto

Vector Bikes tendrá un catálogo previamente establecido de servicios y precios.

El mecánico no podrá modificar libremente esos valores.

Solo el administrador o dueño podrán modificar precios con los permisos correspondientes.

Para el cliente, el presupuesto mostrará un **valor total**, sin separar públicamente mano de obra y repuestos.

Internamente el sistema podrá conocer la composición económica del trabajo.

---

# 13. Trabajos adicionales

Si durante la reparación aparece un problema no informado inicialmente:

**el trabajo debe detenerse antes de realizar ese adicional.**

El cliente recibirá:

- Descripción del problema.
- Recomendación.
- Precio adicional.
- Solicitud de aprobación.

El cliente podrá aprobar o rechazar.

El sistema registrará:

- Fecha.
- Hora.
- Propuesta.
- Decisión.
- Evidencia de aprobación o rechazo.

No existirá un monto mínimo autorizado automáticamente.

Todo adicional requiere consentimiento.

Si el cliente rechaza una recomendación, ese rechazo quedará registrado en el historial de la bicicleta.

---

# 14. Orden de trabajo

Cada reparación tendrá una orden individual.

Debe incluir:

- Número único.
- Cliente.
- Bicicleta.
- Fotografías.
- Diagnóstico.
- Servicio solicitado.
- Servicios adicionales.
- Presupuesto.
- Aprobaciones.
- Mecánico responsable.
- Ayudantes mencionados en notas.
- Repuestos utilizados.
- Observaciones.
- Fecha de ingreso.
- Fecha prometida.
- Estado.
- Historial de cambios.
- Pago.
- Control final.

---

# 15. Asignación del mecánico

Cada orden tendrá un mecánico responsable.

Si otro mecánico participa, podrá registrarse en las notas.

La medición detallada de tiempos, pausas, cronómetros y productividad temporal se definirá posteriormente como un módulo independiente.

---

# 16. Fotografías

Las órdenes permitirán fotografías en diferentes etapas:

**Recepción → Durante reparación → Trabajo terminado**

Esto permitirá comparar claramente el antes y después.

Las fotografías formarán parte del historial permanente.

---

# 17. Control de calidad

Antes de declarar una bicicleta lista para retiro, deberá completarse un checklist de control final.

Inicialmente el mismo mecánico que realizó el trabajo podrá efectuar este control.

Solo después de aprobarlo podrá cambiar el estado a:

**Lista para retirar.**

---

# 18. Comunicación

Los principales canales serán:

**WhatsApp + correo electrónico**

WhatsApp será el principal.

Las automatizaciones ya diseñadas deberán conectarse posteriormente con los servicios correspondientes.

El sistema podrá comunicar:

- Confirmaciones.
- Estado del trabajo.
- Problemas adicionales.
- Presupuestos.
- Solicitudes de aprobación.
- Bicicleta lista.
- Recomendaciones futuras.
- Estado de mantenimiento de componentes.
- Solicitud de reseña.

Las comunicaciones deberán quedar registradas en el historial del cliente.

---

# 19. Asistente por WhatsApp

El asistente deberá poder responder consultas como:

- Estado actual de una bicicleta.
- Si está lista.
- Precio de servicios.
- Información general del taller.
- Recomendaciones de mantenimiento.

No realizará reservas.

La reserva continuará exclusivamente a través de vectorbikes.cl.

---

# 20. Informe posterior al servicio

Una vez finalizado el trabajo se generará un informe digital.

Debe contener:

- Datos de la bicicleta.
- Trabajo realizado.
- Problemas encontrados.
- Componentes reemplazados.
- Fotografías.
- Kilometraje.
- Recomendaciones.
- Próximas revisiones.
- Trabajos rechazados por el cliente, si existieron.

Este documento formará parte del historial de la bicicleta.

---

# 21. Catálogo de servicios

Existirá un catálogo maestro.

Cada servicio podrá definir:

- Nombre.
- Descripción.
- Precio.
- Duración estimada.
- Materiales habituales.
- Recomendaciones posteriores.

Los precios podrán variar según el tipo de bicicleta.

Por ejemplo:

**MTB / Ruta / Gravel / Urbana / E-bike**

---

# 22. Servicios contemplados

El sistema deberá poder administrar prácticamente cualquier trabajo relacionado con bicicletas, incluyendo:

- Mantenciones.
- Reparaciones.
- Bike fitting.
- Suspensiones.
- Lavado.
- Armado de bicicletas.
- Frenos.
- Transmisión.
- Ruedas.
- Tubeless.
- Bicicletas eléctricas.
- Otros servicios futuros.

---

# 23. Suspensiones

Las suspensiones podrán tener una ficha específica.

Se podrá registrar:

- Marca.
- Modelo.
- Número de serie.
- Bicicleta.
- Kilómetros.
- Horas de uso cuando exista información.
- Fecha del último servicio.
- Servicios realizados.
- Componentes reemplazados.
- Próximo mantenimiento recomendado.

---

# 24. Inventario

El sistema manejará inventario completo de:

- Repuestos.
- Accesorios.
- Productos.
- Bicicletas usadas.

Cada producto podrá contener:

- Código/SKU.
- Código de barras.
- Nombre.
- Marca.
- Proveedor.
- Costo actual.
- Precio de venta.
- Stock.
- Stock mínimo.
- Número de serie cuando corresponda.

No será necesario mantener historial de variación de costos de compra.

---

# 25. Consumo de repuestos

Cuando una pieza se utilice en una reparación:

**Orden de trabajo → repuesto utilizado → descuento automático de stock → registro en bicicleta**

Esto permitirá conocer exactamente qué componente fue instalado y en qué reparación.

---

# 26. Alertas de stock

Cuando el inventario llegue a un nivel mínimo establecido, se generará una alerta.

Esto permitirá iniciar una compra antes de quedarse sin un producto necesario.

---

# 27. Proveedores y compras

El sistema permitirá administrar:

- Proveedores.
- Solicitudes de compra.
- Órdenes de compra.
- Productos solicitados.
- Costos.
- Cantidades.
- Recepción.

Estados posibles:

**Solicitado → Comprado → En tránsito → Recibido**

Al recibir una compra se actualizará automáticamente el inventario.

También se registrarán cuentas pendientes con proveedores.

---

# 28. Etiquetas y códigos

El inventario admitirá:

- Códigos de barras.
- Lectura de productos.
- Impresión de etiquetas.
- Precios.
- Números de serie para productos de mayor valor.

---

# 29. Bicicletas usadas

Las bicicletas usadas serán propiedad de Vector Bikes.

No se administrará inicialmente consignación de bicicletas de terceros.

Cada bicicleta usada podrá registrar:

- Marca.
- Modelo.
- Año.
- Número de serie.
- Procedencia.
- Propietario anterior.
- Costo de adquisición.
- Trabajos realizados.
- Repuestos instalados.
- Costo de preparación.
- Precio de venta.
- Fotografías.
- Estado.
- Fecha de venta.

---

# 30. Caja

Existirá una interfaz tipo POS/caja.

Su objetivo será facilitar el cobro y registro de operaciones de Vector Bikes.

Según la definición actual, las ventas estarán asociadas a una operación registrada dentro del sistema y no se plantea por ahora una modalidad de venta anónima independiente.

---

# 31. Pagos

Se utilizarán:

- Transferencia.
- Tarjetas mediante Mercado Pago.

Una reparación podrá manejar:

**Primer abono + pago final**

Solo se permitirá un abono inicial.

Al momento de entregar la bicicleta, el saldo deberá ser **$0**.

El sistema no debería permitir completar la entrega mientras exista saldo pendiente.

---

# 32. Devoluciones

Será posible registrar:

- Devolución total.
- Devolución parcial.

Toda devolución deberá quedar auditada.

---

# 33. Descuentos

Solo podrán otorgarlos:

**Dueño y administrador**

Cada descuento deberá registrar:

- Responsable.
- Monto o porcentaje.
- Motivo.
- Fecha.

---

# 34. Documentos tributarios

La aplicación no emitirá directamente boletas o facturas inicialmente.

Sí permitirá guardar:

- Tipo de documento.
- Número.
- Fecha.
- Referencia correspondiente.

---

# 35. Garantías

El sistema permitirá manejar garantías de:

- Servicios.
- Repuestos.

El plazo y condiciones se definirán posteriormente según corresponda legalmente y según cada servicio.

Cuando una bicicleta vuelva por garantía, se abrirá una nueva orden vinculada a la orden original.

Esto permitirá diferenciar claramente:

**trabajo nuevo vs. corrección en garantía.**

---

# 36. Dashboard del administrador

Al ingresar deberá mostrar inmediatamente:

- Reservas de hoy.
- Ingresos de bicicletas de hoy.
- Bicicletas en taller.
- Esperando aprobación.
- Esperando repuesto.
- En reparación.
- Control de calidad pendiente.
- Listas para retiro.
- Reparaciones atrasadas.
- Próximas entregas.
- Carga por mecánico.
- Capacidad disponible.
- Ventas del día.
- Pagos pendientes.
- Stock crítico.
- Alertas de mantenimiento.

---

# 37. Dashboard del mecánico

Debe ser más operativo.

Principalmente:

- Próximos ingresos.
- Bicicletas asignadas.
- Trabajos pendientes.
- Trabajos atrasados.
- Esperando aprobación.
- Esperando repuestos.
- Trabajos próximos a entrega.
- Control de calidad pendiente.

---

# 38. Gestión de capacidad

El sistema utilizará:

- Duración estimada del servicio.
- Cantidad de trabajos.
- Disponibilidad de mecánicos.
- Estado de las órdenes.

Con ello propondrá automáticamente una fecha probable de entrega.

Esta fecha podrá utilizarse durante la recepción para informar al cliente.

---

# 39. Alertas operativas

Existirán alertas para:

- Trabajo atrasado.
- Fecha comprometida próxima.
- Presupuesto sin respuesta.
- Falta de repuestos.
- Stock crítico.
- Pago pendiente.
- Garantía.
- Mantenimiento futuro.

---

# 40. Indicadores del negocio

El dueño podrá analizar:

- Ventas.
- Utilidad.
- Ticket promedio.
- Bicicletas atendidas.
- Horas trabajadas.
- Margen.
- Productividad por mecánico.
- Servicios más vendidos.
- Clientes con mayor gasto.
- Frecuencia de retorno.
- Tiempo promedio entre recepción y entrega.

No es prioridad inicialmente medir específicamente el tiempo que las bicicletas permanecen esperando aprobación o repuestos.

Tampoco es necesario inicialmente realizar comparaciones avanzadas entre períodos.

---

# 41. Roles

## Dueño

Acceso total.

Puede ver:

- Ventas.
- Costos.
- Márgenes.
- Rentabilidad.
- Inventario.
- Clientes.
- Pagos.
- Métricas.

Puede modificar precios y descuentos.

---

## Administrador

Gestiona prácticamente toda la operación.

Puede:

- Gestionar clientes.
- Órdenes.
- Inventario.
- Pagos.
- Descuentos.
- Precios.
- Compras.
- Agenda.

Puede ver precios de venta.

Los permisos financieros avanzados podrán configurarse posteriormente.

---

## Recepción

Puede manejar:

- Clientes.
- Bicicletas.
- Reservas.
- Recepción.
- Pagos.
- Precios de venta.
- Estados de órdenes.

No deberá ver costos ni márgenes.

---

## Mecánico

Puede:

- Ver sus trabajos.
- Revisar órdenes.
- Registrar diagnósticos.
- Agregar fotografías.
- Registrar reparaciones.
- Registrar componentes.
- Completar controles.
- Ver precios de los trabajos.

No verá inicialmente costos, márgenes ni rentabilidad.

---

# 42. Auditoría

Las operaciones importantes deben dejar registro.

Especialmente:

- Cambio de precios.
- Descuentos.
- Modificaciones de órdenes.
- Cambios de stock.
- Pagos.
- Devoluciones.
- Aprobaciones de clientes.
- Cambios de estado.
- Garantías.

Debe registrarse quién realizó cada acción y cuándo.

---

# 43. Reseñas de Google

Después de completar satisfactoriamente un servicio podrá enviarse automáticamente una solicitud para que el cliente evalúe Vector Bikes en Google.

---

# 44. Recuperación de clientes

El sistema podrá detectar clientes que llevan un período determinado sin regresar.

Permitirá generar campañas de recuperación utilizando información como:

- Último servicio.
- Kilometraje.
- Componentes.
- Tiempo desde última mantención.

---

# 45. Convenios

El sistema podrá administrar en el futuro convenios con:

- Clubes.
- Equipos.
- Empresas.
- Organizaciones.

Podrán tener condiciones comerciales específicas.

---

# 46. E-commerce futuro

La aplicación deberá contemplar una futura integración con una tienda online.

No será parte prioritaria de la primera versión.

---

# 47. Nuevas sucursales

Aunque inicialmente Vector Bikes tendrá una sola ubicación, el modelo funcional deberá permitir posteriormente varias sucursales.

Cada sucursal podrá tener:

- Agenda propia.
- Mecánicos.
- Inventario.
- Caja.
- Órdenes.
- Estadísticas.

El cliente seguirá siendo único dentro de Vector Bikes.

Esto significa que podrá visitar otra sucursal y conservar:

**cliente → bicicletas → componentes → historial → garantías → servicios**

---

# 48. Funciones que NO forman parte inicialmente

Quedan fuera de la primera etapa:

- Portal privado para clientes.
- Programa de puntos.
- Membresías.
- Planes anuales.
- Consignación de bicicletas.
- Emisión tributaria directamente desde la aplicación.
- Clasificación VIP de clientes.
- Automatización completa del diagnóstico físico.
- Cronometraje detallado de mecánicos.
- Comparativas financieras avanzadas por períodos.

---

# 49. Principio central del sistema

La unidad principal de información no debe ser solamente la reparación.

Debe ser:

**CLIENTE → BICICLETA → COMPONENTES → HISTORIAL**

Cada nueva reparación agrega información a esa línea de vida.

De esta manera Vector Bikes podrá saber no solamente qué se hizo hoy, sino también:

- cuándo se instaló una pieza,
- cuántos kilómetros lleva,
- qué trabajos se han realizado,
- qué recomendaciones fueron rechazadas,
- cuándo corresponde una próxima mantención,
- cuánto ha gastado el cliente,
- y qué servicios probablemente necesitará posteriormente.

Esto convierte el sistema de una simple agenda de taller en una plataforma de administración y mantenimiento continuo de las bicicletas de los clientes.
