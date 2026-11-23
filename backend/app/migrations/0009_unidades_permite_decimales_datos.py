from django.db import migrations

from app.utils import unidad_permite_decimales


def completar_flags(apps, schema_editor):
    Unidad = apps.get_model('app', 'Unidad')
    for unidad in Unidad.objects.all():
        permite = unidad_permite_decimales(unidad.unidades)
        if unidad.permite_decimales != permite:
            Unidad.objects.filter(pk=unidad.pk).update(
                permite_decimales=permite,
            )


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0008_unidad_permite_decimales'),
    ]

    operations = [
        migrations.RunPython(
            completar_flags,
            migrations.RunPython.noop,
        ),
    ]
