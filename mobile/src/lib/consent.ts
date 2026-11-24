import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export type ConsentKind = 'tcle' | 'termos';
export type ConsentDoc = {
  kind: ConsentKind;
  version: string;
  title: string;
  sections: { title: string; body: string }[];
  publishedAt?: string;
};

/** Cópia local para abrir sem conexão. O texto vigente vem do servidor, que confere a versão aceita no envio. */
export const LOCAL_DOCS: Record<ConsentKind, ConsentDoc> = {
  tcle: {
    kind: 'tcle',
    version: '1.0',
    title: 'Termo de Consentimento Livre e Esclarecido',
    publishedAt: '01/10/2026',
    sections: [
      {
        title: '1. Finalidade',
        body: 'Seus dados serão usados apenas para personalizar conteúdos educativos, mostrar centros próximos e organizar sua jornada informativa no STEM Project.',
      },
      {
        title: '2. Dados coletados',
        body: 'Peso, altura, sexo biológico, comorbidades e CEP. Coletamos apenas o mínimo necessário (LGPD, art. 6º).',
      },
      {
        title: '3. O que o app NÃO faz',
        body: 'Não realiza validação clínica, não agenda consultas e não garante compatibilidade. A compatibilidade é avaliada por dois médicos do SUS.',
      },
      {
        title: '4. Seus direitos',
        body: 'Você pode consultar, corrigir e solicitar a inativação dos seus dados a qualquer momento em Perfil › Privacidade.',
      },
    ],
  },
  termos: {
    kind: 'termos',
    version: '1.1',
    title: 'Termos de uso',
    publishedAt: '24/11/2026',
    sections: [
      {
        title: '1. Finalidade',
        body: 'Guardamos seu e-mail apenas para enviar campanhas, eventos e comunicados oficiais da sua região, se você quiser recebê-los. Sem e-mail, nada é guardado.',
      },
      {
        title: '2. Dados coletados',
        body: 'Somente o e-mail, se você informar. Não pedimos CPF, telefone, peso, altura, sexo biológico nem comorbidades.',
      },
      {
        title: '3. Por quanto tempo',
        body: 'Seu e-mail fica guardado por 12 meses desde o último acesso ao aplicativo. Depois disso, ele é apagado e o seu acesso de convidado é encerrado.',
      },
      {
        title: '4. Seus direitos',
        body: 'Você pode alterar as preferências de aviso ou apagar o e-mail a qualquer momento em Perfil › Contato. Apagar o e-mail encerra o seu acesso na hora.',
      },
    ],
  },
};

/** Termo vigente do tipo pedido: começa pela cópia local e troca pelo do servidor quando ele responde. */
export function useConsentDoc(kind: ConsentKind) {
  const [remote, setRemote] = useState<ConsentDoc | null>(null);

  useEffect(() => {
    let alive = true;
    api<ConsentDoc>(`/termos/${kind}/`, { auth: false })
      .then((doc) => {
        if (alive) setRemote(doc);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [kind]);

  return remote?.kind === kind ? remote : LOCAL_DOCS[kind];
}
