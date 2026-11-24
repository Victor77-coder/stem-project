from django.db import migrations, models


def show_journey(apps, schema_editor):
    """A Jornada volta ao app como guia pessoal: liga a chave que estava desligada."""
    AppSettings = apps.get_model('catalog', 'AppSettings')
    AppSettings.objects.update(jornada_ativa=True)


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0008_data_de_publicacao'),
    ]

    operations = [
        migrations.AlterField(
            model_name='appsettings',
            name='jornada_ativa',
            field=models.BooleanField(default=True, help_text='Exibe a aba e os atalhos da Jornada no aplicativo.'),
        ),
        migrations.RunPython(show_journey, migrations.RunPython.noop),
    ]
