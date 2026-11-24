"""Viewsets de la API.

Un viewset por modelo, agrupados por dominio con el mismo orden que `models.py`.

Regla de escritura:

- Catalogos y datos maestros: CRUD completo, limitado por rol.
- `Stock` y `DetalleStock`: solo lectura. Se modifican desde los servicios de
  stock (ventas/compras), no con un PUT directo.
- `Venta`, `Compra`, `Factura` y pagos: lectura general; la escritura pasa por
  acciones que delegan en `services/`.
- `MovimientoCaja`: se abre, cierra y audita con acciones; no se edita a mano.

Los permisos de escritura se declaran por viewset en `roles_escritura`
(ver `app/permissions.py`).
"""

import calendar
import re
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from django.conf import settings
from django.db.models import Count, F, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from django.utils.dateparse import parse_date
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from . import serializers
from .models import (
    Caja,
    Categoria,
    Cliente,
    Compra,
    Deposito,
    DetalleCompra,
    DetalleStock,
    DetalleVenta,
    Empleado,
    EmpleadoXRol,
    Empresa,
    Factura,
    Localidad,
    Marca,
    MetodoPago,
    MetodoPagoXCompra,
    MetodoPagoXVenta,
    MovimientoCaja,
    Pais,
    Producto,
    ProductoXProveedor,
    ProductoXSucursal,
    Provincia,
    Proveedor,
    ProveedorXSucursal,
    RegistroActividad,
    Rol,
    MovimientoCaja,
    Stock,
    Sucursal,
    SucursalXEmpleado,
    Ubicacion,
    Unidad,
    Usuario,
    Venta,
)
from .permissions import (
    ADMIN,
    CAJERO,
    DEPOSITO,
    GERENTE,
    GESTION,
    PermisoPorRol,
    SoloAdministrador,
    VENDEDOR,
    codigos_activos,
    es_admin,
    es_gestion,
)
from .services import acceso as acceso_service
from .services import caja as caja_service
from .services import compras as compras_service
from .services import empleados as empleados_service
from .services import pagos as pagos_service
from .services import proveedores as proveedores_service
from .services import stock as stock_service
from .services import ventas as ventas_service


def _fecha_de_param(valor, nombre):
    """Convierte un parametro AAAA-MM-DD en fecha; error 400 si es invalido."""
    try:
        fecha = parse_date((valor or '').strip())
    except ValueError:
        fecha = None
    if fecha is None:
        raise ValidationError(
            {nombre: 'Formato de fecha invalido. Use AAAA-MM-DD.'}
        )
    return fecha


def _filtrar_por_fecha(queryset, parametros, campo):
    """Filtra un DateTimeField por dia exacto o rango de dias inclusivo.

    Los limites se calculan en la zona horaria local para que 'hoy' coincida
    con el dia del corralon y no con el dia UTC.
    """
    fecha = (parametros.get('fecha') or '').strip()
    desde = (parametros.get('fecha_desde') or '').strip()
    hasta = (parametros.get('fecha_hasta') or '').strip()
    zona = timezone.get_current_timezone()

    def inicio_del_dia(valor, nombre):
        dia = _fecha_de_param(valor, nombre)
        return timezone.make_aware(datetime.combine(dia, time.min), zona)

    if fecha:
        inicio = inicio_del_dia(fecha, 'fecha')
        return queryset.filter(
            **{
                f'{campo}__gte': inicio,
                f'{campo}__lt': inicio + timedelta(days=1),
            }
        )

    dia_desde = _fecha_de_param(desde, 'fecha_desde') if desde else None
    dia_hasta = _fecha_de_param(hasta, 'fecha_hasta') if hasta else None
    if dia_desde and dia_hasta and dia_desde > dia_hasta:
        raise ValidationError(
            {
                'fecha_desde': (
                    'La fecha desde no puede ser posterior a la fecha hasta.'
                )
            }
        )
    if dia_desde:
        inicio = timezone.make_aware(datetime.combine(dia_desde, time.min), zona)
        queryset = queryset.filter(**{f'{campo}__gte': inicio})
    if dia_hasta:
        inicio = timezone.make_aware(datetime.combine(dia_hasta, time.min), zona)
        queryset = queryset.filter(
            **{f'{campo}__lt': inicio + timedelta(days=1)}
        )
    return queryset


# =============================================================================
# PERFIL
# =============================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def perfil(request):
    """Datos del usuario autenticado y sus roles, para que el cliente arme el menu."""
    empleado = getattr(request.user, 'empleado', None)
    codigos = codigos_activos(request.user)
    roles = []
    if empleado is not None:
        roles = [
            {
                'id': asignacion.rol_id,
                'codigo': asignacion.rol.codigo,
                'ocupacion': asignacion.rol.ocupacion,
            }
            for asignacion in empleado.roles_asignados.filter(
                estado='AC',
                rol__codigo__isnull=False,
            ).select_related('rol')
        ]

    if request.user.is_superuser or 'AD' in codigos:
        sucursales = Sucursal.objects.all()
    elif empleado is not None:
        sucursales = Sucursal.objects.filter(
            empleados_asignados__empleado=empleado,
            empleados_asignados__estado=True,
        ).distinct()
    else:
        sucursales = Sucursal.objects.none()

    return Response(
        {
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
            'is_superuser': request.user.is_superuser,
            'is_active': request.user.is_active,
            'empleado': (
                {
                    'id': empleado.id,
                    'legajo': empleado.legajo,
                    'dni': empleado.dni,
                    'nombre': empleado.nombre,
                    'apellido': empleado.apellido,
                    'telefono': empleado.telefono,
                    'estado': empleado.estado,
                    'estado_detalle': empleado.get_estado_display(),
                }
                if empleado is not None
                else None
            ),
            'roles': roles,
            'codigos': sorted(str(codigo) for codigo in codigos),
            'sucursales': [
                {
                    'id': sucursal.id,
                    'nombre': sucursal.nombre,
                    'es_central': sucursal.es_central,
                }
                for sucursal in sucursales
            ],
        }
    )


def _sucursales_permitidas(user):
    """Sucursales que puede consultar el usuario (ver services/acceso.py)."""
    return acceso_service.sucursales_permitidas(user)


def _validar_sucursal_parametro(request, sucursal_id):
    """Valida el id de sucursal y que esté dentro del alcance del usuario."""
    try:
        sucursal_id = int(sucursal_id)
    except (TypeError, ValueError):
        raise ValidationError(
            {'sucursal': 'Indicá un id de sucursal válido.'}
        ) from None
    if not acceso_service.sucursal_permitida(request.user, sucursal_id):
        raise PermissionDenied(
            'No tenés acceso a la sucursal indicada.'
        )


