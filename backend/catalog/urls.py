from django.urls import path
from rest_framework.routers import SimpleRouter

from . import public, staff

router = SimpleRouter()
router.register('staff/contents', staff.StaffContentViewSet, basename='staff-contents')
router.register('staff/journeys', staff.StaffJourneyViewSet, basename='staff-journeys')
router.register('staff/centers', staff.StaffCenterViewSet, basename='staff-centers')
router.register('staff/notifications', staff.StaffNotificationViewSet, basename='staff-notifications')
router.register('staff/statistics', staff.StaffStatisticViewSet, basename='staff-statistics')

urlpatterns = [
    path('conteudos/', public.contents),
    path('conteudos/<str:key>/', public.content_detail),
    path('anexos/<uuid:pk>/', public.attachment),
    path('jornadas/<str:kind>/', public.journeys),
    path('centros/', public.centers),
    path('centros/<slug:slug>/', public.center_detail),
    path('geo/cep/<str:cep>/', public.cep_location),
    path('estatisticas/', public.statistics),
    path('estimativa/', public.estimate),
    path('glossario/', public.glossary),
    path('termos/<str:kind>/', public.consent_document),
    path('staff/dashboard/', staff.dashboard),
    *router.urls,
]
