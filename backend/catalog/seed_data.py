"""Conteúdo que hoje está fixo em mobile/src/content e web/src/data/mock.ts."""

CONCEITO = 'O que é célula-tronco'
BRASIL = 'O que o Brasil autoriza'
TODOS = ['Doador', 'Receptor', 'Convidado']
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
        'publico_alvo': ['Receptor', 'Convidado'], 'fonte': 'Liga Alamir', 'lista': 'catalog',
    },
]

# RS008: cada etapa traz a fonte oficial de onde o texto saiu e a data da consulta. Mesmo texto do app
# (mobile/src/content/journey.ts).
CONSULTED = 'consultado em 24/11/2026'
JOURNEY_SOURCES = {
    'cadastro': f'REDOME/INCA (redome.inca.gov.br/doadores), Hemominas e Hemoes · {CONSULTED}',
    'doadores': f'REDOME/INCA (redome.inca.gov.br/doadores) · {CONSULTED}',
    'doacao': f'REDOME/INCA (doadores e para pacientes), Hemope e Hemominas · {CONSULTED}',
    'pos_doacao': f'REDOME/INCA (redome.inca.gov.br/doadores) e Hemope · {CONSULTED}',
    'pacientes': f'REDOME/INCA (redome.inca.gov.br/para-pacientes), Hemope e Hemoes · {CONSULTED}',
    'inca': f'INCA (gov.br/inca, transplante de medula óssea) e Hemominas · {CONSULTED}',
    'centros': 'CNES/DataSUS, habilitações de transplante de medula 2401 a 2403 · competência 10/2026',
}
# Sem distância: o guia não sabe onde a pessoa está.
HEMOAL = {'name': 'Hemoal · Maceió', 'address': 'Av. Jorge de Lima, 58'}
STEM = 'Explica a etapa e indica a unidade mais próxima.'

DONOR_STEPS = [
    ('cadastro', 'Cadastro no hemocentro', 'Cadastro no hemocentro', 'Cadastro e coleta de 5 ml de sangue, na mesma visita.', '',
     'O cadastro pode começar pelo site ou pelo aplicativo do REDOME, mas é concluído no hemocentro. Lá você lê e assina o termo de consentimento e, na mesma visita, coleta uma amostra de cerca de 5 ml de sangue. Pode se cadastrar quem tem entre 18 e 35 anos e está em bom estado geral de saúde.',
     ['Documento oficial de identidade com foto', 'Ter entre 18 e 35 anos', 'Estar em bom estado geral de saúde'], HEMOAL,
     'O cadastro oficial é concluído no hemocentro. Declarar intenção no STEM não torna ninguém doador.',
     JOURNEY_SOURCES['cadastro']),
    ('coleta', 'Exame de compatibilidade (HLA)', 'Exame HLA', 'A amostra do cadastro identifica seus genes de compatibilidade.', '',
     'A amostra coletada no cadastro é usada para identificar seus dados genéticos de compatibilidade, os genes HLA. São eles que o REDOME compara com os dos pacientes que precisam de transplante.',
     [], None, 'O hemocentro coleta a amostra e a envia para o exame HLA.', JOURNEY_SOURCES['doadores']),
    ('redome', 'Inclusão no REDOME', 'Inclusão no REDOME', 'Seu cadastro fica ativo até os 60 anos. Mantenha o contato atualizado.', '',
     'Seus dados e o resultado do HLA entram no REDOME, o Registro Nacional de Doadores Voluntários de Medula Óssea, e ficam ativos até você completar 60 anos. O contato pode levar alguns anos ou nunca acontecer. Mantenha telefone, e-mail e endereço atualizados pelo site ou pelo aplicativo do REDOME: é assim que você é encontrado.',
     ['Manter telefone, e-mail e endereço atualizados no REDOME'], None, 'O REDOME guarda o cadastro até os 60 anos.',
     JOURNEY_SOURCES['doadores']),
    ('contato', 'Contato do REDOME', 'Contato por compatibilidade', 'Se você for compatível com um paciente, o REDOME entra em contato.', '',
     'Se houver um paciente compatível, o REDOME entra em contato por telefone, WhatsApp ou e-mail para saber se você ainda deseja e pode doar. Pode ser preciso coletar uma nova amostra de sangue para exames confirmatórios. Se não houver um novo contato em até 180 dias, você não foi o doador compatível.',
     [], None, 'A compatibilidade é avaliada por dois médicos do SUS, sem vínculo entre si.', JOURNEY_SOURCES['doadores']),
    ('doacao', 'Avaliação e doação', 'Avaliação e doação', 'Exames de saúde e doação por punção ou aférese, em hospital autorizado.', '',
     'Antes de doar, você passa por avaliação clínica e exames de sangue: a doação só acontece se a sua saúde estiver bem. A forma de coleta é decidida pela equipe médica junto com você. Na punção, as células são retiradas do osso da bacia, em centro cirúrgico e sob anestesia. Na aférese, você recebe antes uma medicação que estimula a produção de células-tronco, que depois são separadas do sangue por uma máquina, sem internação nem anestesia. A doação é feita em hospital especializado e autorizado pelo Ministério da Saúde, que pode ficar em outra cidade: o SUS paga transporte, hospedagem e alimentação para você e um acompanhante.',
     ['Avaliação clínica e exames de sangue', 'Acompanhante no dia da doação', 'Seguir as orientações da equipe que fará a coleta'], None,
     'A doação é feita em hospital autorizado pelo Ministério da Saúde, com custos pagos pelo SUS.', JOURNEY_SOURCES['doacao']),
    ('pos-doacao', 'Depois da doação', 'Depois da doação', 'Recuperação em poucas semanas e, se quiser, notícias do paciente.', '',
     'A medula doada se recompõe em poucas semanas, e quem doa por punção costuma voltar às atividades em cerca de uma semana. Sintomas fora do esperado devem ser informados à equipe que fez a coleta. Seis meses após o transplante, você pode pedir notícias do paciente ao REDOME; depois de um ano, enviar uma mensagem anônima; e, depois de 18 meses, solicitar um encontro.',
     [], None, 'O REDOME intermedeia, de forma anônima, o contato com o paciente.', JOURNEY_SOURCES['pos_doacao']),
]

