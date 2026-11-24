import { StyleSheet, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { useRegistration } from '@/context/RegistrationContext';

export default function RegisterScreen() {
  const { draft, update, isConvidado, totalSteps } = useRegistration();

  function next() {
    router.push('/physical');
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
        <Field label="Nome" placeholder="Como devemos te chamar" value={draft.name} onChangeText={(name) => update({ name })} />
        <Field
          label="E-mail"
          placeholder="voce@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={draft.email}
          onChangeText={(email) => update({ email })}
          hint={isConvidado ? 'Opcional no perfil convidado.' : undefined}
        />
        <Field
          label="Senha"
          placeholder="Mínimo 8 caracteres"
          secureTextEntry
          value={draft.password}
          onChangeText={(password) => update({ password })}
        />
        {!isConvidado ? (
          <Field
            label="CPF"
            placeholder="000.000.000-00"
            keyboardType="number-pad"
            value={draft.cpf}
            onChangeText={(cpf) => update({ cpf })}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14, marginTop: 8 },
});
