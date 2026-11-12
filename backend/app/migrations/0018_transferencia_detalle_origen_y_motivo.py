# Paso 4b (etapa 3): trazabilidad de transferencia por detalle/lote de origen.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0017_detallestock_lote_obligatorio'),
    ]

    operations = [
        migrations.AddField(
            model_name='transferenciastock',
            name='detalle_origen',
            field=models.ForeignKey(
                blank=True,
                help_text='Detalle/lote de origen desde el que se transfirió.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='transferencias_origen',
                to='app.detallestock',
            ),
        ),
        migrations.AddField(
            model_name='historicaltransferenciastock',
            name='detalle_origen',
            field=models.ForeignKey(
                blank=True,
                db_constraint=False,
                help_text='Detalle/lote de origen desde el que se transfirió.',
                null=True,
                on_delete=django.db.models.deletion.DO_NOTHING,
                related_name='+',
                to='app.detallestock',
            ),
        ),
        migrations.AlterField(
            model_name='transferenciastock',
            name='motivo',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AlterField(
            model_name='historicaltransferenciastock',
            name='motivo',
            field=models.TextField(blank=True, default=''),
        ),
    ]
