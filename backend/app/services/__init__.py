"""Servicios de la aplicacion (logica de negocio).

Aqui vive la logica que no pertenece ni a la capa de persistencia (`models/`)
ni a la capa HTTP (`views.py`): calculos de totales, cierre de caja, descuento
de stock, generacion de facturas, etc.

Convencion: un modulo por dominio, con el mismo nombre que su modulo de
modelos.

    services/ventas.py   -> registrar venta, calcular totales, aplicar pagos
    services/caja.py     -> abrir y cerrar secciones de caja
    services/stock.py    -> movimientos y actualizacion de stock

Las vistas deben limitarse a validar la entrada y delegar en estos servicios,
para que la logica de negocio sea reutilizable y testeable sin HTTP.
"""