def _movimiento_de_cobro(request, documento, movimiento_id=None):
    """Caja donde se registra un pago de venta o compra.

    Prioridad: la caja indicada, la caja original del documento si sigue
    abierta, la caja abierta del usuario y la unica caja abierta de la
    sucursal del documento. Asi el saldo de un documento parcial se puede
    cobrar aunque su caja original ya se haya cerrado. Una caja en pausa,
    en cambio, bloquea el cobro/pago: la pausa se reanuda sobre esa misma
    sesion, asi que no corresponde imputarlo a otra caja.
    """
    abierta = MovimientoCaja.EstadoMovimiento.ABIERTA
    original = documento.movimiento_caja

    if original.estado == MovimientoCaja.EstadoMovimiento.PAUSADA:
        raise ValueError(
            'El movimiento de caja está en pausa: primero hay que reanudarlo.'
        )

    if movimiento_id:
        if isinstance(movimiento_id, MovimientoCaja):
            movimiento = movimiento_id
        else:
            try:
                movimiento = MovimientoCaja.objects.select_related('caja').get(
                    pk=movimiento_id,
                )
            except (MovimientoCaja.DoesNotExist, TypeError, ValueError):
                raise ValidationError(
                    {'movimiento_caja': 'La caja indicada no existe.'}
                ) from None
        _validar_sucursal_parametro(request, movimiento.caja.sucursal_id)
        if movimiento.estado != abierta:
            raise ValidationError(
                {'movimiento_caja': 'La caja indicada no está abierta.'}
            )
        return movimiento

    if original.estado == abierta:
        return original

    empleado = getattr(request.user, 'empleado', None)
    if empleado is not None:
        propia = (
            MovimientoCaja.objects.filter(empleado=empleado, estado=abierta)
            .select_related('caja')
            .first()
        )
        if propia is not None:
            return propia

    disponibles = MovimientoCaja.objects.filter(
        estado=abierta,
        caja__sucursal_id=original.caja.sucursal_id,
    ).select_related('caja')
    if disponibles.count() == 1:
        return disponibles.first()
    if not disponibles.exists():
        raise ValidationError(
            {
                'movimiento_caja': (
                    'No hay ninguna caja abierta para cobrar. '
                    'Abrí una caja primero.'
                )
            }
        )
    raise ValidationError(
        {
            'movimiento_caja': (
                'Hay varias cajas abiertas: indicá en cuál se cobra.'
            )
        }
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard(request):
    """Resumen agregado para el dashboard de Inicio.

    Acepta `?periodo=hoy|7d|mes` y `?sucursal=<id>`. Los KPIs y la serie
    respetan ambos filtros; las alertas y paneles operativos son siempre del
    estado actual. El usuario solo puede consultar sus sucursales asignadas
    (salvo Admin/superuser) y la respuesta incluye `vista`, `codigos` y
    `bloques` para que el cliente arme el dashboard por rol.
    """
    hoy = timezone.localdate()
    ahora = timezone.now()
    inicio_mes = hoy.replace(day=1)

    periodo = request.query_params.get('periodo', 'hoy')
    if periodo not in ('hoy', '7d', 'mes'):
        periodo = 'hoy'

    sucursal_id = request.query_params.get('sucursal')
    if sucursal_id in ('', 'null', 'undefined', None):
        sucursal_id = None

    codigos = codigos_activos(request.user)
    es_admin_total = request.user.is_superuser or ADMIN in codigos
    gestion = es_admin_total or GERENTE in codigos
    cajero = CAJERO in codigos
    vendedor = VENDEDOR in codigos
    deposito = DEPOSITO in codigos

    if gestion:
        vista = 'gestion'
    elif cajero:
        vista = 'caja'
    elif vendedor:
        vista = 'ventas'
    elif deposito:
        vista = 'deposito'
    else:
        vista = 'lectura'

    bloques = {
        'ventas': gestion or cajero or vendedor,
        # La alerta de vencimiento queda para quien puede cobrar/confirmar.
        'alertas_ventas': gestion or cajero,
        'compras': bool(codigos),
        'stock': bool(codigos),
        'caja': gestion or cajero,
        'equipo': gestion,
        'actividad': gestion,
        'ventas_por_sucursal': gestion,
        'formas_pago': gestion or cajero,
        'diferencias_caja': gestion or cajero,
    }

    ventas = Venta.objects.exclude(estado=Venta.EstadoVenta.ANULADA)
    compras = Compra.objects.exclude(estado=Compra.EstadoCompra.ANULADA)
    stocks = Stock.objects.all()
    secciones = MovimientoCaja.objects.all()

    permitidas = _sucursales_permitidas(request.user)

    sucursal = None
    if sucursal_id is not None:
        try:
            sucursal = Sucursal.objects.get(pk=sucursal_id)
        except (Sucursal.DoesNotExist, TypeError, ValueError):
            return Response(
                {'detail': 'La sucursal indicada no existe.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if (
            permitidas is not None
            and not permitidas.filter(pk=sucursal.pk).exists()
        ):
            raise PermissionDenied(
                'No tenés acceso a la sucursal indicada.'
            )
        ventas = ventas.filter(movimiento_caja__caja__sucursal=sucursal)
        compras = compras.filter(movimiento_caja__caja__sucursal=sucursal)
        stocks = stocks.filter(sucursal=sucursal)
        secciones = secciones.filter(caja__sucursal=sucursal)
    elif permitidas is not None:
        ventas = ventas.filter(
            movimiento_caja__caja__sucursal__in=permitidas
        )
        compras = compras.filter(
            movimiento_caja__caja__sucursal__in=permitidas
        )
        stocks = stocks.filter(sucursal__in=permitidas)
        secciones = secciones.filter(caja__sucursal__in=permitidas)

    if not gestion:
        # El cajero (y quien no es gestion) solo ve sus propias cajas abiertas.
        empleado_usuario = getattr(request.user, 'empleado', None)
        if empleado_usuario is None:
            secciones = MovimientoCaja.objects.none()
        else:
            secciones = secciones.filter(empleado=empleado_usuario)

    def rango_actual_y_anterior():
        if periodo == 'hoy':
            return hoy, hoy, hoy - timedelta(days=1), hoy - timedelta(days=1)
        if periodo == '7d':
            return (
                hoy - timedelta(days=6),
                hoy,
                hoy - timedelta(days=13),
                hoy - timedelta(days=7),
            )
        anterior_fin = inicio_mes - timedelta(days=1)
        anterior_inicio = anterior_fin.replace(day=1)
        anterior_fin = date(
            anterior_inicio.year,
            anterior_inicio.month,
            min(
                hoy.day,
                calendar.monthrange(anterior_inicio.year, anterior_inicio.month)[1],
            ),
        )
        return inicio_mes, hoy, anterior_inicio, anterior_fin

    inicio, fin, anterior_inicio, anterior_fin = rango_actual_y_anterior()

    def resumen(queryset, campo='monto_venta'):
        datos = queryset.aggregate(cantidad=Count('id'), monto=Sum(campo))
        cantidad = datos['cantidad'] or 0
        monto = datos['monto'] or Decimal('0.00')
        ticket = (monto / cantidad).quantize(Decimal('0.01')) if cantidad else Decimal('0.00')
        return {
            'cantidad': cantidad,
            'monto': str(monto),
            'ticket_promedio': str(ticket),
        }

    def resumen_con_saldo(queryset):
        """Resumen de ventas con el saldo que aun falta cobrar."""
        datos = resumen(queryset)
        pagado = (
            MetodoPagoXVenta.objects.filter(venta__in=queryset)
            .aggregate(total=Sum('monto_pagado'))['total']
            or Decimal('0.00')
        )
        saldo = Decimal(datos['monto']) - pagado
        if saldo < 0:
            saldo = Decimal('0.00')
        return {
            **datos,
            'saldo_pendiente': str(saldo.quantize(Decimal('0.01'))),
        }

    def variacion(actual, anterior):
        if anterior == 0:
            return None if actual == 0 else 100.0
        return round(float((actual - anterior) / anterior * 100), 1)

    def ventas_del_rango(desde, hasta):
        return ventas.filter(
            fecha_venta__date__gte=desde,
            fecha_venta__date__lte=hasta,
        )

    periodo_actual = resumen(ventas_del_rango(inicio, fin))
    periodo_anterior = resumen(ventas_del_rango(anterior_inicio, anterior_fin))
    comparacion = {
        'monto_anterior': periodo_anterior['monto'],
        'cantidad_anterior': periodo_anterior['cantidad'],
        'variacion_porcentaje': variacion(
            Decimal(periodo_actual['monto']),
            Decimal(periodo_anterior['monto']),
        ),
    }

    inicio_semana = hoy - timedelta(days=hoy.weekday())
    # Comparar contra la misma porcion de la semana anterior (lunes -> mismo
    # dia de la semana) para no castigar una semana que todavia esta en curso.
    inicio_semana_anterior = inicio_semana - timedelta(days=7)
    fin_semana_anterior = inicio_semana_anterior + timedelta(days=hoy.weekday())

    ventas_hoy = resumen(ventas_del_rango(hoy, hoy))
    ventas_semana = resumen(ventas_del_rango(inicio_semana, hoy))
    ventas_semana_anterior = resumen(
        ventas_del_rango(inicio_semana_anterior, fin_semana_anterior)
    )
    comparacion_semana = {
        'monto_anterior': ventas_semana_anterior['monto'],
        'cantidad_anterior': ventas_semana_anterior['cantidad'],
        'variacion_porcentaje': variacion(
            Decimal(ventas_semana['monto']),
            Decimal(ventas_semana_anterior['monto']),
        ),
    }

    # Mismo periodo que muestra el grafico del dashboard: los ultimos 7 dias
    # comparados contra los 7 anteriores.
    inicio_7d = hoy - timedelta(days=6)
    inicio_7d_anterior = inicio_7d - timedelta(days=7)
    fin_7d_anterior = inicio_7d - timedelta(days=1)
    ventas_7d = resumen(ventas_del_rango(inicio_7d, hoy))
    ventas_7d_anterior = resumen(
        ventas_del_rango(inicio_7d_anterior, fin_7d_anterior)
    )
    comparacion_7d = {
        'monto_anterior': ventas_7d_anterior['monto'],
        'cantidad_anterior': ventas_7d_anterior['cantidad'],
        'variacion_porcentaje': variacion(
            Decimal(ventas_7d['monto']),
            Decimal(ventas_7d_anterior['monto']),
        ),
    }

    ventas_mes = resumen(ventas_del_rango(inicio_mes, hoy))
    pendientes_qs = ventas.filter(estado=Venta.EstadoVenta.PENDIENTE)
    parciales_qs = ventas.filter(estado=Venta.EstadoVenta.PARCIAL)
    pendientes = resumen_con_saldo(pendientes_qs)
    parciales = resumen_con_saldo(parciales_qs)
    compras_mes = resumen(
        compras.filter(
            fecha_compra__date__gte=inicio_mes,
            fecha_compra__date__lte=hoy,
        ),
        campo='monto_compra',
    )

    # Ventas pendientes sin pagos: las que estan por vencer en los proximos
    # 10 minutos y las que ya vencieron y esperan el barrido.
    minutos_para_confirmar = getattr(
        settings,
        'VENTAS_MINUTOS_PARA_CONFIRMAR',
        30,
    )
    pendientes_sin_pago = ventas.filter(
        estado=Venta.EstadoVenta.PENDIENTE,
        pagos__isnull=True,
    )
    por_vencer_qs = pendientes_sin_pago.filter(
        fecha_venta__gt=ahora - timedelta(minutes=minutos_para_confirmar),
        fecha_venta__lte=ahora
        - timedelta(minutes=max(minutos_para_confirmar - 10, 0)),
    ).order_by('fecha_venta')
    vencidas_qs = pendientes_sin_pago.filter(
        fecha_venta__lte=ahora - timedelta(minutes=minutos_para_confirmar),
    ).order_by('fecha_venta')
    proxima_vencer = por_vencer_qs.first()
    minutos_restantes = None
    if proxima_vencer is not None:
        transcurridos = (ahora - proxima_vencer.fecha_venta).total_seconds() / 60
        minutos_restantes = max(0, round(minutos_para_confirmar - transcurridos))

    stock_bajo_qs = stocks.filter(
        cantidad__gte=0,
        cantidad__lte=F('cant_min'),
        cant_min__gt=0,
    )
    stock_negativo_qs = stocks.filter(cantidad__lt=0)
    # Critico = negativo o bajo un minimo configurado. Un producto con
    # cant_min = 0 no esta "bajo el minimo" aunque tenga stock cero.
    stock_critico_qs = stocks.filter(
        Q(cantidad__lt=0)
        | Q(
            cantidad__gte=0,
            cantidad__lte=F('cant_min'),
            cant_min__gt=0,
        )
    )
    compras_pendientes_qs = compras.filter(fecha_recepcion__isnull=True)
    cajas_abiertas_qs = secciones.filter(
        estado=MovimientoCaja.EstadoMovimiento.ABIERTA
    )
    cajas_pausadas_qs = secciones.filter(
        estado=MovimientoCaja.EstadoMovimiento.PAUSADA
    )
    cajas_en_curso_qs = secciones.filter(
        estado__in=[
            MovimientoCaja.EstadoMovimiento.ABIERTA,
            MovimientoCaja.EstadoMovimiento.PAUSADA,
        ]
    )

    estados_venta_valida = [
        Venta.EstadoVenta.PENDIENTE,
        Venta.EstadoVenta.CONFIRMADA,
    ]
    filtro_ventas = Q(ventas__estado__in=estados_venta_valida)
    cajas_abiertas = []
    for seccion in (
        cajas_en_curso_qs.select_related(
            'caja',
            'caja__sucursal',
            'empleado',
        )
        .annotate(
            ventas_cantidad=Count('ventas', filter=filtro_ventas),
            ventas_monto=Sum('ventas__monto_venta', filter=filtro_ventas),
        )
        .order_by('fecha_hora_apertura')
    ):
        cajas_abiertas.append(
            {
                'id': seccion.id,
                'caja_id': seccion.caja_id,
                'caja': str(seccion.caja),
                'sucursal': str(seccion.caja.sucursal),
                'empleado': str(seccion.empleado),
                'fecha_hora_apertura': seccion.fecha_hora_apertura.isoformat(),
                'monto_inicial': str(seccion.monto_inicial),
                'ventas_cantidad': seccion.ventas_cantidad or 0,
                'ventas_monto': str(seccion.ventas_monto or Decimal('0.00')),
                'estado': seccion.estado,
                'estado_detalle': seccion.get_estado_display(),
            }
        )

    ventas_por_vencer = [
        {
            'id': venta.id,
            'fecha': venta.fecha_venta.isoformat(),
            'cliente': (
                str(venta.cliente)
                if venta.cliente
                else venta.cliente_venta or 'Consumidor final'
            ),
            'monto': str(venta.monto_venta),
            'movimiento_caja': venta.movimiento_caja_id,
            'movimiento_caja_detalle': str(venta.movimiento_caja),
            'sucursal': str(venta.movimiento_caja.caja.sucursal),
            'minutos_restantes': max(
                0,
                round(
                    minutos_para_confirmar
                    - (ahora - venta.fecha_venta).total_seconds() / 60
                ),
            ),
        }
        for venta in por_vencer_qs.select_related(
            'cliente',
            'movimiento_caja__caja__sucursal',
        )[:5]
    ]

    compras_por_recibir = [
        {
            'id': compra.id,
            'proveedor': str(compra.proveedor or 'Sin proveedor'),
            'fecha_compra': compra.fecha_compra.isoformat(),
            'monto': str(compra.monto_compra),
            'dias_esperando': max(
                0,
                (hoy - timezone.localdate(compra.fecha_compra)).days,
            ),
            'estado': compra.estado,
            'estado_detalle': compra.get_estado_display(),
            'estado_entrega': compra.estado_entrega,
            'estado_entrega_detalle': compra.get_estado_entrega_display(),
            'fecha_estimada_llegada': (
                compra.fecha_estimada_llegada.isoformat()
                if compra.fecha_estimada_llegada
                else None
            ),
        }
        for compra in compras_pendientes_qs.select_related('proveedor').order_by(
            'fecha_compra'
        )[:5]
    ]

    serie_inicio = inicio_mes if periodo == 'mes' else hoy - timedelta(days=6)
    por_dia = (
        ventas.filter(
            fecha_venta__date__gte=serie_inicio,
            fecha_venta__date__lte=hoy,
        )
        .annotate(dia=TruncDate('fecha_venta'))
        .values('dia')
        .annotate(cantidad=Count('id'), monto=Sum('monto_venta'))
        .order_by('dia')
    )
    mapa_dias = {fila['dia']: fila for fila in por_dia}
    serie = []
    for indice in range((hoy - serie_inicio).days + 1):
        dia = serie_inicio + timedelta(days=indice)
        fila = mapa_dias.get(dia, {})
        monto_dia = fila.get('monto') or Decimal('0.00')
        cantidad_dia = fila.get('cantidad', 0)
        serie.append(
            {
                'fecha': dia.isoformat(),
                'cantidad': cantidad_dia,
                'monto': str(monto_dia),
                'ticket_promedio': str(
                    (monto_dia / cantidad_dia).quantize(Decimal('0.01'))
                    if cantidad_dia
                    else Decimal('0.00')
                ),
            }
        )

    recientes = [
        {
            'id': venta.id,
            'fecha': venta.fecha_venta.isoformat(),
            'cliente': (
                str(venta.cliente)
                if venta.cliente
                else venta.cliente_venta or 'Consumidor final'
            ),
            'monto': str(venta.monto_venta),
            'estado': venta.estado,
            'estado_detalle': venta.get_estado_display(),
        }
        for venta in ventas.select_related('cliente').order_by('-fecha_venta')[:5]
    ]

    criticos = [
        {
            'id': stock.id,
            'producto_id': stock.producto_id,
            'producto': str(stock.producto),
            'sucursal_id': stock.sucursal_id,
            'sucursal': str(stock.sucursal),
            'cantidad': str(stock.cantidad),
            'cant_min': str(stock.cant_min),
            'alerta': 'NEGATIVO' if stock.cantidad < 0 else 'MINIMO',
            'sin_stock': stock.cantidad == 0,
        }
        for stock in stock_critico_qs.select_related(
            'producto', 'sucursal'
        ).order_by('cantidad')[:5]
    ]

    empleados_qs = Empleado.objects.filter(
        estado=Empleado.EstadoEmpleado.ACTIVO
    )
    proveedores_qs = Proveedor.objects.filter(estado_prov=True)
    if sucursal is not None:
        empleados_qs = empleados_qs.filter(
            sucursales_asignadas__sucursal=sucursal,
            sucursales_asignadas__estado=True,
        ).distinct()
        proveedores_qs = proveedores_qs.filter(
            sucursales_asociadas__sucursal=sucursal,
            sucursales_asociadas__estado=True,
        ).distinct()
    elif permitidas is not None:
        empleados_qs = empleados_qs.filter(
            sucursales_asignadas__sucursal__in=permitidas,
            sucursales_asignadas__estado=True,
        ).distinct()
        proveedores_qs = proveedores_qs.filter(
            sucursales_asociadas__sucursal__in=permitidas,
            sucursales_asociadas__estado=True,
        ).distinct()

    sucursales_qs = Sucursal.objects.order_by('nombre')
    if permitidas is not None:
        sucursales_qs = sucursales_qs.filter(pk__in=permitidas.values('pk'))
    sucursales = [
        {'id': item.id, 'nombre': item.nombre}
        for item in sucursales_qs
    ]

    # El catalogo se acota a la sucursal elegida: un producto sin asociacion
    # activa en esa sucursal no se ofrece ni se cuenta en ese contexto.
    productos_qs = Producto.objects.all()
    if sucursal is not None:
        productos_qs = productos_qs.filter(
            sucursales_asociadas__sucursal=sucursal,
            sucursales_asociadas__estado=True,
        ).distinct()

    return Response(
        {
            'vista': vista,
            'codigos': sorted(str(codigo) for codigo in codigos),
            'bloques': bloques,
            'filtros': {
                'periodo': periodo,
                'sucursal': sucursal.id if sucursal else None,
                'sucursales': sucursales,
            },
            'ventas': {
                'hoy': ventas_hoy,
                'semana': {
                    **ventas_semana,
                    'comparacion': comparacion_semana,
                },
                'ultimos_7_dias': {
                    **ventas_7d,
                    'comparacion': comparacion_7d,
                },
                'mes': ventas_mes,
                'periodo': {
                    **periodo_actual,
                    'comparacion': comparacion,
                },
                'pendientes': {
                    **pendientes,
                    'por_vencer': por_vencer_qs.count(),
                    'vencidas': vencidas_qs.count(),
                    'minutos_restantes': minutos_restantes,
                },
                'parciales': parciales,
            },
            'compras': {
                'pendientes_recepcion': compras_pendientes_qs.count(),
                'mes': compras_mes,
            },
            'catalogo': {'productos': productos_qs.count()},
            'stock': {
                'bajo': stock_bajo_qs.count(),
                'negativo': stock_negativo_qs.count(),
                'critico': stock_critico_qs.count(),
            },
            'caja': {
                'abiertas': cajas_abiertas_qs.count(),
                'pausadas': cajas_pausadas_qs.count(),
                'en_curso': cajas_en_curso_qs.count(),
            },
            'equipo': {
                'empleados_activos': empleados_qs.count(),
                'proveedores_activos': proveedores_qs.count(),
            },
            'alertas': {
                'ventas_por_vencer': por_vencer_qs.count(),
                'ventas_vencidas': vencidas_qs.count(),
                'minutos_restantes': minutos_restantes,
                'stock_negativo': stock_negativo_qs.count(),
                'stock_bajo': stock_bajo_qs.count(),
                'stock_critico': stock_critico_qs.count(),
                'compras_por_recibir': compras_pendientes_qs.count(),
                'cajas_abiertas': cajas_abiertas_qs.count(),
                'cajas_pausadas': cajas_pausadas_qs.count(),
                'cajas_en_curso': cajas_en_curso_qs.count(),
            },
            'serie_etiqueta': (
                'Mes actual' if periodo == 'mes' else 'Últimos 7 días'
            ),
            'ventas_por_dia': serie,
            'ventas_recientes': recientes,
            'ventas_por_vencer': ventas_por_vencer,
            'stock_critico': criticos,
            'compras_por_recibir': compras_por_recibir,
            'cajas_abiertas': cajas_abiertas,
        }
    )


def _empleado_de(user):
    empleado = getattr(user, 'empleado', None)
    if empleado is None:
        raise ValueError(
            'El usuario autenticado no tiene un empleado asociado. '
            'Asociele un empleado antes de operar la caja.'
        )
    return empleado


# =============================================================================
# GEOGRAFIA
# =============================================================================

class PaisViewSet(viewsets.ModelViewSet):
    queryset = Pais.objects.all()
    serializer_class = serializers.PaisSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['nombre']
    search_fields = ['nombre']
    ordering_fields = ['nombre']


class ProvinciaViewSet(viewsets.ModelViewSet):
    queryset = Provincia.objects.select_related('pais')
    serializer_class = serializers.ProvinciaSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['pais']
    search_fields = ['nombre', 'pais__nombre']
    ordering_fields = ['nombre']


class LocalidadViewSet(viewsets.ModelViewSet):
    queryset = Localidad.objects.select_related('provincia__pais')
    serializer_class = serializers.LocalidadSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['provincia', 'codigo_postal']
    search_fields = ['nombre', 'codigo_postal', 'provincia__nombre']
    ordering_fields = ['nombre', 'codigo_postal']


class UbicacionViewSet(viewsets.ModelViewSet):
    queryset = Ubicacion.objects.select_related('localidad__provincia')
    serializer_class = serializers.UbicacionSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['localidad']
    search_fields = ['calle', 'localidad__nombre']
    ordering_fields = ['calle', 'nro_calle']


# =============================================================================
# ORGANIZACION
# =============================================================================

class EmpresaViewSet(viewsets.ModelViewSet):
    queryset = Empresa.objects.all()
    serializer_class = serializers.EmpresaSerializer
    permission_classes = [SoloAdministrador]
    filterset_fields = ['condicion_iva']
    search_fields = ['cuit', 'nombre', 'razon_social']
    ordering_fields = ['razon_social', 'nombre']

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return Empresa.objects.all()
        empleado = getattr(user, 'empleado', None)
        if empleado is None:
            return Empresa.objects.none()
        return (
            Empresa.objects.filter(
                sucursales__empleados_asignados__empleado=empleado,
                sucursales__empleados_asignados__estado=True,
            )
            .distinct()
        )


class SucursalViewSet(viewsets.ModelViewSet):
    queryset = Sucursal.objects.select_related('empresa', 'ubicacion__localidad')
    serializer_class = serializers.SucursalSerializer
    permission_classes = [PermisoPorRol]
    roles_escritura = GESTION
    filterset_fields = ['empresa', 'ubicacion', 'es_central']
    search_fields = ['nombre', 'empresa__nombre', 'ubicacion__localidad__nombre']
    ordering_fields = ['nombre']


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.select_related('empleado')
    serializer_class = serializers.UsuarioSerializer
    permission_classes = [IsAdminUser]
    filterset_fields = ['is_active', 'is_staff']
    search_fields = ['username', 'email', 'empleado__legajo']
    ordering_fields = ['username', 'date_joined']

    def get_permissions(self):
        """Editar el propio perfil requiere ser administrador o superusuario."""
        if self.action in ('partial_update', 'update') and str(
            self.kwargs.get('pk')
        ) == str(self.request.user.id):
            self.permission_classes = [SoloAdministrador]
        return super().get_permissions()

    def get_serializer_class(self):
        """Para la edición del propio perfil se usa UsuarioPerfilSerializer,
        que acepta email y datos anidados del empleado."""
        if self.action in ('partial_update', 'update') and str(
            self.kwargs.get('pk')
        ) == str(self.request.user.id):
            return serializers.UsuarioPerfilSerializer
        return super().get_serializer_class()


class EmpleadoViewSet(viewsets.ModelViewSet):
    queryset = Empleado.objects.select_related(
        'usuario',
    ).prefetch_related(
        'roles_asignados__rol',
        'sucursales_asignadas__sucursal',
    )
    serializer_class = serializers.EmpleadoSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = GESTION
    roles_escritura = GESTION
    filterset_fields = ['estado', 'usuario']
    search_fields = ['legajo', 'dni', 'apellido', 'nombre']
    ordering_fields = ['apellido', 'nombre', 'legajo']

    def get_permissions(self):
        """Cualquier usuario autenticado puede cambiar su propia contraseña.

        La accion `cambiar_password` verifica dentro si es el propio empleado
        o si es un administrador cambiando la de otro.
        """
        if self.action == 'cambiar_password':
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset()
        permitidas = _sucursales_permitidas(self.request.user)
        if permitidas is not None:
            queryset = queryset.filter(
                sucursales_asignadas__sucursal__in=permitidas,
                sucursales_asignadas__estado=True,
            ).distinct()
        rol = self.request.query_params.get('rol', '').strip().upper()
        if rol:
            queryset = queryset.filter(
                roles_asignados__estado='AC',
                roles_asignados__rol__codigo=rol,
            ).distinct()
        sucursal = self.request.query_params.get('sucursal', '').strip()
        if sucursal:
            try:
                sucursal_id = int(sucursal)
            except (TypeError, ValueError):
                raise ValidationError(
                    {'sucursal': 'Indique el id de la sucursal.'}
                ) from None
            queryset = queryset.filter(
                sucursales_asignadas__sucursal_id=sucursal_id,
                sucursales_asignadas__estado=True,
            ).distinct()
        param = self.request.query_params.get('puede_operar_caja', '').strip()
        if not param:
            return queryset
        try:
            sucursal_id = int(param)
        except (TypeError, ValueError):
            raise ValidationError(
                {'puede_operar_caja': 'Indique el id de la sucursal.'}
            ) from None
        return caja_service.empleados_que_pueden_abrir_caja(
            queryset,
            sucursal_id,
        )

    def perform_destroy(self, instance):
        if (
            instance.roles_asignados.filter(
                estado='AC',
                rol__codigo=ADMIN,
            ).exists()
            and not es_admin(self.request.user)
        ):
            raise PermissionDenied(
                'Solo un administrador puede eliminar a otro administrador.'
            )
        instance.delete()

    @action(detail=True, methods=['post'], url_path='cambiar-password')
    def cambiar_password(self, request, pk=None):
        """Cambia la contraseña del empleado.

        Si el usuario autenticado es el dueño del empleado, valida
        `password_actual` (o `password_admin` enviado por el frontend) como su
        contraseña actual. Si es un administrador sobre otro empleado, valida
        `password_admin` como su propia contraseña. Invalida los refresh tokens
        del empleado, cerrando sus sesiones.
        """
        empleado = self.get_object()
        usuario_autenticado = request.user
        es_propio = empleado.usuario_id == usuario_autenticado.id

        if not es_propio and not es_admin(usuario_autenticado):
            raise PermissionDenied(
                'Solo un administrador puede cambiar la contraseña '
                'de otro empleado.'
            )

        entrada = serializers.CambiarPasswordSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        if es_propio:
            # El usuario cambia su propia contraseña.
            password_actual = datos.get('password_actual') or datos.get(
                'password_admin', ''
            )
            if not password_actual:
                raise ValidationError(
                    {'password_actual': 'Ingresá tu contraseña actual.'}
                )
            if not usuario_autenticado.check_password(password_actual):
                raise ValidationError(
                    {'password_actual': 'Tu contraseña actual no es correcta.'}
                )
        else:
            # Administrador cambia la de otro empleado.
            password_admin = datos.get('password_admin', '')
            if not password_admin:
                raise ValidationError(
                    {'password_admin': 'Ingresá tu contraseña de administrador.'}
                )
            if not usuario_autenticado.check_password(password_admin):
                raise ValidationError(
                    {'password_admin': 'Tu contraseña actual no es correcta.'}
                )

        empleados_service.cambiar_password(
            empleado,
            datos['password'],
        )
        return Response(
            {
                'detail': (
                    f'La contraseña de {empleado} fue actualizada. '
                    'Se cerraron sus sesiones activas.'
                )
            }
        )


class RolViewSet(viewsets.ModelViewSet):
    queryset = Rol.objects.all()
    serializer_class = serializers.RolSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = GESTION
    roles_escritura = GESTION
    filterset_fields = ['codigo']
    search_fields = ['ocupacion', 'descripcion']
    ordering_fields = ['ocupacion']


class EmpleadoXRolViewSet(viewsets.ModelViewSet):
    queryset = EmpleadoXRol.objects.select_related('empleado', 'rol')
    serializer_class = serializers.EmpleadoXRolSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = GESTION
    roles_escritura = GESTION
    filterset_fields = ['empleado', 'rol', 'estado']
    search_fields = ['empleado__apellido', 'empleado__nombre', 'rol__ocupacion']
    ordering_fields = ['empleado__apellido', 'rol__ocupacion']

    def perform_destroy(self, instance):
        if instance.rol.codigo == ADMIN and not es_admin(self.request.user):
            raise PermissionDenied(
                'Solo un administrador puede quitar el rol de administrador.'
            )
        instance.delete()


class SucursalXEmpleadoViewSet(viewsets.ModelViewSet):
    queryset = SucursalXEmpleado.objects.select_related('sucursal', 'empleado')
    serializer_class = serializers.SucursalXEmpleadoSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = GESTION
    roles_escritura = GESTION
    filterset_fields = ['sucursal', 'empleado', 'estado']
    search_fields = ['sucursal__nombre', 'empleado__apellido', 'empleado__nombre']

    def get_queryset(self):
        return acceso_service.filtrar_por_sucursal(
            super().get_queryset(),
            self.request.user,
            'sucursal',
        )
    ordering_fields = ['fecha_asociacion']


# =============================================================================
# CAJA
# =============================================================================

PATRON_CAJA = re.compile(
    r'^(?:caja\s*)?(?:n[°º.]?\s*)?(\d+)$',
    re.IGNORECASE,
)


class BusquedaMovimientoCajaFilter(SearchFilter):
    """Busca por número de caja cuando el término es "Caja N" o "N".

    El resto de los términos (empleado o sucursal) se resuelven con el
    `SearchFilter` normal. Así "Caja 2" no se confunde con un empleado cuyo
    nombre contenga un número.
    """

    def filter_queryset(self, request, queryset, view):
        termino = (request.query_params.get('search') or '').strip()
        if termino.casefold() in {'caja', 'cajas'}:
            return queryset
        coincidencia = PATRON_CAJA.match(termino)
        if coincidencia:
            return queryset.filter(caja__numero_caja=int(coincidencia.group(1)))
        return super().filter_queryset(request, queryset, view)


class CajaViewSet(viewsets.ModelViewSet):
    queryset = Caja.objects.select_related('sucursal')
    serializer_class = serializers.CajaSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO)
    roles_escritura = GESTION
    filterset_fields = ['sucursal', 'estado']
    search_fields = ['sucursal__nombre']
    ordering_fields = ['sucursal__nombre', 'numero_caja', 'estado']

    def get_queryset(self):
        return acceso_service.filtrar_por_sucursal(
            super().get_queryset(),
            self.request.user,
            'sucursal',
        )

    def perform_create(self, serializer):
        _validar_sucursal_parametro(
            self.request,
            serializer.validated_data['sucursal'].id,
        )
        serializer.save()

    def perform_update(self, serializer):
        sucursal = serializer.validated_data.get(
            'sucursal',
            serializer.instance.sucursal,
        )
        _validar_sucursal_parametro(self.request, sucursal.id)
        serializer.save()


class MovimientoCajaViewSet(mixins.CreateModelMixin, viewsets.ReadOnlyModelViewSet):
    queryset = MovimientoCaja.objects.select_related(
        'caja',
        'caja__sucursal',
        'empleado',
    ).prefetch_related('detalles_cierre__metodo_pago').order_by(
        '-fecha_hora_apertura'
    )
    serializer_class = serializers.MovimientoCajaSerializer
    permission_classes = [PermisoPorRol]
    # El queryset ya limita a cada uno a sus propios movimientos; se excluye
    # solo al usuario sin rol.
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR, DEPOSITO)
    roles_escritura = (ADMIN, GERENTE, CAJERO)
    filterset_fields = ['caja', 'empleado', 'estado']
    filter_backends = [
        DjangoFilterBackend,
        BusquedaMovimientoCajaFilter,
        OrderingFilter,
    ]
    search_fields = [
        'caja__sucursal__nombre',
        'empleado__apellido',
        'empleado__nombre',
    ]
    ordering_fields = ['fecha_hora_apertura', 'monto_inicial']

    def get_queryset(self):
        queryset = super().get_queryset()
        codigos = codigos_activos(self.request.user)
        es_admin_total = self.request.user.is_superuser or ADMIN in codigos
        gestion = es_admin_total or GERENTE in codigos
        empleado = getattr(self.request.user, 'empleado', None)

        # El cajero (y cualquier rol que no sea gestion) solo ve sus propias
        # secciones: la caja está atada a la persona que la abrió.
        if not gestion:
            if empleado is None:
                queryset = queryset.none()
            else:
                queryset = queryset.filter(empleado=empleado)

        caja = self.request.query_params.get('caja', '').strip()
        if caja:
            queryset = queryset.filter(caja_id=caja)

        sucursal = self.request.query_params.get('sucursal', '').strip()
        permitidas = _sucursales_permitidas(self.request.user)
        if sucursal:
            if (
                permitidas is not None
                and not permitidas.filter(pk=sucursal).exists()
            ):
                raise PermissionDenied(
                    'No tenés acceso a la sucursal indicada.'
                )
            queryset = queryset.filter(caja__sucursal_id=sucursal)
        elif permitidas is not None:
            queryset = queryset.filter(
                caja__sucursal__in=permitidas
            )
        return queryset

    def get_permissions(self):
        if self.action == 'auditar':
            self.roles_escritura = GESTION
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == 'create':
            return serializers.AperturaCajaSerializer
        if self.action == 'cerrar':
            return serializers.CierreCajaSerializer
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        empleado = datos.get('empleado')
        historial_motivo = None
        if empleado is not None and not es_gestion(request.user):
            raise ValidationError(
                {
                    'empleado': (
                        'Solo un administrador o gerente puede abrir la caja '
                        'a nombre de otro empleado.'
                    )
                }
            )
        if empleado is None:
            empleado = _empleado_de(request.user)
        else:
            historial_motivo = f'Apertura a nombre de {empleado}'

        _validar_sucursal_parametro(request, datos['caja'].sucursal_id)

        seccion = caja_service.abrir_seccion(
            datos['caja'],
            empleado,
            datos['monto_inicial'],
            historial_motivo=historial_motivo,
            historial_usuario=request.user,
            observaciones_apertura=datos.get('observaciones_apertura'),
        )
        salida = serializers.MovimientoCajaSerializer(
            seccion,
            context=self.get_serializer_context(),
        )
        return Response(salida.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def sugerencia(self, request):
        """Monto sugerido para abrir: efectivo contado en el ultimo cierre."""
        if not (codigos_activos(request.user) & {ADMIN, GERENTE, CAJERO}):
            raise PermissionDenied(
                'Solo administracion o caja puede consultar la sugerencia.'
            )
        caja = request.query_params.get('caja', '').strip()
        sucursal = request.query_params.get('sucursal', '').strip()
        if not caja or not sucursal:
            raise ValidationError(
                {
                    'detail': 'Indicá la caja y la sucursal.',
                    'codigo': 'validacion',
                }
            )
        try:
            caja_id, sucursal_id = int(caja), int(sucursal)
        except (TypeError, ValueError):
            raise ValidationError(
                {
                    'detail': 'La caja y la sucursal deben ser ids.',
                    'codigo': 'validacion',
                }
            ) from None
        caja_obj = Caja.objects.filter(pk=caja_id).first()
        if caja_obj is None:
            raise ValidationError(
                {
                    'detail': 'La caja indicada no existe.',
                    'codigo': 'no_encontrado',
                }
            )
        if caja_obj.sucursal_id != sucursal_id:
            raise ValidationError(
                {
                    'detail': 'La caja no pertenece a la sucursal indicada.',
                    'codigo': 'validacion',
                }
            )
        sugerencia = caja_service.sugerir_apertura(caja_obj)
        return Response(
            {
                'monto_sugerido': str(sugerencia['monto_sugerido']),
                'encontrado': sugerencia['encontrado'],
                'seccion_id': sugerencia['seccion_id'],
                'fecha_hora_cierre': sugerencia['fecha_hora_cierre'],
            }
        )

    @action(detail=True, methods=['post'])
    def cerrar(self, request, pk=None):
        entrada = serializers.CierreCajaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        seccion = caja_service.cerrar_seccion(
            self.get_object(),
            entrada.validated_data['montos_reales'],
            entrada.validated_data.get('observaciones'),
            clave=entrada.validated_data.get('clave', ''),
            password=entrada.validated_data['password'],
            usuario=request.user,
        )
        salida = serializers.MovimientoCajaSerializer(
            seccion,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)

    @action(detail=False, methods=['get'], url_path='abiertas')
    def abiertas(self, request):
        """Movimientos abiertos de las sucursales permitidas.

        La caja es de la sucursal, no de la persona: un vendedor o el
        encargado de deposito puede registrar una venta o una compra contra
        la caja que abrio el cajero en el mismo local. El movimiento sigue
        registrando quien lo abrio, para la auditoria y el cierre.
        """
        if not codigos_activos(request.user):
            raise PermissionDenied(
                'Tu usuario no tiene un rol activo para operar en caja.'
            )
        queryset = (
            MovimientoCaja.objects.filter(
                estado=MovimientoCaja.EstadoMovimiento.ABIERTA,
            )
            .select_related('caja', 'caja__sucursal', 'empleado')
            .order_by('-fecha_hora_apertura')
        )
        queryset = acceso_service.filtrar_por_sucursal(
            queryset,
            request.user,
            'caja__sucursal',
        )
        salida = serializers.MovimientoCajaSerializer(
            queryset,
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)

    @action(detail=False, methods=['get'], url_path='mia')
    def mia(self, request):
        """Seccion abierta o pausada del usuario autenticado.

        Sirve para no dejar salir a nadie con la caja abierta.
        """
        empleado = getattr(request.user, 'empleado', None)
        if empleado is None:
            return Response({'seccion': None, 'tiene_caja_abierta': False})

        seccion = (
            MovimientoCaja.objects.filter(
                empleado=empleado,
                estado__in=[
                    MovimientoCaja.EstadoMovimiento.ABIERTA,
                    MovimientoCaja.EstadoMovimiento.PAUSADA,
                ],
            )
            .select_related(
                'caja',
                'caja__sucursal',
            )
            .order_by('-fecha_hora_apertura')
            .first()
        )
        if seccion is None:
            return Response({'seccion': None, 'tiene_caja_abierta': False})

        return Response(
            {
                'seccion': serializers.MovimientoCajaSerializer(
                    seccion,
                    context=self.get_serializer_context(),
                ).data,
                'tiene_caja_abierta': True,
            }
        )

    @action(detail=True, methods=['post'])
    def auditar(self, request, pk=None):
        seccion = caja_service.auditar_seccion(self.get_object())
        salida = serializers.MovimientoCajaSerializer(
            seccion,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)

    @action(detail=True, methods=['post'])
    def pausar(self, request, pk=None):
        """Deja la seccion en pausa con un motivo obligatorio."""
        entrada = serializers.PausaCajaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        seccion = caja_service.pausar_seccion(
            self.get_object(),
            entrada.validated_data['motivo'],
            request.user,
        )
        salida = serializers.MovimientoCajaSerializer(
            seccion,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)

    @action(detail=True, methods=['post'])
    def reanudar(self, request, pk=None):
        """Vuelve a abrir la seccion; pide la contraseña del dueño."""
        entrada = serializers.ReanudarCajaSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        seccion = caja_service.reanudar_seccion(
            self.get_object(),
            entrada.validated_data['clave'],
            request.user,
        )
        salida = serializers.MovimientoCajaSerializer(
            seccion,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)

    @action(detail=True, methods=['get'])
    def teorico(self, request, pk=None):
        """Teorico por metodo de pago para preparar el cierre."""
        seccion = self.get_object()
        if seccion.estado == MovimientoCaja.EstadoMovimiento.PAUSADA:
            raise ValidationError(
                {
                    'detail': 'El movimiento está en pausa: primero hay que reanudarlo.',
                    'codigo': 'error_de_negocio',
                }
            )
        if seccion.estado != MovimientoCaja.EstadoMovimiento.ABIERTA:
            raise ValidationError(
                {
                    'detail': 'El movimiento de caja no está abierto.',
                    'codigo': 'error_de_negocio',
                }
            )
        return Response(
            [
                {
                    'metodo_pago': item['metodo_pago'].id,
                    'metodo_pago_detalle': str(item['metodo_pago']),
                    'monto_sistema': str(item['monto_sistema']),
                    'cobrado_sistema': str(item['cobrado_sistema']),
                    'pagado_sistema': str(item['pagado_sistema']),
                    'neto_sistema': str(item['neto_sistema']),
                    'es_efectivo': item['metodo_pago'].es_efectivo,
                }
                for item in caja_service.calcular_teorico(seccion)
            ]
        )


# =============================================================================
# CATALOGO
# =============================================================================

class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = serializers.CategoriaSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR, DEPOSITO)
    roles_escritura = GESTION
    search_fields = ['categorias']
    ordering_fields = ['categorias']


