from django.db import migrations, models

# Ordem das etapas no app. O "current" antigo valia 1..7: as etapas antes dele estavam concluídas.
STEPS = {
    'doador': ('cadastro', 'coleta', 'redome', 'contato', 'doacao', 'pos-doacao'),
    'receptor': ('indicacao', 'encaminhamento', 'busca', 'preparacao', 'transplante', 'pos-tcth'),
}


def current_to_done(apps, schema_editor):
    JourneyProgress = apps.get_model('engagement', 'JourneyProgress')
    for progress in JourneyProgress.objects.select_related('participant'):
        steps = STEPS.get(progress.participant.profile, ())
        progress.done = list(steps[: max(progress.current - 1, 0)])
        progress.save(update_fields=['done'])


def done_to_current(apps, schema_editor):
    JourneyProgress = apps.get_model('engagement', 'JourneyProgress')
    for progress in JourneyProgress.objects.select_related('participant'):
        steps = STEPS.get(progress.participant.profile, ())
        progress.current = next((i for i, step in enumerate(steps, 1) if step not in progress.done), len(steps) + 1)
        progress.save(update_fields=['current'])


class Migration(migrations.Migration):

    dependencies = [
        ('engagement', '0005_codigo_do_erro'),
        ('participants', '0003_ultimo_acesso'),
    ]

    operations = [
        migrations.AddField(
            model_name='journeyprogress',
            name='done',
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name='journeyprogress',
            name='checklist',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.RunPython(current_to_done, done_to_current),
        migrations.RemoveField(
            model_name='journeyprogress',
            name='current',
        ),
    ]
