from django.db import migrations

# Público que toda notícia coletada recebia antes de ser direcionada por perfil.
EVERYONE = ['Doador', 'Receptor', 'Leigo']


def classify_collected_news(apps, schema_editor):
    from ingestion.sources.novidades import audience

    Content = apps.get_model('catalog', 'Content')
    for content in Content.objects.filter(categoria='Novidades').exclude(link_original=''):
        target = audience(content.titulo, content.descricao)
        if content.publico_alvo == EVERYONE and target != EVERYONE:
            content.publico_alvo = target
            content.save(update_fields=['publico_alvo'])


class Migration(migrations.Migration):

    dependencies = [
        ('ingestion', '0001_initial'),
        ('catalog', '0004_novidade_coletada_sem_validacao'),
    ]

    operations = [
        migrations.RunPython(classify_collected_news, migrations.RunPython.noop),
    ]
