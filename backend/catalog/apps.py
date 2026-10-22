from django.apps import AppConfig


class CatalogConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'catalog'

    def ready(self):
        from django.db.models.signals import post_delete, post_save

        from consent.models import ConsentDocument

        from . import cache, models

        def bump(**_):
            cache.invalidate()

        for model in (
            models.Content,
            models.Attachment,
            models.JourneyStep,
            models.Center,
            models.Statistic,
            models.GlossaryTerm,
            models.EstimateRule,
            ConsentDocument,
        ):
            post_save.connect(bump, sender=model, weak=False, dispatch_uid=f'catalog-cache-{model.__name__}-save')
            post_delete.connect(bump, sender=model, weak=False, dispatch_uid=f'catalog-cache-{model.__name__}-delete')
