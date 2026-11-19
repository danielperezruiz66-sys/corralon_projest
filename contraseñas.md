Usuarios y contraseñas
Usuario         	Contraseña	   Rol	       Sucursal	           Qué probar
admin	            admin1234     Superuser	     Todas	        Ve absolutamente todo
gerente.salta	    test1234	    GE   	   Salta Capital	Todo + resuelve solicitudes de pago y anulación
admin.salta	        test1234	    AD	       Salta Capital	Admin no-superuser (el rol AD le muestra todas las sucursales)
admin.quijano	    test1234	    AD         Campo Quijano	Admin no-superuser (el rol AD le muestra todas las sucursales)
cajero.salta	    test1234	    CA         Salta Capital	Caja + ventas + compras + clientes + proveedores (consulta) + facturación
cajero.quijano	    test1234    	CA	       Campo Quijano	Caja + ventas + compras + clientes (otra sucursal)
vendedor.salta	    test1234    	VE	       Salta Capital	Ventas + compras + clientes + proveedores (consulta)
vendedor.quijano  	test1234     	VE	       Campo Quijano	Ventas + compras + clientes (otra sucursal)
deposito.salta  	test1234    	ED	       Salta Capital	Compras + stock + proveedores
deposito.quijano	test1234	    ED      	Campo Quijano	Compras + stock + proveedores (otra sucursal)

Notas
- Pagar y anular compras es solo de admin y gerente; cajero, vendedor y
  encargado dejan una solicitud desde el detalle de la compra.
- Inventario y proveedores los ven todos, pero solo admin, gerente y encargado
  los editan; cajero y vendedor los consultan.
- El cajero no entra a Empleados; el vendedor no ve nada de Administración.
- La caja se pausa con un motivo y se reanuda poniendo la contraseña del cajero.
- Con la caja abierta no se puede cerrar sesión del sistema.