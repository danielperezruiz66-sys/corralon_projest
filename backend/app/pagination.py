from rest_framework.pagination import PageNumberPagination


class PaginacionCorralon(PageNumberPagination):
    """Paginación con tamaño elegible por el cliente y tope de seguridad."""

    page_size_query_param = 'page_size'
    max_page_size = 500
