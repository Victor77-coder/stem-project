from django.db import migrations


def _rename(apps, old: str, new: str) -> None:
    Content = apps.get_model('catalog', 'Content')
    for content in Content.objects.all().only('pk', 'publico_alvo'):
        audience = content.publico_alvo or []
        if old in audience:
            renamed = [new if item == old else item for item in audience]
            content.publico_alvo = list(dict.fromkeys(renamed))
            content.save(update_fields=['publico_alvo'])


def leigo_to_convidado(apps, schema_editor):
    _rename(apps, 'Leigo', 'Convidado')


def convidado_to_leigo(apps, schema_editor):
    _rename(apps, 'Convidado', 'Leigo')


class Migration(migrations.Migration):
    """O público-alvo "Leigo" passa a se chamar "Convidado" nos conteúdos já gravados."""

    dependencies = [
        ('catalog', '0005_configuracao_app'),
        # A classificação das novidades coletadas ainda grava "Leigo"; converte depois dela.
        ('ingestion', '0002_novidades_por_perfil'),
    ]

    operations = [
        migrations.RunPython(leigo_to_convidado, convidado_to_leigo),
    ]
