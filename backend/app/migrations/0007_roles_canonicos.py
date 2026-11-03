"""Normaliza los roles existentes a los cinco roles funcionales del sistema.

Los roles que no forman parte del modelo de permisos (por ejemplo, Chofer)
quedan con `codigo` nulo y solo otorgan acceso de lectura.
"""

from django.db import migrations

ROLES_CANONICOS = [
    ('AD', 'Admin', 'Acceso total al sistema'),
    ('GE', 'Gerente', 'Supervision general y gestion de catalogos'),
    ('CA', 'Cajero', 'Manejo de caja y cobros'),
    ('VE', 'Vendedor', 'Atencion al publico y carga de ventas'),
    ('ED', 'Encargado de deposito', 'Compras, recepcion y depositos'),
]

ALIAS = {
    'admin': 'AD',
    'administrador': 'AD',
    'gerente': 'GE',
    'encargado': 'GE',
    'administrativo': 'GE',
    'cajero': 'CA',
    'vendedor': 'VE',
    'encargado de deposito': 'ED',
    'repositor': 'ED',
}


def roles_canonicos(apps, schema_editor):
    Rol = apps.get_model('app', 'Rol')
    EmpleadoXRol = apps.get_model('app', 'EmpleadoXRol')

    canonicos = {}
    for codigo, nombre, descripcion in ROLES_CANONICOS:
        rol = Rol.objects.filter(codigo=codigo).first()
        if rol is None:
            rol = Rol.objects.create(
                codigo=codigo,
                ocupacion=nombre,
                descripcion=descripcion,
            )
        elif rol.ocupacion != nombre:
            rol.ocupacion = nombre
            rol.descripcion = descripcion
            rol.save(update_fields=['ocupacion', 'descripcion'])
        canonicos[codigo] = rol

    for rol in Rol.objects.filter(codigo__isnull=True):
        codigo = ALIAS.get((rol.ocupacion or '').strip().lower())
        if codigo is None:
            continue

        destino = canonicos[codigo]
        for asignacion in EmpleadoXRol.objects.filter(rol=rol):
            duplicada = EmpleadoXRol.objects.filter(
                empleado_id=asignacion.empleado_id,
                rol=destino,
            ).exists()
            if duplicada:
                asignacion.delete()
            else:
                asignacion.rol = destino
                asignacion.save(update_fields=['rol'])

        if not EmpleadoXRol.objects.filter(rol=rol).exists():
            rol.delete()


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0006_rol_codigo'),
    ]

    operations = [
        migrations.RunPython(roles_canonicos, migrations.RunPython.noop),
    ]
