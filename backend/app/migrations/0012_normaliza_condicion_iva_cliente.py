from django.db import migrations

CONDICIONES = {
    'RI': 'Responsable Inscripto',
    'MT': 'Monotributista',
    'CF': 'Consumidor Final',
    'EX': 'Exento',
    'NC': 'No Categorizado',
}


def normalizar(apps, schema_editor):
    Cliente = apps.get_model('app', 'Cliente')
    for cliente in Cliente.objects.all().only('id', 'condicion_iva'):
        valor = (cliente.condicion_iva or '').strip().lower()
        if 'inscripto' in valor:
            codigo = 'RI'
        elif 'monotrib' in valor:
            codigo = 'MT'
        elif 'exento' in valor:
            codigo = 'EX'
        elif 'consumidor' in valor or not valor:
            codigo = 'CF'
        else:
            codigo = 'NC'
        if cliente.condicion_iva != codigo:
            Cliente.objects.filter(pk=cliente.pk).update(
                condicion_iva=codigo,
            )


def reverso(apps, schema_editor):
    Cliente = apps.get_model('app', 'Cliente')
    for codigo, texto in CONDICIONES.items():
        Cliente.objects.filter(condicion_iva=codigo).update(
            condicion_iva=texto,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0011_cliente_estado_cliente_ingresos_brutos_and_more'),
    ]

    operations = [
        migrations.RunPython(normalizar, reverso),
    ]
