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
  /** Telefone com DDD, mostrado com máscara (xx) xxxxx-xxxx. O servidor guarda só os dígitos. */
  phone: string;
  password: string;
  cpf: string;
  /** dd/mm/aaaa na tela; o servidor guarda a data. */
  birthDate: string;
  weight: string;
  height: string;
  sex: Sexo;
  comorbidities: string[];
  cep: string;
  address: string;
  number: string;
  district: string;
  city: string;
  uf: string;
  complement: string;
  allowLocation: boolean;
  tcleAccepted: boolean;
  tcleVersion: string;
  notices: NoticeChoices;
};

type Me = Omit<RegistrationDraft, 'password' | 'notices'> & {
  hasPassword: boolean;
  tcleAcceptedAt: string | null;
  emailConfirmed: boolean;
};

const emptyDraft: RegistrationDraft = {
  profile: null,
  name: '',
  email: '',
  phone: '',
  password: '',
  cpf: '',
  birthDate: '',
  weight: '',
  height: '',
  sex: '',
  comorbidities: [],
  cep: '',
  address: '',
  number: '',
  district: '',
  city: '',
  uf: '',
  complement: '',
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
  /** A conta já tem senha: na troca de perfil a etapa da conta não pede outra. */
  hasPassword: boolean;
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
  /** Aceite da versão vigente do TCLE ou dos Termos de Uso, gravado no servidor (RS001). */
  acceptTerms: (version: string) => Promise<void>;
};

const RegistrationContext = createContext<Ctx | null>(null);

const decimal = (value: string) => value.replace(/[^\d,.]/g, '').replace(',', '.');

const onlyDigits = (value: string) => value.replace(/\D/g, '');

/** Máscara do telefone com DDD: (xx) xxxxx-xxxx no celular, (xx) xxxx-xxxx no fixo. */
export function maskPhone(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d ? `(${d}` : '';
  const split = d.length === 11 ? 7 : 6;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, split)}-${d.slice(split)}`;
}

/** Máscara do CPF: xxx.xxx.xxx-xx. O servidor guarda só os dígitos. */
export function maskCpf(value: string) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Máscara da data: dd/mm/aaaa. */
export function maskDate(value: string) {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** 1995-03-15 → 15/03/1995. */
const fromIsoDate = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');

function contact(draft: Pick<RegistrationDraft, 'email' | 'phone' | 'profile'>) {
  const email = draft.email.trim();
  const phone = draft.profile === 'convidado' ? '' : onlyDigits(draft.phone);
  return { ...(email ? { email } : {}), ...(phone ? { phone } : {}) };
}

export const hasEmailContact = (value: string) => value.trim().includes('@');

function noticesBody(draft: RegistrationDraft) {
  const { email, campaigns, events, official } = draft.notices;
  return { email: email && hasEmailContact(draft.email), campaigns, events, official };
}

function clinicalBody(draft: RegistrationDraft) {
  return {
    cpf: draft.cpf,
    ...(draft.birthDate ? { birthDate: draft.birthDate } : {}),
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
    ...contact(draft),
    ...(draft.password ? { password: draft.password } : {}),
    cep: draft.cep,
    address: draft.address,
    number: draft.number,
    district: draft.district,
    city: draft.city,
    uf: draft.uf,
    complement: draft.complement,
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
  if (patch.email !== undefined) body.email = patch.email.trim();
  if (patch.phone !== undefined) body.phone = onlyDigits(patch.phone);
  if (patch.birthDate !== undefined) body.birthDate = patch.birthDate || null;
  return body;
}

function fromMe(me: Me): RegistrationDraft {
  return {
    profile: me.profile,
    name: me.name,
    email: me.email,
    phone: maskPhone(me.phone),
    password: '',
    cpf: maskCpf(me.cpf),
    birthDate: fromIsoDate(me.birthDate),
    weight: me.weight.replace('.', ','),
    height: me.height.replace('.', ','),
    sex: me.sex,
    comorbidities: me.comorbidities,
    cep: me.cep,
    address: me.address,
    number: me.number,
    district: me.district,
    city: me.city,
    uf: me.uf,
    complement: me.complement,
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
  const [hasPassword, setHasPassword] = useState(false);

  const hydrate = useCallback((me: Me) => {
    // Mantém a escolha de avisos do cadastro: a conclusão ainda usa para pedir o código do e-mail.
    setDraft((prev) => ({ ...fromMe(me), notices: prev.notices }));
    setAcceptedAt(me.tcleAcceptedAt);
    setEmailConfirmed(me.emailConfirmed);
    setHasPassword(me.hasPassword);
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
    setHasPassword(false);
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
      hasPassword,
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
      async acceptTerms(version) {
        if (!signedIn) {
          setDraft((prev) => ({ ...prev, tcleAccepted: true, tcleVersion: version }));
          return;
        }
        hydrate(await api<Me>('/me/consent/', { method: 'POST', body: { tcleAccepted: true, tcleVersion: version, channel } }));
      },
    }),
    [draft, signedIn, hasPassword, restoring, acceptedAt, emailConfirmed, startSession, hydrate, clear],
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
