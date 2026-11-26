import type { RegistrationDraft } from '@/context/RegistrationContext';

/** Erros por campo. Vazio = a etapa pode seguir. As regras espelham o servidor (participants/services.py). */
export type FieldErrors = Partial<Record<string, string>>;

const digits = (value: string) => value.replace(/\D/g, '');
const number = (value: string) => Number(value.replace(/[^\d,.]/g, '').replace(',', '.'));

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** Dígitos verificadores do CPF (RF001 nota 3). */
export function isCpf(value: string) {
  const d = digits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const check = (size: number) => {
    const sum = d
      .slice(0, size)
      .split('')
      .reduce((acc, n, i) => acc + Number(n) * (size + 1 - i), 0);
    return ((sum * 10) % 11) % 10;
  };
  return check(9) === Number(d[9]) && check(10) === Number(d[10]);
}

/** dd/mm/aaaa de uma data que existe, a partir de 1900 e não futura. */
export function isBirthDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return false;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const real = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return real && year >= 1900 && date <= new Date();
}

/** Etapa "Crie sua conta": todos os campos são obrigatórios. A senha só é pedida de quem ainda não tem uma. */
export function accountErrors(draft: RegistrationDraft, confirm: string, needsPassword: boolean): FieldErrors {
  const errors: FieldErrors = {};
  const email = draft.email.trim();
  const phone = digits(draft.phone);
  if (!draft.name.trim()) errors.name = 'Informe seu nome completo.';
  if (!draft.birthDate) errors.birthDate = 'Informe a data de nascimento.';
  else if (!isBirthDate(draft.birthDate)) errors.birthDate = 'Data inválida. Use dd/mm/aaaa.';
  if (!email) errors.email = 'Informe seu e-mail.';
  else if (!isEmail(email)) errors.email = 'Informe um e-mail válido.';
  if (!phone) errors.phone = 'Informe seu telefone.';
  else if (phone.length !== 10 && phone.length !== 11) errors.phone = 'Informe o telefone com DDD.';
  if (!draft.cpf.trim()) errors.cpf = 'Informe seu CPF.';
  else if (!isCpf(draft.cpf)) errors.cpf = 'CPF inválido. Confira os números.';
  if (needsPassword || draft.password) {
    if (draft.password.length < 8) errors.password = 'A senha precisa ter pelo menos 8 caracteres.';
    else if (/^\d+$/.test(draft.password)) errors.password = 'A senha não pode ter só números.';
    if (!confirm) errors.confirm = 'Digite a senha novamente.';
    else if (confirm !== draft.password) errors.confirm = 'As senhas não conferem.';
  }
  return errors;
}

/** Etapa "Dados físicos": obrigatórios para doador e receptor (RF001 nota 5). Faixas iguais às do servidor. */
export function physicalErrors(draft: RegistrationDraft): FieldErrors {
  const errors: FieldErrors = {};
  const weight = number(draft.weight);
  const height = number(draft.height);
  if (!draft.weight.trim()) errors.weight = 'Informe o peso.';
  else if (!(weight >= 20 && weight <= 350)) errors.weight = 'Peso entre 20 e 350 kg.';
  if (!draft.height.trim()) errors.height = 'Informe a altura.';
  else if (!(height >= 0.5 && height <= 2.5)) errors.height = 'Altura entre 0,50 e 2,50 m.';
  if (!draft.sex) errors.sex = 'Escolha o sexo biológico.';
  if (!draft.comorbidities.length) errors.comorbidities = 'Marque ao menos uma opção. Se não tiver, marque "Nenhuma".';
  return errors;
}

const UFS = new Set(
  'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '),
);

/** Etapa "Localização": tudo opcional (RF001 nota 6), mas o que for preenchido precisa ser válido. */
export function locationErrors(draft: RegistrationDraft): FieldErrors {
  const errors: FieldErrors = {};
  const cep = digits(draft.cep);
  if (cep && cep.length !== 8) errors.cep = 'O CEP deve ter 8 dígitos.';
  if (draft.uf.trim() && !UFS.has(draft.uf.trim().toUpperCase())) errors.uf = 'UF inválida. Use a sigla, ex.: AL.';
  return errors;
}

export const hasErrors = (errors: FieldErrors) => Object.keys(errors).length > 0;
