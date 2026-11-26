import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { maskCpf, maskDate, maskPhone, useRegistration } from '@/context/RegistrationContext';
import { accountErrors, hasErrors, type FieldErrors } from '@/lib/validation';
import { colors, type } from '@/theme';

export default function RegisterScreen() {
  const { draft, update, isConvidado, totalSteps, signedIn, hasPassword } = useRegistration();
  const [confirm, setConfirm] = useState(draft.password);
  const [errors, setErrors] = useState<FieldErrors>({});
  // O * só aparece depois de uma tentativa de seguir com campos faltando.
  const [tried, setTried] = useState(false);
  const mark = tried && !isConvidado;
  // Na troca de perfil de quem já tem senha, a etapa não pede outra.
  const askPassword = !(signedIn && hasPassword);

  function next() {
    if (!isConvidado) {
      const found = accountErrors(draft, confirm, askPassword);
      setErrors(found);
      if (hasErrors(found)) {
        setTried(true);
        return;
      }
    }
    router.push('/physical');
  }

  /** Corrige o campo e já tira a mensagem de erro dele. */
  function edit(field: string, apply: () => void) {
    apply();
    if (errors[field]) setErrors(({ [field]: _removed, ...rest }) => rest);
  }

  // RNF05/RS001: sem o aceite do TCLE, nenhum formulário é mostrado.
  if (!isConvidado && !draft.tcleAccepted) return <Redirect href="/terms" />;

  return (
    <Screen footer={<Button label="Continuar" onPress={next} />}>
      <StepHeader
        title="Crie sua conta"
        subtitle="Informe os dados para criar seu acesso."
        step={3}
        total={isConvidado ? 3 : totalSteps}
        brand={<Logo size="sm" />}
      />

      <View style={styles.form}>
        {mark ? <Text style={styles.legend}>Campos com * são obrigatórios.</Text> : null}
        <Field
          label="Nome Completo"
          placeholder="Como devemos te chamar"
          maxLength={150}
          required={mark}
          error={errors.name}
          value={draft.name}
          onChangeText={(name) => edit('name', () => update({ name }))}
        />
         <Field
          label="E-mail"
          placeholder="voce@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
          required={mark}
          error={errors.email}
          value={draft.email}
          onChangeText={(email) => edit('email', () => update({ email }))}
          hint={isConvidado ? 'Opcional no perfil convidado.' : ''}
          />
          {!isConvidado ? (
            <Field
              label="CPF"
              placeholder="000.000.000-00"
              keyboardType="number-pad"
              maxLength={14}
              required={mark}
              error={errors.cpf}
              value={draft.cpf}
              onChangeText={(cpf) => edit('cpf', () => update({ cpf: maskCpf(cpf) }))}
            />
          ) : null}
        {!isConvidado ? (
          <Field
            label="Data de nascimento"
            placeholder="dd/mm/aaaa"
            keyboardType="number-pad"
            maxLength={10}
            required={mark}
            error={errors.birthDate}
            value={draft.birthDate}
            onChangeText={(birthDate) => edit('birthDate', () => update({ birthDate: maskDate(birthDate) }))}
          />
        ) : null}
        {!isConvidado ? (
          <Field
            label="Telefone"
            placeholder="(00) 00000-0000"
            keyboardType="phone-pad"
            autoComplete="tel"
            required={mark}
            error={errors.phone}
            value={draft.phone}
            onChangeText={(phone) => edit('phone', () => update({ phone: maskPhone(phone) }))}
          />
        ) : null}
        {askPassword ? (
          <>
            <Field
              label="Senha"
              placeholder="Mínimo 8 caracteres"
              secureTextEntry
              required={mark}
              error={errors.password}
              value={draft.password}
              onChangeText={(password) => edit('password', () => update({ password }))}
            />
            <Field
              label="Confirmar senha"
              placeholder="Digite a senha novamente"
              secureTextEntry
              required={mark}
              error={errors.confirm}
              value={confirm}
              onChangeText={(value) => edit('confirm', () => setConfirm(value))}
            />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14, marginTop: 8 },
  legend: { ...type.caption, color: colors.muted },
});
