from django.urls import path

from . import views

urlpatterns = [
    path('auth/register/', views.register),
    path('auth/login/', views.login),
    path('me/', views.me),
    path('me/profile/', views.change_profile),
    path('me/history/', views.history),
    path('me/export/', views.export),
    path('me/deactivate/', views.deactivate),
]
