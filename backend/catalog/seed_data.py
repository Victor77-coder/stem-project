"""Conteúdo que hoje está fixo em mobile/src/content e web/src/data/mock.ts."""

CONCEITO = 'O que é célula-tronco'
BRASIL = 'O que o Brasil autoriza'
TODOS = ['Doador', 'Receptor', 'Leigo']
INCA = 'INCA / REDOME · Atualizado em 09/2026'
MS = 'Ministério da Saúde e INCA · Atualizado em 02/10/2026'

ARTICLES = [
    {
        'slug': 'o-que-sao', 'titulo': 'Células-tronco: o que são e como podem salvar vidas', 'categoria': CONCEITO,
        'minutos': 5, 'lista': 'catalog', 'destaque': True, 'fonte': INCA,
        'secoes': [
            {'title': 'O que são', 'body': 'Células-tronco dão origem a outras células do sangue. A medula óssea, um tecido no interior dos ossos, é uma das principais fontes dessas células.'},
            {'title': 'Por que salvam vidas', 'body': 'Pacientes com doenças como leucemia podem precisar de um transplante para repor a produção de células do sangue.'},
            {'title': 'Como alguém pode ajudar', 'body': 'Pessoas entre 18 e 35 anos, com boa saúde, podem se cadastrar no REDOME. A permanência no cadastro vai até os 60 anos.'},
        ],
    },
    {
        'slug': 'doacao-passo-a-passo', 'titulo': 'Doação de medula óssea: passo a passo', 'categoria': CONCEITO,
        'minutos': 4, 'lista': 'recent', 'fonte': MS,
        'secoes': [
            {'title': 'O que é', 'body': 'A medula óssea é um tecido no interior dos ossos que produz as células do sangue. Pacientes com doenças como leucemia podem precisar de um transplante.'},
            {'title': 'Quem pode doar', 'body': 'Pessoas entre 18 e 35 anos, com boa saúde, podem se cadastrar no REDOME. A permanência no cadastro vai até os 60 anos.'},
            {'title': 'Como é feito o cadastro', 'body': 'Basta procurar um hemocentro, preencher um formulário e coletar 5 ml de sangue para o exame de compatibilidade (HLA).'},
        ],
    },
    {
        'slug': 'leucemia', 'titulo': 'Leucemia e o transplante de células-tronco', 'categoria': 'Doenças',
        'minutos': 6, 'lista': 'recent', 'fonte': INCA,
        'secoes': [
            {'title': 'A doença e o transplante', 'body': 'Pacientes com doenças como leucemia podem precisar de um transplante para repor as células do sangue produzidas na medula óssea.'},
            {'title': 'De onde vêm as células', 'body': 'A medula é um tecido no interior dos ossos. A compatibilidade entre quem doa e quem recebe é genética (HLA), não depende do tipo sanguíneo.'},
        ],
    },
    {
        'slug': 'lei-9434', 'titulo': 'O que diz a Lei 9.434 sobre transplantes', 'categoria': BRASIL,
        'minutos': 5, 'lista': 'recent', 'fonte': INCA,
        'secoes': [
            {'title': 'A lei', 'body': 'A Lei nº 9.434 organiza a doação e o transplante de órgãos e tecidos no Brasil, o que inclui a medula óssea.'},
            {'title': 'O que isso muda na prática', 'body': 'O cadastro e a busca de doador compatível seguem regras públicas. No SUS, essa busca é feita no REDOME a partir do cadastro enviado pela equipe médica.'},
        ],
    },
    {
        'slug': 'periferico', 'titulo': 'Medula óssea x células-tronco do sangue periférico', 'categoria': CONCEITO,
        'minutos': 3, 'lista': 'catalog', 'fonte': INCA,
        'secoes': [
            {'title': 'Duas formas de coletar', 'body': 'A medula pode ser retirada do osso da bacia ou as células podem ser coletadas do sangue. A coleta nunca é feita da coluna.'},
            {'title': 'O que não muda', 'body': 'Nos dois casos, a compatibilidade é genética (HLA). O tipo sanguíneo não define se uma pessoa pode doar para outra.'},
        ],
    },
    {
        'slug': 'doer', 'titulo': 'Doar medula dói? Entenda o procedimento', 'categoria': 'Mitos',
        'minutos': 3, 'lista': 'catalog', 'fonte': INCA,
        'secoes': [
            {'title': 'Durante a coleta', 'body': 'A coleta é feita com anestesia. Pode haver desconforto leve nos dias seguintes, que passa com analgésicos simples.'},
            {'title': 'Depois da doação', 'body': 'A medula de quem doa se regenera. O organismo repõe as células doadas em cerca de 15 dias.'},
        ],
    },
    {
        'slug': 'quem-pode', 'titulo': 'Quem pode ser doador de medula', 'categoria': CONCEITO,
        'minutos': 3, 'lista': 'direct', 'fonte': MS,
        'secoes': [
            {'title': 'Quem pode se cadastrar', 'body': 'Pessoas entre 18 e 35 anos, com boa saúde, podem se cadastrar no REDOME. A permanência no cadastro vai até os 60 anos.'},
            {'title': 'O que este texto não faz', 'body': 'A leitura não avalia se alguém pode doar. Essa decisão fica com a equipe do hemocentro e com os médicos do SUS.'},
        ],
    },
    {
        'slug': 'redome', 'titulo': 'REDOME: o registro brasileiro de doadores', 'categoria': BRASIL,
        'minutos': 4, 'lista': 'catalog', 'palavras_chave': 'medula doadores registro', 'fonte': MS,
        'secoes': [
            {'title': 'O que é', 'body': 'O REDOME é o registro brasileiro de pessoas dispostas a doar medula. A busca de doador compatível no SUS passa por esse cadastro.'},
            {'title': 'Quem pode entrar', 'body': 'Pessoas entre 18 e 35 anos, com boa saúde, podem se cadastrar. A permanência no cadastro vai até os 60 anos.'},
            {'title': 'Como é feito', 'body': 'Basta procurar um hemocentro, preencher um formulário e coletar 5 ml de sangue para o exame de compatibilidade (HLA).'},
        ],
    },
    {
        'slug': 'tcth', 'titulo': 'O que é o transplante de medula (TCTH)', 'categoria': 'Doenças',
        'minutos': 5, 'lista': 'direct', 'fonte': INCA,
        'secoes': [
            {'title': 'O tratamento', 'body': 'O transplante de medula repõe a produção de células do sangue de um paciente com células de uma pessoa compatível.'},
            {'title': 'Como a busca começa', 'body': 'O cadastro é enviado pela equipe médica. A busca de doador compatível é feita pelo SUS no REDOME.'},
        ],
    },
    {
        'slug': 'fila-sus', 'titulo': 'Como funciona a fila de transplantes no SUS', 'categoria': BRASIL,
        'minutos': 4, 'lista': 'direct', 'fonte': MS,
        'secoes': [
            {'title': 'Quem conduz a busca', 'body': 'A busca de doador compatível é feita pelo SUS no REDOME, a partir do cadastro enviado pela equipe médica.'},
            {'title': 'O que este app não faz', 'body': 'O conteúdo não agenda consultas, não altera a ordem de atendimento e não promete prazo. A estimativa de tempo, quando aparece, é estatística e não é garantia.'},
        ],
    },
]

