# Sistema de Gestión Integral Vector Bikes
## Análisis técnico del documento de requisitos

**Fecha:** 3 de octubre de 2026
**Documento analizado:** "Sistema de Gestión Integral — Vector Bikes", 49 secciones
**Contexto:** el sitio público de reservas (vectorbikes.cl) está terminado y en producción desde el 17 de septiembre de 2026

---

## 1. Resumen ejecutivo

El documento describe un sistema de administración de taller completo: recepción, órdenes de trabajo, presupuestos, inventario, compras, caja, garantías, seguimiento de componentes y analítica del negocio.

**La idea central del punto 49 es correcta y es lo más valioso del documento.** Definir la unidad de información como cliente → bicicleta → componentes → historial, en vez de centrarse en la reparación, es lo que diferencia una agenda de taller de una plataforma de mantenimiento. Esa decisión condiciona bien todo el resto.

**El problema principal es el tamaño.** Comparado con el sitio de reservas ya construido (14 pasos de desarrollo), este sistema es entre cinco y diez veces mayor: del orden de 60 a 90 pasos equivalentes. No es abordable como un proyecto único. Debe cortarse en fases que funcionen por sí solas, y la primera tiene que ser utilizable en el taller dentro de las primeras semanas, o el proyecto se abandona a mitad de camino.

---

## 2. Hallazgos que requieren decisión antes de construir

### 2.1 Strava requiere autorización del cliente, y el portal está descartado

El punto 7 plantea leer el kilometraje desde Strava para calcular el desgaste de componentes. Esos datos pertenecen a la cuenta del cliente: él debe autorizar el acceso con su usuario y clave, en una página propia. El punto 48 descarta el portal de clientes, así que hoy no existe dónde hacerlo.

**Salida mínima:** una página de autorización de un solo uso, enviada por WhatsApp. No es un portal, es un botón con un enlace temporal. Pero hay que construirla y mantenerla.

**Riesgo adicional:** conviene revisar las condiciones de uso de la API de Strava para aplicaciones comerciales antes de comprometer la funcionalidad. Es un punto a verificar, no un impedimento conocido.

### 2.2 El kilometraje real va a ser escaso

Strava solo entrega kilómetros por bicicleta si el cliente registra todas sus salidas y asigna correctamente la bici. En la práctica, para la mayoría de los clientes esa información no va a existir o va a estar incompleta.

**Recomendación:** diseñar el seguimiento de componentes para que funcione con kilometraje estimado y registrado a mano en cada visita. Strava como complemento cuando exista, nunca como requisito.

### 2.3 Contradicción entre pago y documentos tributarios

El punto 31 exige saldo cero antes de entregar la bicicleta. El punto 34 establece que el sistema no emitirá boletas ni facturas.

En Chile, el cobro obliga a emitir boleta. Eso no impide avanzar, pero el flujo de caja debe definir explícitamente dónde se emite el documento y cómo se registra su número, o se produce un descuadre permanente entre lo que informa el sistema y lo que informa el SII.

### 2.4 Las fotografías son el requisito de infraestructura más pesado

Los puntos 10, 14 y 16 exigen fotos en recepción, durante la reparación y al terminar. Son del orden de 10 a 20 imágenes por orden. A 20 bicicletas semanales, son varios miles de archivos al año.

Eso no puede vivir en la base de datos. Requiere almacenamiento de objetos (Replit App Storage, Cloudflare R2 o equivalente), con decisiones sobre compresión, tamaño máximo, miniaturas y plazo de retención. **Hay que resolverlo antes de la primera línea de código**, porque condiciona el modelo de datos.

### 2.5 Protección de datos personales

El sistema almacenará RUT, fecha de nacimiento, teléfono, correo, fotografías y patrones de uso deportivo. La Ley 21.719 ya está vigente.

Dos preguntas concretas:
- ¿Es necesaria la fecha de nacimiento? Si es para campañas de cumpleaños, conviene evaluar si justifica el dato.
- ¿Por cuánto tiempo se conserva cada cosa? Las fotos de una orden de 2027 no tienen por qué seguir ahí en 2032.

Definir finalidad y plazo de retención desde el diseño es mucho más barato que corregirlo después.

---

## 3. Decisiones que hay que tomar antes de planificar

**1. ¿Una aplicación o dos?**

Recomendación: **extender el proyecto actual**. El sitio ya tiene base de datos con reservas y clientes, dominio, correos transaccionales, autenticación y despliegue. El sistema interno sería un área nueva dentro del mismo proyecto, en `vectorbikes.cl/taller` o en `app.vectorbikes.cl`, compartiendo la misma base de datos.

La alternativa (dos aplicaciones separadas) obliga a sincronizar clientes y reservas entre dos bases, que es la peor opción posible: duplica el trabajo y genera inconsistencias permanentes.

**2. ¿Dónde viven las fotografías?**

Opciones: almacenamiento de Replit, o un servicio externo como Cloudflare R2. Hay que elegir, estimar el costo mensual al volumen esperado y definir el tamaño máximo por imagen.

**3. ¿Con qué dispositivo trabajan los mecánicos?**

