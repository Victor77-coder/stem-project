from . import cnes

# Mesma ordem de workers/collectors/cnes/collector.py (UFS).
BR_UFS = (
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
    'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
)

# Fonte -> função que aplica o payload canônico do coletor no banco e devolve as contagens.
APPLIERS = {
    'cnes': cnes.apply,
}

# Fonte -> deployment Prefect que executa o coletor.
DEPLOYMENTS = {
    'cnes': 'stem.collect/cnes-centros',
}