MYTHS = [
    ('mito-coluna', 'Mito', '“Doar medula é tirar um pedaço da coluna.”', 'Mito. A medula é retirada do osso da bacia ou do sangue, nunca da coluna.'),
    ('mito-tipo-sanguineo', 'Mito', '“Só pode doar quem tem o mesmo tipo sanguíneo.”', 'Mito. A compatibilidade é genética (HLA), não depende do tipo sanguíneo.'),
    ('verdade-regenera', 'Verdade', '“A medula do doador se regenera em poucas semanas.”', 'Verdade. O organismo repõe as células doadas em cerca de 15 dias.'),
    ('mito-parentes', 'Mito', '“Parentes são sempre compatíveis.”', 'Mito. Irmãos têm cerca de 25% de chance de compatibilidade.'),
]

FAQS = [
    ('faq-dor', 'Doar medula óssea dói?', 'A coleta é feita com anestesia. Pode haver desconforto leve nos dias seguintes, que passa com analgésicos simples.'),
    ('faq-tempo', 'Quanto tempo fico no cadastro do REDOME?', 'Quem se cadastra entre 18 e 35 anos pode permanecer no REDOME até os 60 anos.'),
    ('faq-tatuagem', 'Posso doar se tiver tatuagem?', 'Ter tatuagem não impede o cadastro. A equipe do hemocentro avalia cada caso, principalmente quando a tatuagem é recente.'),
    ('faq-paga', 'Quem paga pelo transplante?', 'No SUS, a busca de doador compatível é feita no REDOME, a partir do cadastro enviado pela equipe médica. Este app não cobra procedimento.'),
    ('faq-hipertensao', 'Hipertensão impede a doação?', 'Este app não responde se hipertensão impede a doação. A equipe do hemocentro avalia a saúde de cada pessoa. O questionário só sugere leituras e não decide quem pode doar ou receber.'),
    ('faq-agenda', 'O app agenda consultas?', 'Não. O app não agenda consultas, exames nem a coleta. Datas e encaminhamentos ficam com a equipe médica e o hemocentro.'),
]

