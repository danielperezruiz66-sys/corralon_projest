from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Empleado, Usuario


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
