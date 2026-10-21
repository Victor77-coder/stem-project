import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

export type Ion = keyof typeof Ionicons.glyphMap;
export type Category = 'Conceito' | 'Leis no Brasil' | 'Doenças' | 'Mitos';

export type Article = {
  id: string;
  title: string;
  category: Category;
  minutes: number;
  icon: Ion;
  well: string;
  iconColor: string;
  /** recent: biblioteca; catalog: busca e filtros; direct: só pelos atalhos da início */
  list: 'recent' | 'catalog' | 'direct';
  featured?: boolean;
  keywords?: string;
  validated?: string;
  source: string;
  sections: { title: string; body: string }[];
};

export const CATEGORIES = ['Todos', 'Conceito', 'Leis no Brasil', 'Doenças'] as const;
export type LibraryFilter = (typeof CATEGORIES)[number];

const concept = { well: colors.primary100, iconColor: colors.primary600 };
const disease = { well: colors.teal100, iconColor: colors.teal600 };
const law = { well: colors.surfaceMuted, iconColor: colors.textSecondary };
const myth = { well: colors.warning100, iconColor: colors.warning700 };

export const ARTICLES: Article[] = [
  {
    id: 'o-que-sao',
    title: 'Células-tronco: o que são e como podem salvar vidas',
    category: 'Conceito',
    minutes: 5,
    icon: 'git-network-outline',
    ...concept,
    list: 'catalog',
    featured: true,
    source: 'INCA / REDOME · Atualizado em 09/2026',
    sections: [
      {
        title: 'O que são',
        body: 'Células-tronco dão origem a outras células do sangue. A medula óssea, um tecido no interior dos ossos, é uma das principais fontes dessas células.',
      },
      {
        title: 'Por que salvam vidas',
        body: 'Pacientes com doenças como leucemia podem precisar de um transplante para repor a produção de células do sangue.',
      },
      {
        title: 'Como alguém pode ajudar',
        body: 'Pessoas entre 18 e 35 anos, com boa saúde, podem se cadastrar no REDOME. A permanência no cadastro vai até os 60 anos.',
      },
    ],
  },
  {
    id: 'doacao-passo-a-passo',
    title: 'Doação de medula óssea: passo a passo',
    category: 'Conceito',
    minutes: 4,
    icon: 'git-network-outline',
    ...concept,
    list: 'recent',
    validated: 'Validado pela Liga Acadêmica · Publicado em 02/10/2026',
    source: 'Ministério da Saúde e INCA · Atualizado em 02/10/2026',
    sections: [
      {
        title: 'O que é',
        body: 'A medula óssea é um tecido no interior dos ossos que produz as células do sangue. Pacientes com doenças como leucemia podem precisar de um transplante.',
      },
      {
        title: 'Quem pode doar',
        body: 'Pessoas entre 18 e 35 anos, com boa saúde, podem se cadastrar no REDOME. A permanência no cadastro vai até os 60 anos.',
      },
      {
        title: 'Como é feito o cadastro',
        body: 'Basta procurar um hemocentro, preencher um formulário e coletar 5 ml de sangue para o exame de compatibilidade (HLA).',
      },
    ],
  },
  {
    id: 'leucemia',
    title: 'Leucemia e o transplante de células-tronco',
    category: 'Doenças',
    minutes: 6,
    icon: 'pulse-outline',
    ...disease,
    list: 'recent',
    source: 'INCA / REDOME · Atualizado em 09/2026',
    sections: [
      {
        title: 'A doença e o transplante',
        body: 'Pacientes com doenças como leucemia podem precisar de um transplante para repor as células do sangue produzidas na medula óssea.',
      },
      {
        title: 'De onde vêm as células',
        body: 'A medula é um tecido no interior dos ossos. A compatibilidade entre quem doa e quem recebe é genética (HLA), não depende do tipo sanguíneo.',
      },
    ],
  },
  {
    id: 'lei-9434',
    title: 'O que diz a Lei 9.434 sobre transplantes',
    category: 'Leis no Brasil',
    minutes: 5,
    icon: 'scale-outline',
    ...law,
    list: 'recent',
    source: 'INCA / REDOME · Atualizado em 09/2026',
    sections: [
      {
        title: 'A lei',
        body: 'A Lei nº 9.434 organiza a doação e o transplante de órgãos e tecidos no Brasil, o que inclui a medula óssea.',
      },
      {
        title: 'O que isso muda na prática',
        body: 'O cadastro e a busca de doador compatível seguem regras públicas. No SUS, essa busca é feita no REDOME a partir do cadastro enviado pela equipe médica.',
      },
    ],
  },
  {
    id: 'periferico',
    title: 'Medula óssea x células-tronco do sangue periférico',
    category: 'Conceito',
    minutes: 3,
    icon: 'water-outline',
    ...concept,
    list: 'catalog',
    source: 'INCA / REDOME · Atualizado em 09/2026',
    sections: [
      {
        title: 'Duas formas de coletar',
        body: 'A medula pode ser retirada do osso da bacia ou as células podem ser coletadas do sangue. A coleta nunca é feita da coluna.',
      },
      {
        title: 'O que não muda',
        body: 'Nos dois casos, a compatibilidade é genética (HLA). O tipo sanguíneo não define se uma pessoa pode doar para outra.',
      },
    ],
  },
  {
    id: 'doer',
    title: 'Doar medula dói? Entenda o procedimento',
    category: 'Mitos',
    minutes: 3,
    icon: 'bulb-outline',
    ...myth,
    list: 'catalog',
    source: 'INCA / REDOME · Atualizado em 09/2026',
    sections: [
      {
        title: 'Durante a coleta',
        body: 'A coleta é feita com anestesia. Pode haver desconforto leve nos dias seguintes, que passa com analgésicos simples.',
      },
      {
        title: 'Depois da doação',
        body: 'A medula de quem doa se regenera. O organismo repõe as células doadas em cerca de 15 dias.',
      },
    ],
  },
  {
    id: 'redome',
    title: 'REDOME: o registro brasileiro de doadores',
    category: 'Leis no Brasil',
    minutes: 4,
    icon: 'scale-outline',
    ...law,
    list: 'catalog',
    keywords: 'medula doadores registro',
    source: 'Ministério da Saúde e INCA · Atualizado em 02/10/2026',
    sections: [
      {
        title: 'O que é',
        body: 'O REDOME é o registro brasileiro de pessoas dispostas a doar medula. A busca de doador compatível no SUS passa por esse cadastro.',
      },
      {
        title: 'Quem pode entrar',
        body: 'Pessoas entre 18 e 35 anos, com boa saúde, podem se cadastrar. A permanência no cadastro vai até os 60 anos.',
      },
      {
        title: 'Como é feito',
        body: 'Basta procurar um hemocentro, preencher um formulário e coletar 5 ml de sangue para o exame de compatibilidade (HLA).',
      },
    ],
  },
  {
    id: 'tcth',
    title: 'O que é o transplante de medula (TCTH)',
    category: 'Doenças',
    minutes: 5,
    icon: 'pulse-outline',
    ...disease,
    list: 'direct',
    source: 'INCA / REDOME · Atualizado em 09/2026',
    sections: [
      {
        title: 'O tratamento',
        body: 'O transplante de medula repõe a produção de células do sangue de um paciente com células de uma pessoa compatível.',
      },
      {
        title: 'Como a busca começa',
        body: 'O cadastro é enviado pela equipe médica. A busca de doador compatível é feita pelo SUS no REDOME.',
      },
    ],
  },
  {
    id: 'fila-sus',
    title: 'Como funciona a fila de transplantes no SUS',
    category: 'Leis no Brasil',
    minutes: 4,
    icon: 'scale-outline',
    ...law,
    list: 'direct',
    source: 'Ministério da Saúde e INCA · Atualizado em 02/10/2026',
    sections: [
      {
        title: 'Quem conduz a busca',
        body: 'A busca de doador compatível é feita pelo SUS no REDOME, a partir do cadastro enviado pela equipe médica.',
      },
      {
        title: 'O que este app não faz',
        body: 'O conteúdo não agenda consultas, não altera a ordem de atendimento e não promete prazo. A estimativa de tempo, quando aparece, é estatística e não é garantia.',
      },
    ],
  },
];