PANEL_CONTENTS = [
    {
        'slug': 'transplante-sus', 'titulo': 'Transplante de medula óssea pelo SUS', 'categoria': BRASIL,
        'descricao': 'O que o Brasil autoriza hoje no recorte hematológico e como funciona o acesso pela rede pública.',
        'publico_alvo': ['Receptor', 'Leigo'], 'fonte': 'Liga Alamir', 'lista': 'catalog',
    },
]

JOURNEY_SOURCE = 'Ministério da Saúde · Protocolo vigente em 10/2026'
HEMOAL = {'name': 'Hemoal · Maceió', 'address': 'Av. Jorge de Lima, 58', 'distance': '3,2 km'}
STEM = 'Explica a etapa e indica a unidade mais próxima.'

DONOR_STEPS = [
    ('cadastro', 'Cadastro no hemocentro', 'Cadastro no hemocentro', 'Preencha a ficha e apresente documento com foto.', '',
     'O cadastro de doador de medula é feito em hemocentro. Você preenche uma ficha, apresenta um documento oficial com foto e autoriza o uso dos dados no REDOME.',
     ['Documento oficial com foto', 'Ter entre 18 e 35 anos no cadastro', 'Estar em boas condições de saúde'], HEMOAL,
     'O cadastro oficial é feito no hemocentro. Declarar intenção no STEM não torna ninguém doador.'),
    ('coleta', 'Coleta de amostra (HLA)', 'Coleta de amostra', 'Coleta de 5 ml no hemocentro para o teste de compatibilidade genética.',
     'Leve um documento com foto ao hemocentro para coletar a amostra de sangue do cadastro.',
     'Uma pequena amostra de sangue é usada para identificar suas características genéticas (HLA) e comparar com pacientes que aguardam transplante.',
     ['Documento oficial com foto', 'Comprovante de endereço', 'Estar bem alimentado'], HEMOAL, 'A coleta e o exame HLA são do hemocentro.'),
    ('redome', 'Inclusão no REDOME', 'Inclusão no REDOME', 'Seus dados entram no registro nacional. Mantenha o contato atualizado.', '',
     'Depois da tipagem HLA, o hemocentro envia o resultado ao REDOME, o Registro Nacional de Doadores Voluntários de Medula Óssea. Manter telefone e endereço atualizados é o que permite o contato se houver compatibilidade.',
     [], None, 'A inclusão no REDOME é feita pelo hemocentro.'),
    ('contato', 'Contato por compatibilidade', 'Contato por compatibilidade', 'Se houver um paciente compatível, o hemocentro entra em contato.', '',
     'Só uma minoria dos cadastrados é chamada. Se o sistema encontrar um paciente compatível, o hemocentro confirma se você ainda pode doar e agenda novos exames. Ninguém doa sem esse convite.',
     [], None, 'A compatibilidade é avaliada por dois médicos do SUS, sem vínculo entre si.'),
    ('doacao', 'Exames e doação', 'Exames e doação', 'Exames complementares e doação, por punção ou aférese.', '',
     'Com a compatibilidade confirmada, você faz exames clínicos e, se estiver apto, a doação ocorre por punção no osso da bacia ou por aférese (coleta de sangue). A escolha é da equipe médica, com o seu consentimento.',
     ['Exames clínicos e de sangue', 'Acompanhante no dia do procedimento', 'Seguir o jejum ou orientação do hemocentro'], HEMOAL,
     'Exames e doação são feitos pela equipe médica do SUS.'),
    ('pos-doacao', 'Acompanhamento', 'Acompanhamento', 'Retorno médico após a doação.', '',
     'Após a doação, o hemocentro agenda retorno para avaliar sua recuperação. A medula se recompõe em poucas semanas. Qualquer sintoma fora do esperado deve ser informado à equipe que te acompanhou.',
     [], None, 'O retorno é agendado pelo hemocentro.'),
]

