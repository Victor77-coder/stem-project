from django.urls import path
from rest_framework.routers import SimpleRouter
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

router = SimpleRouter()
router.register('staff/accounts', views.StaffAccountViewSet, basename='staff-accounts')

urlpatterns = [
    path('auth/refresh/', TokenRefreshView.as_view()),
    path('auth/logout/', views.logout),
    path('auth/password/change/', views.change_password),
    path('auth/password/forgot/', views.forgot_password),
    path('auth/password/verify/', views.verify_code),
    path('auth/password/reset/', views.reset_password),
    path('staff/auth/login/', views.staff_login),
    path('staff/auth/password/forgot/', views.staff_forgot),
    path('staff/auth/access-request/', views.access_request),
    path('staff/me/', views.staff_me),
    *router.urls,
]
