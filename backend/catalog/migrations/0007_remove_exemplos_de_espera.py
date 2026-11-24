from datetime import date

from django.db import migrations

# Valores fixos do seed_mvp antigo: a migração não importa o seed_data, que muda com o tempo.
SEED_SOURCE = 'DataSUS/Tabnet e REDOME'
SEED_DATE = date(2026, 8, 1)
SEED_ESTIMATES = {
    ('AL', 'Média regional: 3 a 6 meses'),
    ('PE', 'Média regional: 2 a 5 meses'),
    ('*', 'Varia por região'),
}


def remove_examples(apps, schema_editor):
    Statistic = apps.get_model('catalog', 'Statistic')
    EstimateRule = apps.get_model('catalog', 'EstimateRule')
    Statistic.objects.filter(indicador='espera', fonte=SEED_SOURCE, data_extracao=SEED_DATE).delete()
    for rule in EstimateRule.objects.filter(perfil='receptor', fonte=SEED_SOURCE, rotulo='Estimativa · Busca de doador'):
        if (rule.uf, rule.valor) in SEED_ESTIMATES:
            rule.delete()


class Migration(migrations.Migration):
    """Apaga o tempo de busca de doador de exemplo do seed_mvp (indicador `espera` e regras de estimativa).

    Não há fonte pública desse tempo, e o app mostrava os números como se viessem do DataSUS e do REDOME.
    O que a equipe cadastrou com outra fonte fica.
    """

    dependencies = [
        ('catalog', '0006_publico_convidado'),
    ]

    operations = [
        migrations.RunPython(remove_examples, migrations.RunPython.noop),
    ]