RECEPTOR_STEPS = [
    ('indicacao', 'Indicação médica', 'Indicação médica', 'O hematologista indica o transplante e solicita o tratamento no SUS.', '', {},
     'O transplante de células-tronco (TCTH) só começa com indicação de um hematologista. O médico avalia o diagnóstico, tenta tratamentos prévios e solicita o transplante pelo SUS quando for o caso.'),
    ('encaminhamento', 'Encaminhamento', 'Encaminhamento', 'O encaminhamento é feito pelo SUS para o centro transplantador de referência da sua região.', '',
     {
         'maceio': 'Em Maceió, o encaminhamento é feito para centro transplantador de referência (ex.: Recife).',
         'recife': 'Em Recife, o tratamento pode ocorrer em centro transplantador da própria região.',
     },
     'Com a indicação, o paciente é encaminhado a um centro transplantador habilitado. A regulação é feita pelo SUS. O app não agenda, não altera fila e não substitui a equipe assistente.'),
    ('busca', 'Busca de doador', 'Busca de doador compatível', 'Busca no REDOME/REREME. O tempo varia conforme o HLA e o centro.',
     'Seu cadastro foi enviado pela equipe médica. A busca é feita pelo SUS no REDOME.',
     {
         'maceio': 'Busca no REDOME/REREME. Familiares podem ser testados primeiro.',
         'recife': 'Busca no REDOME/REREME, com centros de referência na própria região.',
     },
     'A busca começa pelos familiares. Se não houver compatibilidade, o centro consulta o REDOME e, se preciso, registros internacionais (REREME). O tempo depende do HLA e da disponibilidade — não de uma fila única.'),
    ('preparacao', 'Preparação', 'Preparação', 'Exames e condicionamento antes do transplante.', '', {},
     'Antes do transplante há exames, avaliações odontológicas e o condicionamento (quimioterapia e, em alguns casos, radioterapia). Essa fase acontece no centro transplantador, com a equipe que vai realizar o procedimento.'),
    ('transplante', 'Transplante', 'Transplante', 'Internação no centro transplantador.', '', {},
     'O transplante é a infusão das células-tronco do doador ou do próprio paciente. A internação dura semanas. Só a equipe do centro transplantador define datas, protocolos e alta.'),
    ('pos-tcth', 'Acompanhamento', 'Acompanhamento', 'Consultas periódicas após o transplante.', '', {},
     'Depois da alta, há consultas frequentes para prevenir infecções e a doença do enxerto contra o hospedeiro. O calendário é da equipe médica. O app só descreve a etapa.'),
]

CNES = 'CNES/DataSUS'
HEMO_SERVICES = ['Doação de sangue', 'Cadastro de medula (REDOME)', 'Coleta HLA']

