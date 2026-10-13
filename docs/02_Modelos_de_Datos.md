# 02 — Modelos de Datos

Archivo: `gestion/models.py`. Usa el `User` estándar de Django. Montos en `IntegerField` (pesos CLP, sin decimales).

## 1. Catálogo

- **Categoria** (`nombre`).
- **Producto**: `nombre`, `marca`, `codigo` (único), `precio`, `stock`, `descripcion`, `categoria` (FK `RESTRICT`), `fecha_creacion`.
- **ImagenProducto**: FK a Producto (`CASCADE`), `ImageField` en `productos/`.
- **Valoracion**: producto, usuario, `estrellas` 1-5, comentario.

## 2. Ventas

- **Venta**: `usuario` (FK `CASCADE`, nullable), `fecha_compra`, `total`, `region`, `costo_envio`, `cupon_usado` (texto), `descuento_aplicado`, `codigo_comprobante` (único, **nunca se asigna**), `estado` ∈ `pendiente | pagado | rechazado | anulado`.
- **DetalleVenta**: venta (`CASCADE`), producto (`PROTECT`), cantidad, precio_unitario, subtotal.
- **HistorialEstadoVenta**: bitácora de cambios de estado; `usuario_responsable` existe pero **nunca se rellena**.
- **Cupon**: `codigo` único, `descuento_porcentaje`, `fecha_expiracion`, `activo`. Sin validación de rango 0-100 ni límite de usos.
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
