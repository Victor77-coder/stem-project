from kombu.exceptions import OperationalError
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.response import Response

from accounts.permissions import TeamReadAdminWrite

from .models import CollectionRun
from .sources import BR_UFS, DEPLOYMENTS
from .tasks import trigger_collection


class CollectionRunSerializer(serializers.ModelSerializer):
    requested_by = serializers.CharField(source='requested_by.name', default='', read_only=True)

    class Meta:
        model = CollectionRun
        fields = (
            'id', 'source', 'competencia', 'filters', 'status', 'flow_run_id', 'requested_by', 'created_at',
            'started_at', 'finished_at', 'stats', 'raw_files', 'warnings', 'error',
        )


class TriggerSerializer(serializers.Serializer):
    source = serializers.ChoiceField(sorted(DEPLOYMENTS))
    ufs = serializers.ListField(
        child=serializers.RegexField(r'^[A-Za-z]{2}$'), min_length=1, max_length=27, default=lambda: list(BR_UFS)
    )
    competencia = serializers.RegexField(r'^\d{4}$', required=False, allow_blank=True, default='')


class StaffCollectionViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Toda a equipe acompanha as cargas; só administradores disparam uma coleta fora do agendamento."""

    permission_classes = [TeamReadAdminWrite]
    serializer_class = CollectionRunSerializer
    queryset = CollectionRun.objects.select_related('requested_by')

    def create(self, request):
        data = TriggerSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        filters = {'ufs': [uf.upper() for uf in data.validated_data['ufs']], 'competencia': data.validated_data['competencia']}
        run = CollectionRun.objects.create(
            source=data.validated_data['source'],
            filters=filters,
            status=CollectionRun.Status.ENFILEIRADA,
            requested_by=request.user,
        )
        try:
            trigger_collection.delay(run.pk)
        except (OperationalError, ConnectionError, TimeoutError) as exc:
            run.status, run.error = CollectionRun.Status.ERRO, f'Fila de tarefas indisponível: {exc}'
            run.save(update_fields=['status', 'error'])
            return Response({'detail': 'Fila de tarefas indisponível. Tente novamente em instantes.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        run.refresh_from_db()
        return Response(CollectionRunSerializer(run).data, status=status.HTTP_202_ACCEPTED)