CENTERS = [
    {'slug': 'hemoal-trapiche', 'nome': 'Hemoal · Hemocentro de Alagoas', 'nome_curto': 'Hemoal · Trapiche',
     'endereco': 'Av. Jorge de Lima, 58 · Trapiche da Barra', 'endereco_lista': 'Av. Jorge de Lima, 58 · Trapiche',
     'cidade': 'Maceió', 'uf': 'AL', 'tipo': 'hemocentro', 'lat': -9.6725, 'lng': -35.7583,
     'horario': 'Seg a sex · 7h às 18h · Sáb · 7h às 12h', 'telefone': '(82) 3315-2102', 'fonte': CNES, 'fonte_data': '2026-09-30',
     'servicos': HEMO_SERVICES},
    {'slug': 'hemoal-sede', 'cnes': '2003899', 'nome': 'Hemoal · Sede', 'nome_curto': 'Hemoal · Sede',
     'endereco': 'Av. Menino Marcelo, 9974 · Cidade Universitária', 'cidade': 'Maceió', 'uf': 'AL', 'tipo': 'hemocentro',
     'lat': -9.555, 'lng': -35.77, 'horario': 'Seg a sex · 7h às 18h', 'telefone': '(82) 3373-9628', 'fonte': CNES,
     'fonte_data': '2026-09-30', 'servicos': HEMO_SERVICES},
    {'slug': 'hupaa', 'cnes': '2006197', 'nome': 'Hospital Universitário (HUPAA)', 'nome_curto': 'HUPAA',
     'endereco': 'Av. Lourival Melo Mota, s/n · Tabuleiro do Martins', 'endereco_lista': 'Av. Lourival Melo Mota · Tabuleiro',
     'cidade': 'Maceió', 'uf': 'AL', 'tipo': 'transplante', 'lat': -9.5556, 'lng': -35.7778, 'horario': 'Atendimento hospitalar 24h',
     'telefone': '(82) 3214-1100', 'fonte': CNES, 'fonte_data': '2026-09-30',
     'servicos': ['Transplante de medula', 'Acompanhamento hospitalar']},
    {'slug': 'mutirao-hemoal', 'nome': 'Mutirão de cadastro de doadores de medula', 'nome_curto': 'Mutirão de cadastro',
     'endereco': 'Hemoal · Av. Jorge de Lima, 58 · Trapiche da Barra', 'endereco_lista': 'Hemoal · Trapiche',
     'cidade': 'Maceió', 'uf': 'AL', 'tipo': 'campanha', 'lat': -9.6724, 'lng': -35.7578, 'evento_quando': '25 out · 8h–16h',
     'fonte': 'Ministério da Saúde', 'fonte_data': '2026-10-12', 'servicos': ['Cadastro de medula (REDOME)']},
    {'slug': 'hemope', 'cnes': '0000809', 'nome': 'Hemope · Fundação de Hematologia de Pernambuco', 'nome_curto': 'Hemope · Recife',
     'endereco': 'Rua Joaquim Nabuco, 171 · Graças', 'cidade': 'Recife', 'uf': 'PE', 'tipo': 'hemocentro', 'lat': -8.0479,
     'lng': -34.8981, 'horario': 'Consulte o horário no hemocentro', 'telefone': '(81) 3182-4695', 'fonte': CNES,
     'fonte_data': '2026-09-30', 'servicos': HEMO_SERVICES, 'observacoes': 'Referência regional para transplante.'},
]

# (id, tipo, título, mensagem, origem, uf, horas atrás, centro)
NOTICES = [
    ('mutirao', 'campanha', 'Mutirão de cadastro de medula', 'Sábado, 25/10, no Hemoal Maceió. Leve documento com foto.', 'Hemoal', 'AL', 2, 'mutirao-hemoal'),
    ('semana', 'evento', 'Semana Nacional de Doação', 'Palestras abertas sobre células-tronco no Cesmac.', 'Ministério da Saúde', '', 3, None),
    ('redome', 'comunicado', 'Novo protocolo do REDOME', 'Atualização nas regras de permanência no cadastro.', 'INCA', '', 8 * 24, None),
    ('inverno', 'campanha', 'Campanha de inverno', 'Estoques de sangue baixos em Alagoas.', 'Hemoal', 'AL', 9 * 24, 'hemoal-trapiche'),
]

