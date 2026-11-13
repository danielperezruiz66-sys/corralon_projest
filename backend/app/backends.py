from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q

from .models import Empleado


class UsuarioBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        Usuario = get_user_model()
        if username is None:
            username = kwargs.get(Usuario.USERNAME_FIELD)
        if username is None or password is None:
            return None
        try:
            user = Usuario.objects.get(
                Q(username=username) | Q(empleado__legajo=username)
            )
        except Usuario.DoesNotExist:
            Usuario().set_password(password)
            return None
        except Usuario.MultipleObjectsReturned:
            user = Usuario.objects.filter(
                Q(username=username) | Q(empleado__legajo=username)
            ).order_by('id').first()
        if user.check_password(password) and self.user_can_authenticate(user):
            # Un empleado suspendido, con baja temporal o inactivo no entra.
            empleado = getattr(user, 'empleado', None)
            if (
                empleado is not None
                and empleado.estado != Empleado.EstadoEmpleado.ACTIVO
            ):
                return None
            return user
        return None
