from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (
    Empleado,
    HistoricalDetalleCierreCaja,
    HistoricalSeccionCaja,
    Usuario,
)


class EmpleadoInline(admin.StackedInline):
    model = Empleado
    can_delete = False
    extra = 0
    fk_name = 'usuario'


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    inlines = [EmpleadoInline]
    list_display = ['username', 'email', 'is_staff', 'is_active']
    ordering = ['username']
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Informacion personal', {'fields': ('email',)}),
        (
            'Permisos',
            {
                'fields': (
                    'is_active',
                    'is_staff',
                    'is_superuser',
                    'groups',
                    'user_permissions',
                )
            },
        ),
        ('Fechas importantes', {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (
            None,
            {
                'classes': ('wide',),
                'fields': ('username', 'email', 'password1', 'password2'),
            },
        ),
    )


@admin.register(Empleado)
class EmpleadoAdmin(admin.ModelAdmin):
    list_display = ['legajo', 'apellido', 'nombre', 'dni', 'estado', 'usuario']
    list_filter = ['estado']
    search_fields = ['legajo', 'dni', 'apellido', 'nombre']
    ordering = ['apellido', 'nombre']


class _HistoricoAdmin(admin.ModelAdmin):
    """Solo lectura: las entradas las genera simple-history en cada cambio."""

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def get_readonly_fields(self, request, obj=None):
        return [campo.name for campo in self.model._meta.fields]

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser or request.user.is_staff


@admin.register(HistoricalSeccionCaja)
class HistoricalSeccionCajaAdmin(_HistoricoAdmin):
    list_display = (
        'history_id',
        'history_date',
        'history_user',
        'history_type',
        'history_change_reason',
        'sucursal_caja',
        'empleado',
        'estado',
    )
    list_filter = ('history_type', 'estado')
    search_fields = ('empleado__apellido', 'empleado__nombre', 'history_user__username')
    ordering = ('-history_date', '-history_id')


@admin.register(HistoricalDetalleCierreCaja)
class HistoricalDetalleCierreCajaAdmin(_HistoricoAdmin):
    list_display = (
        'history_id',
        'history_date',
        'history_user',
        'history_type',
        'history_change_reason',
        'seccion_caja',
        'metodo_pago',
    )
    list_filter = ('history_type',)
    ordering = ('-history_date', '-history_id')