# Jornada do transplante alogênico (com doador). No autólogo, as células são do próprio paciente e não há busca.
RECEPTOR_STEPS = [
    ('indicacao', 'Indicação médica', 'Indicação médica', 'O médico indica o transplante e o tipo: autólogo ou com doador.', '', {},
     'O transplante de células-tronco hematopoéticas (TCTH) só começa com a indicação do médico responsável pelo tratamento, em geral um hematologista. É ele quem define o tipo: autólogo, com as células do próprio paciente, ou alogênico, com as células de um doador. As etapas de busca de doador valem só para o transplante alogênico.',
     JOURNEY_SOURCES['inca']),
    ('encaminhamento', 'Encaminhamento', 'Encaminhamento', 'O SUS encaminha para o centro transplantador habilitado de referência da sua região.', '',
     {
         'maceio': 'Alagoas não tem centro habilitado para transplante de medula no CNES. O SUS encaminha para outro estado, como Pernambuco.',
         'recife': 'Recife tem centros habilitados para transplante de medula no CNES, como o IMIP e o Hospital Português.',
     },
     'Com a indicação, o paciente é encaminhado pelo SUS a um centro transplantador habilitado. A regulação é feita pelo SUS. O app não agenda, não altera fila e não substitui a equipe que acompanha o paciente.',
     JOURNEY_SOURCES['centros']),
    ('busca', 'Busca de doador', 'Busca de doador compatível', 'Primeiro na família; depois no REDOME e em registros de mais de 50 países.', '', {},
     'A busca começa pelos irmãos e parentes próximos: um irmão tem cerca de 25% de chance de ser compatível. Sem doador na família, o médico inscreve o paciente no REREME, o Registro Nacional de Receptores de Medula Óssea, e o sistema cruza os dados dele com o REDOME e com registros de mais de 50 países. O médico deve atualizar os dados do paciente pelo menos a cada 3 meses. O paciente e a família não pagam pela busca. No transplante autólogo, não há busca de doador.',
     JOURNEY_SOURCES['pacientes']),
    ('preparacao', 'Preparação', 'Preparação', 'Exames e condicionamento antes do transplante.', '', {},
     'No centro transplantador, o paciente faz exames e o condicionamento: quimioterapia e, em alguns casos, radioterapia, que destroem a medula doente para que as novas células possam se instalar. Essa fase é conduzida pela equipe que vai realizar o transplante.',
     JOURNEY_SOURCES['inca']),
    ('transplante', 'Transplante', 'Transplante', 'Infusão das células e internação no centro transplantador.', '', {},
     'As células-tronco são aplicadas na veia, como uma transfusão de sangue. Em cerca de duas semanas, a nova medula começa a produzir células: é a chamada "pega". O paciente fica internado, com cuidados para evitar infecções. Só a equipe do centro transplantador define datas, protocolos e alta.',
     JOURNEY_SOURCES['inca']),
    ('pos-tcth', 'Acompanhamento', 'Acompanhamento', 'Consultas frequentes depois da alta.', '', {},
     'Depois da alta, há consultas frequentes para prevenir infecções e tratar a doença do enxerto contra o hospedeiro (DECH), uma reação das células transplantadas contra o organismo do paciente, relativamente comum e controlável com medicamentos. Em geral, depois de um ano é possível voltar às atividades normais. O calendário é da equipe médica.',
     JOURNEY_SOURCES['inca']),
]

CNES = 'CNES/DataSUS'
HEMO_SERVICES = ['Doação de sangue', 'Cadastro de medula (REDOME)', 'Coleta HLA']

