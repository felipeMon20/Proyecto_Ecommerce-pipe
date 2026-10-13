# 02 — Modelos de Datos

Archivo: `gestion/models.py`. Usa el `User` estándar de Django. Montos en `IntegerField` (pesos CLP, sin decimales).

## 1. Catálogo

- **Categoria** (`nombre`).
- **Producto**: `nombre`, `marca`, `codigo` (único), `precio`, `stock`, `descripcion`, `categoria` (FK `RESTRICT`), `fecha_creacion`.
- **ImagenProducto**: FK a Producto (`CASCADE`), `ImageField` en `productos/`.
- **Valoracion**: producto, usuario, `estrellas` 1-5, comentario.

## 2. Ventas

- **Venta**: `usuario` (FK `CASCADE`, nullable), `fecha_compra`, `total`, `region`, `costo_envio`, dirección de entrega (`direccion_nombre`, `direccion_telefono`, `direccion_calle`, `direccion_numero`, `direccion_complemento`, `direccion_comuna`, `direccion_indicaciones`; migración 0014, 13-10-2026), `cupon_usado` (texto), `descuento_aplicado`, `codigo_comprobante` (único, **nunca se asigna**), `estado` ∈ `pendiente | pagado | rechazado | anulado`.
- **DetalleVenta**: venta (`CASCADE`), producto (`PROTECT`), cantidad, precio_unitario, subtotal.
- **HistorialEstadoVenta**: bitácora de cambios de estado; `usuario_responsable` existe pero **nunca se rellena**.
- **Cupon**: `codigo` único, `descuento_porcentaje`, `fecha_expiracion`, `activo`, `usos_maximos` (tope total, vacío = sin tope) y `usos_por_usuario` (por defecto 1, vacío = sin tope); los dos últimos desde la migración 0015 (13-10-2026). El modelo no valida el rango 0-100: la lógica limita el porcentaje al aplicarlo. Ver [[05_Ventas_Carrito_y_Webpay]].
- **Carrito** (1:1 con User) e **ItemCarrito**.

## 3. Seguridad y finanzas

- **Codigo2FA** (1:1 con User): `codigo` de 6 dígitos, `creado_en` (no se usa para expirar).
- **PerfilSeguridad**: `intentos_fallidos`, `bloqueado_hasta`.
- **Egreso**: gastos operativos (descripción, monto, fecha, categoría, usuario).
- **AuditLog**: usuario, acción, detalle, fecha.

## 4. Señales

| Señal | Efecto |
|---|---|
| `post_delete` ImagenProducto | Borra el archivo físico. |
| `post_delete` Producto | Crea `AuditLog` "Eliminar Producto" con `usuario=None` siempre. |
| `pre_save` Venta | Si cambió el estado, crea `HistorialEstadoVenta` (sin responsable). |
| `post_save` Venta (created) | Crea la entrada inicial del historial. |

## 5. Comportamientos de borrado a tener presentes

- Borrar un `User` borra en cascada sus `Venta` (pérdida de historial financiero). Ver [[06_Estado_del_Backend_y_Pendientes]].
- `DetalleVenta.producto` es `PROTECT`: un producto con ventas no se puede borrar.
- `admin.py` registra solo Producto, Categoria, ImagenProducto, Venta, DetalleVenta, Cupon y Codigo2FA.

## PerfilCliente (13-10-2026, migración 0016)

Datos de contacto y entrega que el cliente guarda en Mi cuenta para no repetirlos al comprar. Relación 1 a 1 con `User` (`perfil_cliente`, se crea la primera vez que se consulta). Campos: `region` y los mismos `direccion_*` que `Venta` (nombre, teléfono, calle, número, complemento, comuna, indicaciones). Todos opcionales; el nombre y apellido viven en `User`.
