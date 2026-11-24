import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, channel, tokenStore, type Tokens } from '@/lib/api';
import { forgetDevice, registerDevice } from '@/lib/push';

export type ProfileType = 'doador' | 'receptor' | 'convidado';
export type Sexo = 'feminino' | 'masculino' | 'outro' | '';

/** Etapa "Quer receber avisos?" (RF10). Tudo começa desligado. */
export type NoticeChoices = {
  push: boolean;
  email: boolean;
  campaigns: boolean;
  events: boolean;
  official: boolean;
};

export const NO_NOTICES: NoticeChoices = { push: false, email: false, campaigns: false, events: false, official: false };

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
  notices: NoticeChoices;
};

type Me = Omit<RegistrationDraft, 'password' | 'notices'> & {
  phone: string;
  hasPassword: boolean;
  tcleAcceptedAt: string | null;
  emailConfirmed: boolean;
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
  notices: NO_NOTICES,
};

type Ctx = {
  draft: RegistrationDraft;
  update: (patch: Partial<RegistrationDraft>) => void;
  reset: () => void;
  isConvidado: boolean;
  signedIn: boolean;
  restoring: boolean;
  acceptedAt: string | null;
  emailConfirmed: boolean;
  setEmailConfirmed: (value: boolean) => void;
  /** Quem já tem conta pula a etapa de avisos ao trocar de perfil: as preferências ficam no Perfil. */
  totalSteps: number;
  signIn: (identifier: string, password: string) => Promise<void>;
  signUp: () => Promise<void>;
  /** Entrada do convidado com e-mail (RF02). 'code' quando o e-mail já é de um convidado e a volta pede o código. */
  enterAsGuest: (patch?: Partial<RegistrationDraft>) => Promise<'session' | 'code'>;
  confirmGuestCode: (code: string, patch?: Partial<RegistrationDraft>) => Promise<void>;
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

export const hasEmailContact = (value: string) => value.trim().includes('@');

function noticesBody(draft: RegistrationDraft) {
  const { email, campaigns, events, official } = draft.notices;
  return { email: email && hasEmailContact(draft.email), campaigns, events, official };
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
    notices: noticesBody(draft),
    channel,
  };
  return draft.profile === 'convidado' ? base : { ...base, ...clinicalBody(draft) };
}

function patchBody(patch: Partial<RegistrationDraft>) {
  const body: Record<string, unknown> = { ...patch };
  delete body.password;
  delete body.profile;
  delete body.tcleAccepted;
  delete body.tcleVersion;
  delete body.notices;
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
    notices: NO_NOTICES,
  };
}

export function RegistrationProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<RegistrationDraft>(emptyDraft);
  const [signedIn, setSignedIn] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [emailConfirmed, setEmailConfirmed] = useState(false);

  const hydrate = useCallback((me: Me) => {
    // Mantém a escolha de avisos do cadastro: a conclusão ainda usa para pedir o código do e-mail.
    setDraft((prev) => ({ ...fromMe(me), notices: prev.notices }));
    setAcceptedAt(me.tcleAcceptedAt);
    setEmailConfirmed(me.emailConfirmed);
    setSignedIn(true);
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    // Aparelho novo ou token renovado: quem já ligou o push continua recebendo, sem pedir permissão de novo.
    api<{ push: boolean }>('/me/preferences/')
      .then((prefs) => (prefs.push ? registerDevice(false) : undefined))
      .catch(() => undefined);
  }, [signedIn]);

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
    setEmailConfirmed(false);
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
      isConvidado: draft.profile === 'convidado',
      signedIn,
      restoring,
      acceptedAt,
      emailConfirmed,
      setEmailConfirmed,
      totalSteps: signedIn ? 5 : 6,
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
      async enterAsGuest(patch) {
        const next = { ...draft, ...patch, profile: 'convidado' as const };
        const data = await api<(Tokens & { me: Me }) | { codeSent: true }>('/auth/register/', {
          method: 'POST',
          body: registrationBody(next),
          auth: false,
        });
        if ('codeSent' in data) return 'code';
        await startSession(data);
        return 'session';
      },
      async confirmGuestCode(code, patch) {
        const next = { ...draft, ...patch };
        const data = await api<Tokens & { me: Me }>('/auth/convidado/codigo/', {
          method: 'POST',
          body: {
            email: next.email.trim(),
            code,
            tcleAccepted: next.tcleAccepted,
            tcleVersion: next.tcleVersion,
            notices: noticesBody(next),
            channel,
          },
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
        await forgetDevice();
        const refresh = tokenStore.get()?.refresh;
        if (refresh) await api('/auth/logout/', { method: 'POST', body: { refresh }, auth: false }).catch(() => undefined);
        await clear();
      },
      async deactivate(password) {
        await api('/me/deactivate/', { method: 'POST', body: { password } });
        await clear();
      },
    }),
    [draft, signedIn, restoring, acceptedAt, emailConfirmed, startSession, hydrate, clear],
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
