from datetime import date

from django.db import migrations

# Texto fixo da versão 1.1: a migração não importa o seed_data, que muda com o tempo.
SECTIONS = [
    {
        'title': '1. Finalidade',
        'body': 'Guardamos seu e-mail apenas para enviar campanhas, eventos e comunicados oficiais da sua região, se você quiser recebê-los. Sem e-mail, nada é guardado.',
    },
    {
        'title': '2. Dados coletados',
        'body': 'Somente o e-mail, se você informar. Não pedimos CPF, telefone, peso, altura, sexo biológico nem comorbidades.',
    },
    {
        'title': '3. Por quanto tempo',
        'body': 'Seu e-mail fica guardado por 12 meses desde o último acesso ao aplicativo. Depois disso, ele é apagado e o seu acesso de convidado é encerrado.',
    },
    {
        'title': '4. Seus direitos',
        'body': 'Você pode alterar as preferências de aviso ou apagar o e-mail a qualquer momento em Perfil › Contato. Apagar o e-mail encerra o seu acesso na hora.',
    },
]


def publish(apps, schema_editor):
    Document = apps.get_model('consent', 'ConsentDocument')
    if Document.objects.filter(kind='termos', version='1.1').exists():
        return
    Document.objects.filter(kind='termos', is_current=True).update(is_current=False)
    Document.objects.create(
        kind='termos', version='1.1', title='Termos de uso', sections=SECTIONS, published_at=date(2026, 11, 24), is_current=True
    )


def unpublish(apps, schema_editor):
    Document = apps.get_model('consent', 'ConsentDocument')
    Acceptance = apps.get_model('consent', 'ConsentAcceptance')
    document = Document.objects.filter(kind='termos', version='1.1').first()
    if document is None:
        return
    if Acceptance.objects.filter(document=document).exists():
        # Aceites nunca são apagados: a versão só deixa de ser a vigente.
        Document.objects.filter(pk=document.pk).update(is_current=False)
    else:
        document.delete()
    Document.objects.filter(kind='termos', version='1.0').update(is_current=True)


class Migration(migrations.Migration):
    """Termos de uso do convidado 1.1 (RF02): contato só por e-mail e prazo de 12 meses desde o último acesso."""

    dependencies = [
        ('consent', '0002_perfil_convidado'),
    ]

    operations = [
        migrations.RunPython(publish, unpublish),
    ]