class MarcaViewSet(viewsets.ModelViewSet):
    queryset = Marca.objects.all()
    serializer_class = serializers.MarcaSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR, DEPOSITO)
    roles_escritura = GESTION
    search_fields = ['marcas']
    ordering_fields = ['marcas']


class UnidadViewSet(viewsets.ModelViewSet):
    queryset = Unidad.objects.all()
    serializer_class = serializers.UnidadSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR, DEPOSITO)
    roles_escritura = GESTION
    search_fields = ['unidades']
    ordering_fields = ['unidades']


class ProductoViewSet(viewsets.ModelViewSet):
    queryset = (
        Producto.objects.select_related('categoria', 'marca', 'unidad')
        .prefetch_related(
            'sucursales_asociadas__sucursal',
            'proveedores_asociados',
        )
    )
    serializer_class = serializers.ProductoSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR, DEPOSITO)
    roles_escritura = GESTION
    filterset_fields = ['categoria', 'marca', 'unidad']
    search_fields = ['codigo', 'nombre', 'descripcion']
    ordering_fields = ['nombre', 'codigo', 'precio_unidad', 'id']

    def get_queryset(self):
        queryset = super().get_queryset()
        sucursal = self.request.query_params.get('sucursal', '').strip()
        if sucursal:
            queryset = queryset.filter(
                sucursales_asociadas__sucursal_id=sucursal,
                sucursales_asociadas__estado=True,
            ).distinct()
        return queryset


