from decimal import Decimal

from django.db import migrations
from django.db.models import Sum


def marcar_parciales(apps, schema_editor):
    """Las ventas pendientes con pagos pasan a Parcial o Confirmada.

    Antes de este cambio el pago no movia el estado: una venta con pagos
    parciales seguia `PE`. La nueva logica usa `PC` para pagos parciales y
    `CO` cuando los pagos cubren el total (pagada y confirmada son lo mismo).
    """
    Venta = apps.get_model('app', 'Venta')
    Pago = apps.get_model('app', 'MetodoPagoXVenta')

    for venta in Venta.objects.filter(estado='PE').iterator():
        pagado = (
            Pago.objects.filter(venta_id=venta.pk).aggregate(
                total=Sum('monto_pagado')
            )['total']
            or Decimal('0.00')
        )
        if pagado <= 0:
            continue
        venta.estado = 'CO' if pagado >= venta.monto_venta else 'PC'
        venta.save(update_fields=['estado'])


def revertir(apps, schema_editor):
    Venta = apps.get_model('app', 'Venta')
    Venta.objects.filter(estado='PC').update(estado='PE')


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0002_alter_historicalventa_estado_alter_venta_estado'),
    ]

    operations = [
        migrations.RunPython(marcar_parciales, revertir),
    ]