# Centros com CNES ficam com origem 'cnes' e passam a ser atualizados pela coleta mensal
# (workers/collectors/cnes). Os demais centros do recorte (ex.: transplante em Recife) vêm da coleta.
CENTERS = [
    # Sem CNES próprio: o único CNES do Hemoal é a sede (2003899). Mantido como cadastro da liga.
    {'slug': 'hemoal-trapiche', 'nome': 'Hemoal · Hemocentro de Alagoas', 'nome_curto': 'Hemoal · Trapiche',
     'endereco': 'Av. Jorge de Lima, 58 · Trapiche da Barra', 'endereco_lista': 'Av. Jorge de Lima, 58 · Trapiche',
     'cidade': 'Maceió', 'uf': 'AL', 'tipo': 'hemocentro', 'lat': -9.6725, 'lng': -35.7583,
     'horario': 'Seg a sex · 7h às 18h · Sáb · 7h às 12h', 'telefone': '(82) 3315-2102', 'fonte': 'Cadastro da liga (Hemoal)',
     'fonte_data': '2026-09-30', 'servicos': HEMO_SERVICES, 'origem': 'manual'},
    {'slug': 'hemoal-sede', 'cnes': '2003899', 'nome': 'Hemoal · Sede', 'nome_curto': 'Hemoal · Sede',
     'endereco': 'Av. Menino Marcelo, 9974 · Cidade Universitária', 'cidade': 'Maceió', 'uf': 'AL', 'tipo': 'hemocentro',
     'lat': -9.555, 'lng': -35.77, 'horario': 'Seg a sex · 7h às 18h', 'telefone': '(82) 3373-9628', 'fonte': CNES,
     'fonte_data': '2026-09-30', 'servicos': HEMO_SERVICES, 'origem': 'cnes', 'codigo_ibge': '2704302'},
    {'slug': 'mutirao-hemoal', 'nome': 'Mutirão de cadastro de doadores de medula', 'nome_curto': 'Mutirão de cadastro',
     'endereco': 'Hemoal · Av. Jorge de Lima, 58 · Trapiche da Barra', 'endereco_lista': 'Hemoal · Trapiche',
     'cidade': 'Maceió', 'uf': 'AL', 'tipo': 'campanha', 'lat': -9.6724, 'lng': -35.7578, 'evento_quando': '25 out · 8h–16h',
     'evento_fim': '2026-10-25',
     'fonte': 'Ministério da Saúde', 'fonte_data': '2026-10-12', 'servicos': ['Cadastro de medula (REDOME)'], 'origem': 'manual'},
    {'slug': 'hemope', 'cnes': '0000809', 'nome': 'Hemope · Fundação de Hematologia de Pernambuco', 'nome_curto': 'Hemope · Recife',
     'endereco': 'Rua Joaquim Nabuco, 171 · Graças', 'cidade': 'Recife', 'uf': 'PE', 'tipo': 'hemocentro', 'lat': -8.0479,
     'lng': -34.8981, 'horario': 'Consulte o horário no hemocentro', 'telefone': '(81) 3182-4695', 'fonte': CNES,
     'fonte_data': '2026-09-30', 'servicos': HEMO_SERVICES, 'observacoes': 'Referência regional para transplante.',
     'origem': 'cnes', 'codigo_ibge': '2611606'},
]

# HUPAA saiu: no CNES ele não tem habilitação de transplante de medula (2401–2403).
RETIRED_CENTERS = ['hupaa']

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
# Tempo de busca de doador (indicador `espera`) e regras de estimativa não têm exemplo: não há fonte pública desse
# tempo, e um número inventado no app pareceria dado oficial. A estimativa (RF12) é desejável e está fora do app.

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

# Versão 1.1 (RF02), a mesma que a migração consent.0003 publica.
TERMOS_VERSION = '1.1'
TERMOS = [
    {'title': '1. Finalidade', 'body': 'Guardamos seu e-mail apenas para enviar campanhas, eventos e comunicados oficiais da sua região, se você quiser recebê-los. Sem e-mail, nada é guardado.'},
    {'title': '2. Dados coletados', 'body': 'Somente o e-mail, se você informar. Não pedimos CPF, telefone, peso, altura, sexo biológico nem comorbidades.'},
    {'title': '3. Por quanto tempo', 'body': 'Seu e-mail fica guardado por 12 meses desde o último acesso ao aplicativo. Depois disso, ele é apagado e o seu acesso de convidado é encerrado.'},
    {'title': '4. Seus direitos', 'body': 'Você pode alterar as preferências de aviso ou apagar o e-mail a qualquer momento em Perfil › Contato. Apagar o e-mail encerra o seu acesso na hora.'},
]

DEV_STAFF = [
    {'nome': 'John Doe', 'email': 'admin@stem.com', 'senha': 'admin123', 'nivel': 'Admin', 'tipo_conta': 'Administrador de conteúdo', 'estado': 'AL', 'cidade': 'Maceió'},
    {'nome': 'José da Silva Faustino', 'email': 'silva_js@email.com', 'senha': 'senha123', 'nivel': 'User', 'tipo_conta': 'Editor', 'estado': 'AL', 'cidade': 'Maceió', 'genero': 'Masculino', 'avatar': 'https://i.pravatar.cc/160?img=12'},
    {'nome': 'Mariana Souza', 'email': 'marisouza@email.com', 'senha': 'senha123', 'nivel': 'User', 'tipo_conta': 'Editor', 'estado': 'PE', 'cidade': 'Recife', 'genero': 'Feminino', 'status': 'inativo'},
]