class ProductoXSucursalViewSet(viewsets.ModelViewSet):
    queryset = ProductoXSucursal.objects.select_related('producto', 'sucursal')
    serializer_class = serializers.ProductoXSucursalSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR, DEPOSITO)
    roles_escritura = GESTION
    filterset_fields = ['producto', 'sucursal', 'estado']
    search_fields = ['producto__nombre', 'producto__codigo', 'sucursal__nombre']
    ordering_fields = ['producto__nombre']


# =============================================================================
# STOCK
# =============================================================================

class DepositoViewSet(viewsets.ModelViewSet):
    queryset = Deposito.objects.select_related('sucursal')
    serializer_class = serializers.DepositoSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR, DEPOSITO)
    roles_escritura = (ADMIN, GERENTE, DEPOSITO)
    filterset_fields = ['sucursal', 'es_predeterminado']
    search_fields = ['nombre', 'descripcion', 'sucursal__nombre']
    ordering_fields = ['nombre']

    def get_queryset(self):
        return acceso_service.filtrar_por_sucursal(
            super().get_queryset(),
            self.request.user,
            'sucursal',
        )

    def perform_create(self, serializer):
        _validar_sucursal_parametro(
            self.request,
            serializer.validated_data['sucursal'].id,
        )
        serializer.save()

    def perform_update(self, serializer):
        sucursal = serializer.validated_data.get(
            'sucursal',
            serializer.instance.sucursal,
        )
        _validar_sucursal_parametro(self.request, sucursal.id)
        serializer.save()


class StockViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = Stock.objects.select_related(
        'producto__unidad',
        'sucursal',
    )
    serializer_class = serializers.StockSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR, DEPOSITO)
    roles_escritura = (ADMIN, GERENTE, DEPOSITO)
    filterset_fields = ['producto', 'sucursal']
    search_fields = ['producto__nombre', 'producto__codigo', 'sucursal__nombre']
    ordering_fields = ['producto__nombre', 'cantidad']

    def get_queryset(self):
        queryset = acceso_service.filtrar_por_sucursal(
            super().get_queryset(),
            self.request.user,
            'sucursal',
        )
        alerta = self.request.query_params.get('alerta', '').strip()
        if alerta == 'negativo':
            queryset = queryset.filter(cantidad__lt=0)
        elif alerta == 'minimo':
            # Solo cuenta como "bajo el minimo" si hay un minimo configurado:
            # un producto con cant_min = 0 y stock 0 no esta bajo el minimo.
            queryset = queryset.filter(
                cantidad__gte=0,
                cantidad__lte=F('cant_min'),
                cant_min__gt=0,
            )
        elif alerta == 'critico':
            queryset = queryset.filter(
                Q(cantidad__lt=0)
                | Q(
                    cantidad__gte=0,
                    cantidad__lte=F('cant_min'),
                    cant_min__gt=0,
                )
            )
        elif alerta == 'ok':
            queryset = queryset.filter(cantidad__gte=0).filter(
                Q(cant_min=0) | Q(cantidad__gt=F('cant_min'))
            )
        return queryset

    def get_serializer_class(self):
        if self.action in ('update', 'partial_update'):
            return serializers.StockConfigSerializer
        if self.action == 'ajustar':
            return serializers.AjusteStockSerializer
        return super().get_serializer_class()

    def update(self, request, *args, **kwargs):
        parcial = kwargs.pop('partial', False)
        stock = self.get_object()
        entrada = self.get_serializer(
            stock,
            data=request.data,
            partial=parcial,
        )
        entrada.is_valid(raise_exception=True)
        entrada.save()
        salida = serializers.StockSerializer(
            stock,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)

    @action(detail=True, methods=['post'])
    def ajustar(self, request, pk=None):
        stock_obj = self.get_object()
        entrada = self.get_serializer(
            data=request.data,
            context={**self.get_serializer_context(), 'stock': stock_obj},
        )
        entrada.is_valid(raise_exception=True)
        stock = stock_service.ajustar_stock_detallado(
            stock_obj,
            entrada.validated_data.get('reducciones') or [],
            entrada.validated_data.get('ingresos') or [],
            entrada.validated_data['motivo'],
        )
        salida = serializers.StockSerializer(
            stock,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)

    @action(detail=False, methods=['post'], url_path='carga-masiva')
    def carga_masiva(self, request):
        entrada = serializers.CargaStockSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        _validar_sucursal_parametro(request, datos['sucursal'].id)
        _validar_sucursal_parametro(request, datos['deposito'].sucursal_id)
        stocks = stock_service.cargar_stock_sucursal(
            datos['sucursal'],
            datos['deposito'],
            datos['items'],
            datos['motivo'],
        )
        salida = serializers.StockSerializer(
            stocks,
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)


class DetalleStockViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    queryset = DetalleStock.objects.select_related(
        'stock__producto',
        'stock__sucursal',
        'deposito',
    )
    serializer_class = serializers.DetalleStockSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR, DEPOSITO)
    roles_escritura = (ADMIN, GERENTE, DEPOSITO)
    filterset_fields = ['stock', 'deposito']
    search_fields = ['lote', 'stock__producto__nombre', 'stock__producto__codigo']
    ordering_fields = ['fecha_ingreso', 'cantidad']

    def get_queryset(self):
        return acceso_service.filtrar_por_sucursal(
            super().get_queryset(),
            self.request.user,
            'stock__sucursal',
        )

    def get_serializer_class(self):
        if self.action in ('update', 'partial_update'):
            return serializers.DetalleStockUpdateSerializer
        if self.action == 'mover':
            return serializers.MoverLoteSerializer
        return super().get_serializer_class()

    @action(detail=True, methods=['post'])
    def mover(self, request, pk=None):
        """Mueve el lote completo a otro deposito de la misma sucursal."""
        detalle = self.get_object()
        entrada = serializers.MoverLoteSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        detalle = stock_service.mover_lote(
            detalle,
            entrada.validated_data['deposito'],
            entrada.validated_data['motivo'],
        )
        salida = serializers.DetalleStockSerializer(
            detalle,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)


# =============================================================================
# PROVEEDORES
# =============================================================================

class ProveedorViewSet(viewsets.ModelViewSet):
    queryset = Proveedor.objects.prefetch_related(
        'sucursales_asociadas__sucursal',
    )
    serializer_class = serializers.ProveedorSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR, DEPOSITO)
    roles_escritura = (ADMIN, GERENTE, DEPOSITO)
    filterset_fields = ['estado_prov']
    search_fields = ['cuit', 'nombre', 'razon_social']
    ordering_fields = ['razon_social', 'nombre']

    @action(detail=True, methods=['post'], url_path='productos')
    def productos(self, request, pk=None):
        proveedor = self.get_object()
        entrada = serializers.ProductoXProveedorBulkSerializer(
            data=request.data,
        )
        entrada.is_valid(raise_exception=True)
        asociaciones = proveedores_service.asociar_productos(
            proveedor,
            entrada.validated_data['items'],
        )
        asociaciones = ProductoXProveedor.objects.filter(
            id__in=[asociacion.id for asociacion in asociaciones],
        ).select_related(
            'producto__categoria',
            'producto__marca',
            'producto__unidad',
            'proveedor',
        ).order_by('id')
        salida = serializers.ProductoXProveedorSerializer(
            asociaciones,
            many=True,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)


