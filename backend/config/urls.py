from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    return Response({'status': 'ok'})


api = [
    path('health/', health),
    path('', include('accounts.urls')),
    path('', include('participants.urls')),
    path('', include('engagement.urls')),
    path('', include('catalog.urls')),
    path('schema/', SpectacularAPIView.as_view(), name='schema'),
    path('docs/', SpectacularSwaggerView.as_view(url_name='schema')),
]

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include(api)),
]