STATS_SOURCE = 'DataSUS/Tabnet e REDOME'
STATS_DATE = '2026-08-01'
HEADLINES = {'2025': (5_700_000, '5,7 mi', 3400, '3,4 mil'), '2024': (5_400_000, '5,4 mi', 3100, '3,1 mil'), '2023': (5_100_000, '5,1 mi', 2900, '2,9 mil')}
YEAR_SCALE = {'2025': 1, '2024': 0.9, '2023': 0.82}
REGION_BASE = {'Sudeste': 1820, 'Sul': 720, 'Nordeste': 510, 'Centro-Oeste': 230, 'Norte': 120}
WAIT = {'Sudeste': (3.6, '3,6 meses'), 'Sul': (4.1, '4,1 meses'), 'Nordeste': (4.8, '4,8 meses'), 'Centro-Oeste': (5.2, '5,2 meses'), 'Norte': (6.1, '6,1 meses')}

ESTIMATE_NOTE = 'Aproximação estatística baseada em dados públicos. Não é garantia de atendimento, procedimento ou prazo.'
ESTIMATES = [
    ('receptor', 'AL', 'Estimativa · Busca de doador', 'Média regional: 3 a 6 meses'),
    ('receptor', 'PE', 'Estimativa · Busca de doador', 'Média regional: 2 a 5 meses'),
    ('receptor', '*', 'Estimativa · Busca de doador', 'Varia por região'),
]

GLOSSARY = [
    ('HLA', 'Antígenos leucocitários humanos. São as características genéticas usadas para comparar quem doa e quem recebe. A compatibilidade não depende do tipo sanguíneo.'),
    ('REDOME', 'Registro Nacional de Doadores Voluntários de Medula Óssea. É o cadastro brasileiro consultado pelo SUS na busca de doador compatível.'),
    ('TCTH', 'Transplante de células-tronco hematopoéticas. Pode usar células da medula óssea, do sangue periférico ou do cordão umbilical.'),
]

TCLE = [
    {'title': '1. Finalidade', 'body': 'Seus dados serão usados apenas para personalizar conteúdos educativos, mostrar centros próximos e organizar sua jornada informativa no STEM Project.'},
    {'title': '2. Dados coletados', 'body': 'Peso, altura, sexo biológico, comorbidades e CEP. Coletamos apenas o mínimo necessário (LGPD, art. 6º).'},
    {'title': '3. O que o app NÃO faz', 'body': 'Não realiza validação clínica, não agenda consultas e não garante compatibilidade. A compatibilidade é avaliada por dois médicos do SUS.'},
    {'title': '4. Seus direitos', 'body': 'Você pode consultar, corrigir e solicitar a inativação dos seus dados a qualquer momento em Perfil › Privacidade.'},
]

TERMOS = [
    {'title': '1. Finalidade', 'body': 'Guardamos seu contato apenas para enviar campanhas, eventos e comunicados oficiais da sua região, se você quiser recebê-los.'},
    {'title': '2. Dados coletados', 'body': 'E-mail ou telefone e, se você informar, o CEP de interesse. Não pedimos CPF, peso, altura, sexo biológico nem comorbidades.'},
    {'title': '3. Seus direitos', 'body': 'Você pode alterar as preferências de aviso ou remover seu contato a qualquer momento em Perfil.'},
]

DEV_STAFF = [
    {'nome': 'John Doe', 'email': 'admin@stem.com', 'senha': 'admin123', 'nivel': 'Admin', 'tipo_conta': 'Administrador de conteúdo', 'estado': 'AL', 'cidade': 'Maceió'},
    {'nome': 'José da Silva Faustino', 'email': 'silva_js@email.com', 'senha': 'senha123', 'nivel': 'User', 'tipo_conta': 'Editor', 'estado': 'AL', 'cidade': 'Maceió', 'genero': 'Masculino', 'avatar': 'https://i.pravatar.cc/160?img=12'},
    {'nome': 'Mariana Souza', 'email': 'marisouza@email.com', 'senha': 'senha123', 'nivel': 'User', 'tipo_conta': 'Editor', 'estado': 'PE', 'cidade': 'Recife', 'genero': 'Feminino', 'status': 'inativo'},
]