class ProveedorXSucursalViewSet(viewsets.ModelViewSet):
    queryset = ProveedorXSucursal.objects.select_related('proveedor', 'sucursal')
    serializer_class = serializers.ProveedorXSucursalSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR, DEPOSITO)
    roles_escritura = (ADMIN, GERENTE, DEPOSITO)
    filterset_fields = ['proveedor', 'sucursal', 'estado']
    search_fields = ['proveedor__razon_social', 'sucursal__nombre']
    ordering_fields = ['proveedor__razon_social']


class ProductoXProveedorViewSet(viewsets.ModelViewSet):
    queryset = ProductoXProveedor.objects.select_related(
        'producto__categoria',
        'producto__marca',
        'producto__unidad',
        'proveedor',
    )
    serializer_class = serializers.ProductoXProveedorSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR, DEPOSITO)
    roles_escritura = (ADMIN, GERENTE, DEPOSITO)
    filterset_fields = ['producto', 'proveedor', 'estado']
    search_fields = [
        'producto__nombre',
        'producto__codigo',
        'proveedor__razon_social',
        'codigo_producto_proveedor',
    ]
    ordering_fields = ['precio_lista']


# =============================================================================
# PAGOS
# =============================================================================

class MetodoPagoViewSet(viewsets.ModelViewSet):
    queryset = MetodoPago.objects.all()
    serializer_class = serializers.MetodoPagoSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR, DEPOSITO)
    roles_escritura = GESTION
    filterset_fields = ['estado']
    search_fields = ['metodo_pago']
    ordering_fields = ['metodo_pago']


# =============================================================================
# VENTAS
# =============================================================================

class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = serializers.ClienteSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR)
    roles_escritura = (ADMIN, GERENTE, CAJERO, VENDEDOR)
    filterset_fields = ['estado', 'condicion_iva', 'tipo_documento']
    search_fields = [
        'dni',
        'razon_social',
        'nombre',
        'apellido',
        'email',
        'telefono',
        'direccion',
    ]
    ordering_fields = ['apellido', 'nombre', 'razon_social', 'estado']

    def get_serializer_class(self):
        if self.action == 'estado':
            return serializers.ClienteEstadoSerializer
        return super().get_serializer_class()

    @action(detail=True, methods=['patch'])
    def estado(self, request, pk=None):
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        cliente = self.get_object()
        cliente.estado = entrada.validated_data['estado']
        cliente.save(update_fields=['estado'])
        salida = serializers.ClienteSerializer(
            cliente,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)

    @action(detail=True, methods=['get'])
    def resumen(self, request, pk=None):
        cliente = self.get_object()
        ventas = list(
            cliente.ventas.exclude(estado=Venta.EstadoVenta.ANULADA)
            .prefetch_related('pagos')
            .order_by('-fecha_venta')
        )

        total_comprado = Decimal('0.00')
        total_pagado = Decimal('0.00')
        saldo_pendiente = Decimal('0.00')
        recientes = []

        for venta in ventas:
            pagado = sum(
                (pago.monto_pagado for pago in venta.pagos.all()),
                Decimal('0.00'),
            )
            saldo = max(Decimal('0.00'), venta.monto_venta - pagado)
            total_comprado += venta.monto_venta
            total_pagado += pagado
            saldo_pendiente += saldo

            if len(recientes) < 8:
                recientes.append(
                    {
                        'id': venta.id,
                        'fecha_venta': venta.fecha_venta.isoformat(),
                        'monto_venta': str(venta.monto_venta),
                        'estado': venta.estado,
                        'estado_detalle': venta.get_estado_display(),
                        'saldo': str(saldo),
                    }
                )

        return Response(
            {
                'cliente': cliente.id,
                'cantidad_ventas': len(ventas),
                'total_comprado': str(total_comprado),
                'total_pagado': str(total_pagado),
                'saldo_pendiente': str(saldo_pendiente),
                'ultima_venta': (
                    ventas[0].fecha_venta.isoformat() if ventas else None
                ),
                'ventas_recientes': recientes,
            }
        )


class VentaViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    queryset = (
        Venta.objects.select_related(
            'movimiento_caja__caja__sucursal',
            'cliente',
        ).prefetch_related('detalles__producto', 'pagos__metodo_pago')
    )
    serializer_class = serializers.VentaSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR)
    roles_escritura = (ADMIN, GERENTE, CAJERO, VENDEDOR)
    filterset_fields = ['movimiento_caja', 'cliente', 'estado']
    ordering_fields = ['fecha_venta', 'monto_venta']

    def get_queryset(self):
        queryset = acceso_service.filtrar_por_sucursal(
            super().get_queryset(),
            self.request.user,
            'movimiento_caja__caja__sucursal',
        )
        search = self.request.query_params.get('search', '').strip().lstrip('#')
        if search:
            filtro = (
                Q(cliente__razon_social__icontains=search)
                | Q(cliente__nombre__icontains=search)
                | Q(cliente__apellido__icontains=search)
                | Q(cliente__dni__icontains=search)
                | Q(cliente_venta__icontains=search)
            )
            if search.isdigit():
                numero = int(search)
                filtro |= Q(id=numero) | Q(movimiento_caja_id=numero)
            queryset = queryset.filter(filtro)

        sucursal = self.request.query_params.get('sucursal', '').strip()
        if sucursal:
            _validar_sucursal_parametro(self.request, sucursal)
            queryset = queryset.filter(
                movimiento_caja__caja__sucursal_id=sucursal,
            )

        alerta = self.request.query_params.get('alerta', '').strip()
        if alerta in ('por_vencer', 'vencida'):
            minutos = getattr(
                settings,
                'VENTAS_MINUTOS_PARA_CONFIRMAR',
                30,
            )
            ahora = timezone.now()
            queryset = queryset.filter(
                estado=Venta.EstadoVenta.PENDIENTE,
                pagos__isnull=True,
            )
            if alerta == 'por_vencer':
                queryset = queryset.filter(
                    fecha_venta__gt=ahora - timedelta(minutes=minutos),
                    fecha_venta__lte=ahora
                    - timedelta(minutes=max(minutos - 10, 0)),
                )
            else:
                queryset = queryset.filter(
                    fecha_venta__lte=ahora - timedelta(minutes=minutos),
                )

        return _filtrar_por_fecha(
            queryset,
            self.request.query_params,
            'fecha_venta',
        )

    def get_permissions(self):
        if self.action in ('confirmar', 'cancelar', 'cobrar'):
            self.roles_escritura = (ADMIN, GERENTE, CAJERO)
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == 'create':
            return serializers.VentaCreateSerializer
        if self.action == 'cobrar':
            return serializers.CobroVentaSerializer
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        _validar_sucursal_parametro(
            request,
            datos['movimiento_caja'].caja.sucursal_id,
        )

        venta = ventas_service.crear_venta(
            datos['movimiento_caja'],
            datos['items'],
            datos.get('cliente'),
            datos.get('cliente_venta'),
        )
        salida = serializers.VentaSerializer(
            venta,
            context=self.get_serializer_context(),
        )
        return Response(salida.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def confirmar(self, request, pk=None):
        venta = ventas_service.confirmar_venta(self.get_object())
        salida = serializers.VentaSerializer(
            venta,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)

    @action(detail=True, methods=['post'])
    def cobrar(self, request, pk=None):
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        venta_actual = self.get_object()
        movimiento = _movimiento_de_cobro(
            request,
            venta_actual,
            datos.get('movimiento_caja'),
        )
        _, venta = pagos_service.registrar_pagos_venta(
            venta_actual,
            datos['pagos'],
            datos.get('confirmar', False),
            clave=datos.get('clave', ''),
            movimiento_caja=movimiento,
        )
        salida = serializers.VentaSerializer(
            venta,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        entrada = serializers.VentaCancelarSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        venta = ventas_service.cancelar_venta(
            self.get_object(),
            motivo=entrada.validated_data['motivo'],
        )
        salida = serializers.VentaSerializer(
            venta,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)


class DetalleVentaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DetalleVenta.objects.select_related('venta', 'producto')
    serializer_class = serializers.DetalleVentaSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR)
    filterset_fields = ['venta', 'producto']
    search_fields = ['producto__nombre', 'producto__codigo']
    ordering_fields = ['subtotal']


class FacturaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Factura.objects.select_related('venta')
    serializer_class = serializers.FacturaSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO)
    filterset_fields = ['venta', 'tipo']
    ordering_fields = ['fecha_emision']


class MetodoPagoXVentaViewSet(mixins.CreateModelMixin, viewsets.ReadOnlyModelViewSet):
    queryset = MetodoPagoXVenta.objects.select_related('metodo_pago', 'venta')
    serializer_class = serializers.MetodoPagoXVentaSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO)
    roles_escritura = (ADMIN, GERENTE, CAJERO)
    filterset_fields = ['venta', 'metodo_pago']
    ordering_fields = ['monto_pagado']

    def get_serializer_class(self):
        if self.action == 'create':
            return serializers.PagoVentaCreateSerializer
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        venta = datos['venta']
        movimiento = _movimiento_de_cobro(
            request,
            venta,
            datos.get('movimiento_caja'),
        )
        pago = pagos_service.registrar_pago_venta(
            venta,
            datos['metodo_pago'],
            datos['monto_pagado'],
            clave=datos.get('clave', ''),
            movimiento_caja=movimiento,
        )
        salida = serializers.MetodoPagoXVentaSerializer(pago)
        return Response(salida.data, status=status.HTTP_201_CREATED)


# =============================================================================
# COMPRAS
# =============================================================================

class CompraViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    queryset = (
        Compra.objects.select_related('movimiento_caja__caja', 'proveedor')
        .prefetch_related(
            'detalles__producto',
            'pagos__metodo_pago',
        )
    )
    serializer_class = serializers.CompraSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR, DEPOSITO)
    roles_escritura = (ADMIN, GERENTE, DEPOSITO)
    filterset_fields = [
        'movimiento_caja',
        'deposito',
        'proveedor',
        'estado',
        'estado_entrega',
    ]
    ordering_fields = ['fecha_compra', 'monto_compra']

    def get_permissions(self):
        # Pagar y anular quedan en administracion (AD/GE).
        # El resto (registrar, poner en camino, recibir) lo puede hacer
        # cualquiera que opere en el corralon.
        if self.action in ('pagar', 'anular'):
            self.roles_escritura = (ADMIN, GERENTE)
        else:
            self.roles_escritura = (
                ADMIN,
                GERENTE,
                DEPOSITO,
                CAJERO,
                VENDEDOR,
            )
        return super().get_permissions()

    def get_queryset(self):
        queryset = acceso_service.filtrar_por_sucursal(
            super().get_queryset(),
            self.request.user,
            'movimiento_caja__caja__sucursal',
        )
        search = self.request.query_params.get('search', '').strip().lstrip('#')
        if search:
            filtro = (
                Q(proveedor__razon_social__icontains=search)
                | Q(proveedor__nombre__icontains=search)
                | Q(proveedor__cuit__icontains=search)
            )
            if search.isdigit():
                numero = int(search)
                filtro |= Q(id=numero) | Q(movimiento_caja_id=numero)
            queryset = queryset.filter(filtro)

        sucursal = self.request.query_params.get('sucursal', '').strip()
        if sucursal:
            _validar_sucursal_parametro(self.request, sucursal)
            queryset = queryset.filter(
                movimiento_caja__caja__sucursal_id=sucursal,
            )

        por_recibir = self.request.query_params.get('por_recibir')
        if por_recibir in ('1', 'true', 'True'):
            queryset = queryset.filter(
                fecha_recepcion__isnull=True,
            ).exclude(estado=Compra.EstadoCompra.ANULADA)

        return _filtrar_por_fecha(
            queryset,
            self.request.query_params,
            'fecha_compra',
        )

    def get_serializer_class(self):
        if self.action == 'create':
            return serializers.CompraCreateSerializer
        if self.action == 'en_camino':
            return serializers.CompraEnCaminoSerializer
        if self.action == 'pagar':
            return serializers.PagoCompraMultipleSerializer
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        _validar_sucursal_parametro(
            request,
            datos['movimiento_caja'].caja.sucursal_id,
        )
        if datos.get('deposito') is not None:
            _validar_sucursal_parametro(
                request,
                datos['deposito'].sucursal_id,
            )

        roles = codigos_activos(request.user)
        es_gestion_compra = request.user.is_superuser or bool(
            roles & {ADMIN, GERENTE}
        )
        estado_entrega = datos.get('estado_entrega')
        fecha_estimada = datos.get('fecha_estimada_llegada')
        if not es_gestion_compra:
            estado_entrega = Compra.EstadoEntrega.PENDIENTE
            fecha_estimada = None

        compra = compras_service.registrar_compra(
            datos['movimiento_caja'],
            datos['proveedor'],
            datos.get('deposito'),
            datos['items'],
            estado_entrega,
            fecha_estimada,
        )
        salida = serializers.CompraSerializer(
            compra,
            context=self.get_serializer_context(),
        )
        return Response(salida.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def pagar(self, request, pk=None):
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)

        compra_actual = self.get_object()
        movimiento = _movimiento_de_cobro(
            request,
            compra_actual,
            entrada.validated_data.get('movimiento_caja'),
        )
        _, compra = pagos_service.registrar_pagos_compra(
            compra_actual,
            entrada.validated_data['pagos'],
            clave=entrada.validated_data.get('clave', ''),
            movimiento_caja=movimiento,
        )
        salida = serializers.CompraSerializer(
            compra,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)

    @action(detail=True, methods=['post'])
    def anular(self, request, pk=None):
        entrada = serializers.AnularCompraSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        compra = compras_service.anular_compra(
            self.get_object(),
            entrada.validated_data['motivo'],
        )
        salida = serializers.CompraSerializer(
            compra,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)

    @action(detail=True, methods=['post'])
    def recibir(self, request, pk=None):
        compra = self.get_object()
        if compra.deposito_id is not None:
            _validar_sucursal_parametro(
                request,
                compra.deposito.sucursal_id,
            )
        compra = compras_service.recibir_compra(compra)
        salida = serializers.CompraSerializer(
            compra,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)

    @action(detail=True, methods=['post'], url_path='en-camino')
    def en_camino(self, request, pk=None):
        compra = self.get_object()
        entrada = serializers.CompraEnCaminoSerializer(
            data=request.data,
            context={'compra': compra},
        )
        entrada.is_valid(raise_exception=True)
        compra = compras_service.marcar_en_camino(
            compra,
            entrada.validated_data.get('fecha_estimada_llegada'),
        )
        salida = serializers.CompraSerializer(
            compra,
            context=self.get_serializer_context(),
        )
        return Response(salida.data)


class DetalleCompraViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = DetalleCompra.objects.select_related('compra', 'producto')
    serializer_class = serializers.DetalleCompraSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = (ADMIN, GERENTE, CAJERO, VENDEDOR, DEPOSITO)
    filterset_fields = ['compra', 'producto']
    search_fields = ['producto__nombre', 'producto__codigo']
    ordering_fields = ['subtotal']


class MetodoPagoXCompraViewSet(mixins.CreateModelMixin, viewsets.ReadOnlyModelViewSet):
    queryset = MetodoPagoXCompra.objects.select_related('metodo_pago', 'compra')
    serializer_class = serializers.MetodoPagoXCompraSerializer
    permission_classes = [PermisoPorRol]
    # Pagar una compra es de administracion (AD/GE).
    roles_lectura = (ADMIN, GERENTE)
    roles_escritura = (ADMIN, GERENTE)
    filterset_fields = ['compra', 'metodo_pago']
    ordering_fields = ['monto_pagado']

    def get_serializer_class(self):
        if self.action == 'create':
            return serializers.PagoCompraCreateSerializer
        return super().get_serializer_class()

    def create(self, request, *args, **kwargs):
        entrada = self.get_serializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data

        compra = datos['compra']
        movimiento = _movimiento_de_cobro(
            request,
            compra,
            datos.get('movimiento_caja'),
        )
        pago = pagos_service.registrar_pago_compra(
            compra,
            datos['metodo_pago'],
            datos['monto_pagado'],
            clave=datos.get('clave', ''),
            movimiento_caja=movimiento,
        )
        salida = serializers.MetodoPagoXCompraSerializer(pago)
        return Response(salida.data, status=status.HTTP_201_CREATED)


class RegistroActividadViewSet(viewsets.ReadOnlyModelViewSet):
    """Registro de cambios del sistema (auditoria).

    Solo lectura. Se alimenta automaticamente desde el historial de
    simple-history de los modelos con `history = HistoricalRecords()`.
    """

    queryset = RegistroActividad.objects.select_related('usuario').all()
    serializer_class = serializers.RegistroActividadSerializer
    permission_classes = [PermisoPorRol]
    roles_lectura = GESTION
    roles_escritura = ()
    search_fields = ['modelo', 'objeto', 'usuario__username']
    ordering_fields = ['fecha', 'modelo', 'accion']
    ordering = ['-fecha']

    ACCIONES_VALIDAS = {
        RegistroActividad.TipoAccion.CREAR,
        RegistroActividad.TipoAccion.EDITAR,
        RegistroActividad.TipoAccion.ELIMINAR,
    }

    def _filtrar(self, queryset):
        """Aplica los filtros de la vista (modelo, accion, usuario y fechas).

        Usa `iexact` para que el slug del modelo y la accion se puedan enviar
        en cualquier capitalizacion.
        """
        modelo = self.request.query_params.get('modelo', '').strip()
        accion = self.request.query_params.get('accion', '').strip().upper()
        usuario = self.request.query_params.get('usuario', '').strip()
        fecha_desde = self.request.query_params.get('fecha_desde', '').strip()
        fecha_hasta = self.request.query_params.get('fecha_hasta', '').strip()

        if modelo:
            queryset = queryset.filter(modelo__iexact=modelo)

        if accion:
            if accion not in self.ACCIONES_VALIDAS:
                raise ValidationError(
                    {
                        'accion': (
                            'La acción debe ser CREAR, EDITAR o ELIMINAR.'
                        )
                    }
                )
            queryset = queryset.filter(accion__iexact=accion)

        if usuario:
            try:
                usuario_id = int(usuario)
            except (TypeError, ValueError):
                raise ValidationError(
                    {'usuario': 'El usuario debe ser un id válido.'}
                ) from None
            queryset = queryset.filter(usuario_id=usuario_id)

        if fecha_desde:
            queryset = queryset.filter(fecha__date__gte=fecha_desde)
        if fecha_hasta:
            queryset = queryset.filter(fecha__date__lte=fecha_hasta)

        return queryset

    def get_queryset(self):
        return self._filtrar(super().get_queryset())

    @action(detail=False, methods=['get'])
    def resumen(self, request):
        """Totales por accion y por modelo con los filtros aplicados.

        Se calcula sobre todo el conjunto filtrado (sin paginar) para que los
        KPIs del frontend reflejen el filtro real.
        """
        queryset = self.filter_queryset(
            self._filtrar(super().get_queryset())
        )
        # Sin ordering: el ORDER BY se suma al GROUP BY de values().annotate()
        # y devuelve una fila por fecha en lugar de una por accion/modelo.
        base = queryset.order_by()
        por_accion = {
            fila['accion']: fila['cantidad']
            for fila in base.values('accion').annotate(
                cantidad=Count('id')
            )
        }
        por_modelo = {
            fila['modelo']: fila['cantidad']
            for fila in base.values('modelo').annotate(
                cantidad=Count('id')
            )
        }
        return Response(
            {
                'total': queryset.count(),
                'por_accion': por_accion,
                'por_modelo': por_modelo,
            }
        )
