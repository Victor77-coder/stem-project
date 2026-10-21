import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type ProfileType = 'doador' | 'receptor' | 'leigo';
export type Sexo = 'feminino' | 'masculino' | 'outro' | '';

export type RegistrationDraft = {
  profile: ProfileType | null;
  name: string;
  email: string;
  password: string;
  cpf: string;
  weight: string;
  height: string;
  sex: Sexo;
  comorbidities: string[];
  cep: string;
  address: string;
  city: string;
  uf: string;
  allowLocation: boolean;
  tcleAccepted: boolean;
  tcleVersion: string;
};

const emptyDraft: RegistrationDraft = {
  profile: null,
  name: '',
  email: '',
  password: '',
  cpf: '',
  weight: '',
  height: '',
  sex: '',
  comorbidities: [],
  cep: '',
  address: '',
  city: '',
  uf: '',
  allowLocation: false,
  tcleAccepted: false,
  tcleVersion: '1.0',
};

type Ctx = {
  draft: RegistrationDraft;
  update: (patch: Partial<RegistrationDraft>) => void;
  reset: () => void;
  isLeigo: boolean;
};

const RegistrationContext = createContext<Ctx | null>(null);

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<RegistrationDraft>(emptyDraft);

  const value = useMemo<Ctx>(
    () => ({
      draft,
      update: (patch) => setDraft((prev) => ({ ...prev, ...patch })),
      reset: () => setDraft(emptyDraft),
      isLeigo: draft.profile === 'leigo',
    }),
    [draft],
  );

  return <RegistrationContext.Provider value={value}>{children}</RegistrationContext.Provider>;
}

export function useRegistration() {
  const ctx = useContext(RegistrationContext);
  if (!ctx) {
    throw new Error('useRegistration must be used within RegistrationProvider');
  }
  return ctx;
}