export const MYTHS: { tag: 'Mito' | 'Verdade'; quote: string; body: string }[] = [
  {
    tag: 'Mito',
    quote: '“Doar medula é tirar um pedaço da coluna.”',
    body: 'Mito. A medula é retirada do osso da bacia ou do sangue, nunca da coluna.',
  },
  {
    tag: 'Mito',
    quote: '“Só pode doar quem tem o mesmo tipo sanguíneo.”',
    body: 'Mito. A compatibilidade é genética (HLA), não depende do tipo sanguíneo.',
  },
  {
    tag: 'Verdade',
    quote: '“A medula do doador se regenera em poucas semanas.”',
    body: 'Verdade. O organismo repõe as células doadas em cerca de 15 dias.',
  },
  {
    tag: 'Mito',
    quote: '“Parentes são sempre compatíveis.”',
    body: 'Mito. Irmãos têm cerca de 25% de chance de compatibilidade.',
  },
];

export const FAQS: { id: string; question: string; answer: string }[] = [
  {
    id: 'dor',
    question: 'Doar medula óssea dói?',
    answer:
      'A coleta é feita com anestesia. Pode haver desconforto leve nos dias seguintes, que passa com analgésicos simples.',
  },
  {
    id: 'tempo',
    question: 'Quanto tempo fico no cadastro do REDOME?',
    answer: 'Quem se cadastra entre 18 e 35 anos pode permanecer no REDOME até os 60 anos.',
  },
  {
    id: 'tatuagem',
    question: 'Posso doar se tiver tatuagem?',
    answer:
      'Ter tatuagem não impede o cadastro. A equipe do hemocentro avalia cada caso, principalmente quando a tatuagem é recente.',
  },
  {
    id: 'paga',
    question: 'Quem paga pelo transplante?',
    answer:
      'No SUS, a busca de doador compatível é feita no REDOME, a partir do cadastro enviado pela equipe médica. Este app não cobra procedimento.',
  },
  {
    id: 'agenda',
    question: 'O app agenda consultas?',
    answer: 'Não. O app não agenda consultas, exames nem a coleta. Datas e encaminhamentos ficam com a equipe médica e o hemocentro.',
  },
];

export function articleById(id: string) {
  return ARTICLES.find((item) => item.id === id) ?? ARTICLES[1];
}

export function catalogArticles() {
  return ARTICLES.filter((item) => item.list !== 'direct');
}

export function fold(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function searchArticles(query: string) {
  const needle = fold(query.trim());
  const source = catalogArticles();
  if (!needle) return source;
  return source.filter((article) => {
    const haystack = fold([article.title, article.category, article.keywords ?? ''].join(' '));
    return haystack.includes(needle);
  });
}

export function cardMeta(article: Article) {
  return `${article.category} · ${article.minutes} min`;
}
