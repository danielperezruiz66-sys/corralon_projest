from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q


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
            return user
        return None
