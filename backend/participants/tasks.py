from celery import shared_task
from django.utils import timezone

from . import services


@shared_task(ignore_result=True)
def expire_guests_due() -> None:
    services.expire_guests(timezone.now())
