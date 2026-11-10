from rest_framework.routers import SimpleRouter

from .staff import StaffCollectionViewSet

router = SimpleRouter()
router.register('staff/collections', StaffCollectionViewSet, basename='staff-collections')

urlpatterns = router.urls
