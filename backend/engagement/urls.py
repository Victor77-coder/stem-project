from django.urls import path

from . import views

urlpatterns = [
    path('me/preferences/', views.preferences),
    path('me/push-tokens/', views.push_tokens),
    path('me/email/codigo/', views.email_code),
    path('me/email/confirmar/', views.email_confirm),
    path('avisos/sair/<str:token>/', views.unsubscribe),
    path('me/journey/', views.journey),
    path('me/saved/', views.saved),
    path('me/saved/<str:key>/', views.saved_item),
    path('me/inbox/', views.inbox),
    path('me/inbox/read-all/', views.inbox_read_all),
    path('me/inbox/clear-read/', views.inbox_clear_read),
    path('me/inbox/<int:pk>/read/', views.inbox_read),
]