Teléfono, tablet o computador. Cambia por completo el diseño de la recepción, el checklist y la carga de fotos. Una recepción diseñada para computador es inutilizable con las manos sucias junto a la bicicleta.

**4. ¿El sistema de usuarios se amplía o se reemplaza?**

Hoy existe un único administrador con autenticación hecha a medida. Cuatro roles con permisos diferenciados (dueño, administrador, recepción, mecánico) es otra cosa: requiere tabla de usuarios, permisos por acción, y decidir si cada mecánico tiene cuenta propia.

**5. ¿Cómo se conecta la reserva existente con la recepción?**

El sitio público ya guarda reservas con nombre, teléfono, correo, bicicleta y descripción. Hay que definir cómo esa reserva se convierte en un cliente de la ficha, cómo se detectan duplicados (mismo teléfono, mismo RUT) y cómo se transforma en orden de trabajo.

---

## 4. Fases propuestas

### Fase 1 — El taller funcionando

El objetivo es reemplazar el papel y el WhatsApp desordenado. Debe ser usable en el taller al terminar.

- Ficha de cliente y ficha de bicicleta
- Recepción con checklist estandarizado, fotos y firma digital
- Orden de trabajo con sus estados y número único
- Catálogo de servicios con precios por tipo de bicicleta
- Presupuesto y aprobación de trabajos adicionales
- Control de calidad previo a la entrega
- Registro de pago e informe final
- Historial permanente de la bicicleta
- Roles y auditoría de las acciones importantes
- Dashboard operativo mínimo

Fuera de esta fase: inventario, Strava, asistente de WhatsApp, caja, compras.

### Fase 2 — El dinero y las piezas

- Inventario de repuestos, accesorios y productos
- Consumo de repuestos desde la orden, con descuento automático de stock
- Alertas de stock mínimo
- Proveedores, solicitudes y órdenes de compra
- Caja tipo POS con Mercado Pago
- Descuentos con registro de responsable y motivo
- Devoluciones auditadas
- Códigos de barra, etiquetas y números de serie

### Fase 3 — La inteligencia

- Registro de componentes con seguimiento de kilómetros
- Integración con Strava (incluida la página de autorización)
- Clasificación de estado de componentes y mantenimiento predictivo
- Asistente de WhatsApp para consultas de estado
- Solicitud automática de reseñas en Google
- Campañas de recuperación de clientes
- Fichas específicas de suspensiones

### Fase 4 — Crecimiento

- Multi-sucursal
- Convenios con clubes, equipos y empresas
- Integración con tienda online

**Advertencia importante sobre multi-sucursal:** aunque sea fase 4, la columna de sucursal debe existir en todas las tablas **desde la fase 1**. Agregarla después obliga a reescribir todas las consultas y todas las reglas de acceso. Es gratis ahora y muy caro más tarde.

---

## 5. Observaciones menores sobre el documento

**Punto 11, etiqueta física con QR.** Requiere impresora de etiquetas. Conviene definir el modelo antes, porque condiciona el formato.

**Punto 15, asignación de mecánico.** Dejar fuera el cronometraje es una buena decisión: medir tiempos genera resistencia del equipo y aporta poco al inicio.

**Punto 17, control de calidad.** Que el mismo mecánico apruebe su trabajo reduce el valor del control. Es razonable al empezar con dos mecánicos, pero conviene dejar el diseño preparado para exigir una segunda persona cuando el equipo crezca.

**Punto 30, caja.** Dice que no se contempla venta anónima. Vale la pena revisarlo: la venta de un accesorio a alguien que pasa por el local es un caso real y frecuente, y obligarlo a crear ficha de cliente genera fricción en el mostrador.

**Punto 38, gestión de capacidad.** Proponer fecha de entrega automática es de las funcionalidades más difíciles de acertar. Recomiendo que en la fase 1 el sistema solo sugiera y la persona confirme, para acumular datos reales antes de automatizar.

**Punto 44, recuperación de clientes.** Funciona bien, pero depende de tener consentimiento para comunicaciones de marketing, que es distinto del consentimiento para gestionar la reserva.

---

## 6. Cómo construirlo

El método que funcionó con el sitio de reservas aplica igual: un blueprint por fase, no uno único.

Para la fase 1, en el proyecto de Replit:

```
/the-architect:architect-brownfield
```

indicándole explícitamente:

```
Escribe el bundle en blueprints/vector-taller-f1/. No modifiques blueprints/vector-bikes/,
que es el registro del sitio ya construido.
```

Después, un `/the-architect:architect-next` por cada paso, igual que en las 14 tareas del sitio.

Antes de invocarlo hay que tener respondidas las cinco decisiones del punto 3 de este documento. El plan generado es tan bueno como las definiciones que recibe.

---

## 7. Recomendación final

El documento está bien pensado y la visión es la correcta. El riesgo no es técnico: es de alcance.

La tentación natural va a ser intentar construirlo completo antes de usarlo. Si eso ocurre, el sistema va a estar listo en seis meses y para entonces el taller va a seguir funcionando con papel y WhatsApp.

**La fase 1 debe estar en uso antes de empezar la fase 2.** Esa es la única garantía de que el sistema se diseñe alrededor de cómo trabajan realmente los mecánicos, y no alrededor de cómo se imaginó que trabajarían.
