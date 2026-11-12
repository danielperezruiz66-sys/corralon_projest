# Paso 4b (etapa 1): lote obligatorio y generado para detalles de stock.

from django.db import migrations, models


def backfill_lotes(apps, schema_editor):
    DetalleStock = apps.get_model('app', 'DetalleStock')
    HistoricalDetalleStock = apps.get_model('app', 'HistoricalDetalleStock')

    for detalle in DetalleStock.objects.all().order_by('id'):
        lote = (getattr(detalle, 'lote', None) or '').strip()
        if not lote:
            detalle.lote = f'LOT-{detalle.pk:06d}'
            detalle.save(update_fields=['lote'])

    # Los registros históricos deben tener un lote no nulo para el esquema.
    # Usamos el código del detalle actual cuando existe; si no, uno derivado
    # del id histórico para garantizar unicidad.
    for hist in HistoricalDetalleStock.objects.all().order_by('history_id'):
        lote = (getattr(hist, 'lote', None) or '').strip()
        if lote:
            continue
        detalle_id = getattr(hist, 'id', None)
        if detalle_id:
            hist.lote = f'LOT-{int(detalle_id):06d}'
        else:
            hist.lote = f'LOT-H{int(hist.history_id):06d}'
        hist.save(update_fields=['lote'])


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0016_deposito_sucursal_obligatoria'),
    ]

    operations = [
        migrations.RunPython(backfill_lotes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='detallestock',
            name='lote',
            field=models.CharField(max_length=30, unique=True),
        ),
        migrations.AlterField(
            model_name='historicaldetallestock',
            name='lote',
            field=models.CharField(db_index=True, max_length=30),
        ),
    ]
