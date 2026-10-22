import uuid

from django.conf import settings
from django.db import models
from django.db.models import Q


class PublishStatus(models.TextChoices):
    RASCUNHO = 'rascunho', 'Rascunho'
    PUBLICADO = 'publicado', 'Publicado'
    INATIVO = 'inativo', 'Inativo'


def published_needs(field_condition: Q, name: str) -> models.CheckConstraint:
    return models.CheckConstraint(condition=~Q(status=PublishStatus.PUBLICADO) | field_condition, name=name)


class Content(models.Model):
    class Category(models.TextChoices):
        CONCEITO = 'O que é célula-tronco'
        BRASIL = 'O que o Brasil autoriza'
        DOENCAS = 'Doenças'
        MITOS = 'Mitos'
        FAQ = 'FAQ'
        NOVIDADES = 'Novidades'

    class Visibility(models.TextChoices):
        PUBLICO = 'Público'
        PRIVADO = 'Privado'
        RESTRITO = 'Restrito'

    class Listing(models.TextChoices):
        RECENT = 'recent'
        CATALOG = 'catalog'
        DIRECT = 'direct'

    AUDIENCES = ['Doador', 'Receptor', 'Leigo']

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.SlugField(max_length=80, unique=True, null=True, blank=True)
    titulo = models.CharField(max_length=200)
    descricao = models.TextField()
    categoria = models.CharField(max_length=30, choices=Category.choices)
    publico_alvo = models.JSONField(default=list)
    fonte = models.CharField(max_length=200, blank=True)
    visibilidade = models.CharField(max_length=10, choices=Visibility.choices, default=Visibility.PRIVADO)
    status = models.CharField(max_length=10, choices=PublishStatus.choices, default=PublishStatus.RASCUNHO)
    validado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name='+')
    validado_em = models.DateTimeField(null=True, blank=True)
    secoes = models.JSONField(default=list, blank=True)
    minutos = models.PositiveSmallIntegerField(default=3)
    palavras_chave = models.CharField(max_length=200, blank=True)
    destaque = models.BooleanField(default=False)
    lista = models.CharField(max_length=10, choices=Listing.choices, default=Listing.CATALOG)
    selo = models.CharField(max_length=10, blank=True, help_text='Mito ou Verdade, nos cartões de mitos.')
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-atualizado_em']
        constraints = [
            published_needs(~Q(fonte=''), 'conteudo_publicado_tem_fonte'),
            published_needs(Q(validado_por__isnull=False), 'conteudo_publicado_validado'),
        ]

    def __str__(self):
        return self.titulo


class Attachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    content = models.ForeignKey(Content, on_delete=models.CASCADE, related_name='anexos')
    arquivo = models.FileField(upload_to='anexos/%Y/%m/')
    nome = models.CharField(max_length=255)
    tamanho = models.PositiveBigIntegerField()
    enviado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['enviado_em']


class CatalogHistory(models.Model):
    """Versão, autor e data de cada alteração no painel (RF004, RF005–RF007, RF012)."""

    entidade = models.CharField(max_length=30)
    objeto_id = models.CharField(max_length=64, db_index=True)
    autor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='+')
    autor_nome = models.CharField(max_length=150)
    acao = models.CharField(max_length=80)
    snapshot = models.JSONField(default=dict)
    data = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-data']


class JourneyStep(models.Model):
    class Journey(models.TextChoices):
        DOADOR = 'doador'
        RECEPTOR = 'receptor'

    jornada = models.CharField(max_length=10, choices=Journey.choices)
    slug = models.SlugField(max_length=40)
    ordem = models.PositiveSmallIntegerField()
    titulo = models.CharField(max_length=120)
    titulo_curto = models.CharField(max_length=80)
    resumo = models.CharField(max_length=300)
    resumo_home = models.CharField(max_length=300, blank=True)
    resumo_por_regiao = models.JSONField(default=dict, blank=True)
    corpo = models.TextField()
    o_que_stem_faz = models.CharField(max_length=300, blank=True)
    o_que_sus_faz = models.CharField(max_length=300, blank=True)
    checklist = models.JSONField(default=list, blank=True)
    local = models.JSONField(null=True, blank=True)
    fonte = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=10, choices=PublishStatus.choices, default=PublishStatus.RASCUNHO)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['jornada', 'ordem']
        constraints = [
            models.UniqueConstraint(fields=['jornada', 'slug'], name='uniq_etapa_jornada'),
            published_needs(~Q(fonte=''), 'etapa_publicada_tem_fonte'),
        ]

    def __str__(self):
        return f'{self.jornada} · {self.ordem}. {self.titulo}'


