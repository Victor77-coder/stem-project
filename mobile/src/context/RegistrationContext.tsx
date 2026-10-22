import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, channel, tokenStore, type Tokens } from '@/lib/api';

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

type Me = Omit<RegistrationDraft, 'password'> & {
  phone: string;
  hasPassword: boolean;
  tcleAcceptedAt: string | null;
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
  signedIn: boolean;
  restoring: boolean;
  acceptedAt: string | null;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: () => Promise<void>;
  changeProfile: () => Promise<void>;
  save: (patch: Partial<RegistrationDraft>, currentPassword?: string) => Promise<void>;
  signOut: () => Promise<void>;
  deactivate: (password: string) => Promise<void>;
};

const RegistrationContext = createContext<Ctx | null>(null);

const decimal = (value: string) => value.replace(/[^\d,.]/g, '').replace(',', '.');

function contact(email: string) {
  const value = email.trim();
  if (!value) return {};
  return value.includes('@') ? { email: value } : { phone: value };
}

function clinicalBody(draft: RegistrationDraft) {
  return {
    cpf: draft.cpf,
    weight: decimal(draft.weight),
    height: decimal(draft.height),
    sex: draft.sex,
    comorbidities: draft.comorbidities,
  };
}

function registrationBody(draft: RegistrationDraft) {
  const base = {
    profile: draft.profile,
    name: draft.name.trim(),
    ...contact(draft.email),
    ...(draft.password ? { password: draft.password } : {}),
    cep: draft.cep,
    address: draft.address,
    city: draft.city,
    uf: draft.uf,
    allowLocation: draft.allowLocation,
    tcleAccepted: draft.tcleAccepted,
    tcleVersion: draft.tcleVersion,
    channel,
  };
  return draft.profile === 'leigo' ? base : { ...base, ...clinicalBody(draft) };
}

function patchBody(patch: Partial<RegistrationDraft>) {
  const body: Record<string, unknown> = { ...patch };
  delete body.password;
  delete body.profile;
  delete body.tcleAccepted;
  delete body.tcleVersion;
  if (patch.weight !== undefined) body.weight = decimal(patch.weight);
  if (patch.height !== undefined) body.height = decimal(patch.height);
  if (patch.email !== undefined) Object.assign(body, { email: '', ...contact(patch.email) });
  return body;
}

function fromMe(me: Me): RegistrationDraft {
  return {
    profile: me.profile,
    name: me.name,
    email: me.email || me.phone,
    password: '',
    cpf: me.cpf,
    weight: me.weight.replace('.', ','),
    height: me.height.replace('.', ','),
    sex: me.sex,
    comorbidities: me.comorbidities,
    cep: me.cep,
    address: me.address,
    city: me.city,
    uf: me.uf,
    allowLocation: me.allowLocation,
    tcleAccepted: me.tcleAccepted,
    tcleVersion: me.tcleVersion || '1.0',
  };
}

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<RegistrationDraft>(emptyDraft);
  const [signedIn, setSignedIn] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);

  const hydrate = useCallback((me: Me) => {
    setDraft(fromMe(me));
    setAcceptedAt(me.tcleAcceptedAt);
    setSignedIn(true);
  }, []);

  const startSession = useCallback(
    async (data: Tokens & { me: Me }) => {
      await tokenStore.save({ access: data.access, refresh: data.refresh });
      hydrate(data.me);
    },
    [hydrate],
  );

  const clear = useCallback(async () => {
    await tokenStore.save(null);
    setSignedIn(false);
    setAcceptedAt(null);
    setDraft(emptyDraft);
  }, []);

  useEffect(() => {
    tokenStore
      .load()
      .then((saved) => (saved ? api<Me>('/me/').then(hydrate) : undefined))
      .catch(() => undefined)
      .finally(() => setRestoring(false));
  }, [hydrate]);

  const value = useMemo<Ctx>(
    () => ({
      draft,
      update: (patch) => setDraft((prev) => ({ ...prev, ...patch })),
      reset: () => setDraft(emptyDraft),
      isLeigo: draft.profile === 'leigo',
      signedIn,
      restoring,
      acceptedAt,
      async signIn(identifier, password) {
        const data = await api<Tokens & { me: Me }>('/auth/login/', {
          method: 'POST',
          body: { identifier, password, channel },
          auth: false,
        });
        await startSession(data);
      },
      async signUp() {
        const data = await api<Tokens & { me: Me }>('/auth/register/', {
          method: 'POST',
          body: registrationBody(draft),
          auth: false,
        });
        await startSession(data);
      },
      async changeProfile() {
        const me = await api<Me>('/me/profile/', {
          method: 'POST',
          body: { ...registrationBody(draft), ...clinicalBody(draft) },
        });
        hydrate(me);
      },
      async save(patch, currentPassword) {
        if (!signedIn) {
          setDraft((prev) => ({ ...prev, ...patch }));
          return;
        }
        if (patch.password) {
          const fresh = await api<Tokens>('/auth/password/change/', {
            method: 'POST',
            body: { current: currentPassword ?? '', new: patch.password },
          });
          await tokenStore.save(fresh);
        }
        const body = patchBody(patch);
        if (Object.keys(body).length) hydrate(await api<Me>('/me/', { method: 'PATCH', body }));
      },
      async signOut() {
        const refresh = tokenStore.get()?.refresh;
        if (refresh) await api('/auth/logout/', { method: 'POST', body: { refresh }, auth: false }).catch(() => undefined);
        await clear();
      },
      async deactivate(password) {
        await api('/me/deactivate/', { method: 'POST', body: { password } });
        await clear();
      },
    }),
    [draft, signedIn, restoring, acceptedAt, startSession, hydrate, clear],
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
