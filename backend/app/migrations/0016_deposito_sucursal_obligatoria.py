# Paso 4a: el depósito debe pertenecer siempre a una sucursal.

from django.db import migrations, models
import django.db.models.deletion


def asegurar_sucursal(apps, schema_editor):
    Deposito = apps.get_model('app', 'Deposito')
    Sucursal = apps.get_model('app', 'Sucursal')
    sin_sucursal = Deposito.objects.filter(sucursal__isnull=True)
    if not sin_sucursal.exists():
        return
    sucursal = Sucursal.objects.order_by('id').first()
    if sucursal is None:
        return
    sin_sucursal.update(sucursal=sucursal)


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0015_compra_motivo_cancelacion_and_more'),
    ]

    operations = [
        migrations.RunPython(asegurar_sucursal, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='deposito',
            name='sucursal',
            field=models.ForeignKey(
                help_text='Sucursal a la que pertenece el deposito.',
                on_delete=django.db.models.deletion.PROTECT,
                related_name='depositos',
                to='app.sucursal',
            ),
        ),
    ]