class Center(models.Model):
    class Kind(models.TextChoices):
        HEMOCENTRO = 'hemocentro', 'Hemocentro'
        TRANSPLANTE = 'transplante', 'Transplante'
        CAMPANHA = 'campanha', 'Campanha'

    slug = models.SlugField(max_length=60, unique=True)
    cnes = models.CharField(max_length=7, blank=True)
    nome = models.CharField(max_length=200)
    nome_curto = models.CharField(max_length=80)
    endereco = models.CharField(max_length=200)
    endereco_lista = models.CharField(max_length=200, blank=True)
    cidade = models.CharField(max_length=100)
    uf = models.CharField(max_length=2)
    tipo = models.CharField(max_length=12, choices=Kind.choices)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    horario = models.CharField(max_length=120, blank=True)
    telefone = models.CharField(max_length=20, blank=True)
    servicos = models.JSONField(default=list, blank=True)
    observacoes = models.CharField(max_length=300, blank=True)
    evento_quando = models.CharField(max_length=80, blank=True)
    fonte = models.CharField(max_length=200, blank=True)
    fonte_data = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=PublishStatus.choices, default=PublishStatus.RASCUNHO)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['uf', 'cidade', 'nome']
        constraints = [
            published_needs(~Q(fonte='') & Q(fonte_data__isnull=False), 'centro_publicado_tem_fonte_e_data'),
        ]

    def __str__(self):
        return self.nome


class Statistic(models.Model):
    class Indicator(models.TextChoices):
        DOADORES = 'doadores', 'Doadores cadastrados no REDOME'
        TRANSPLANTES = 'transplantes', 'Transplantes de medula realizados'
        TRANSPLANTES_REGIAO = 'transplantes_regiao', 'Transplantes por região'
        ESPERA = 'espera', 'Tempo médio de busca de doador'

    indicador = models.CharField(max_length=25, choices=Indicator.choices)
    recorte = models.CharField(max_length=20, help_text='BR, UF ou nome da região')
    periodo = models.CharField(max_length=10)
    valor = models.DecimalField(max_digits=14, decimal_places=2)
    rotulo = models.CharField(max_length=40, blank=True, help_text='Valor como exibido, ex.: 5,7 mi')
    fonte = models.CharField(max_length=200)
    data_extracao = models.DateField()
    aviso_subnotificacao = models.BooleanField(default=True)

    class Meta:
        ordering = ['indicador', 'recorte', '-periodo']
        constraints = [
            models.UniqueConstraint(fields=['indicador', 'recorte', 'periodo', 'data_extracao'], name='uniq_carga_estatistica'),
        ]


class GlossaryTerm(models.Model):
    termo = models.CharField(max_length=60, unique=True)
    definicao = models.TextField()
    ordem = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['ordem', 'termo']


class EstimateRule(models.Model):
    """Regra informativa por perfil e UF (RF011). Não usa dado clínico nem matching."""

    perfil = models.CharField(max_length=10, choices=JourneyStep.Journey.choices)
    uf = models.CharField(max_length=2, default='*', help_text='* vale para qualquer UF')
    rotulo = models.CharField(max_length=80)
    valor = models.CharField(max_length=80)
    nota = models.CharField(max_length=300)
    fonte = models.CharField(max_length=200)
    versao = models.CharField(max_length=10, default='1')
    ativo = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['perfil', 'uf'], condition=Q(ativo=True), name='uma_regra_ativa_por_uf'),
        ]
