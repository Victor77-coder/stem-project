import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { useRegistration } from '@/context/RegistrationContext';

export default function RegisterScreen() {
  const { draft, update, isLeigo } = useRegistration();

  function next() {
    router.push('/terms');
  }

  return (
    <Screen footer={<Button label="Continuar" onPress={next} />}>
      <StepHeader
        title="Crie sua conta"
        subtitle="Informe os dados para criar seu acesso."
        step={2}
        total={isLeigo ? 3 : 5}
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
          hint={isLeigo ? 'Opcional no perfil leigo.' : undefined}
        />
        <Field
          label="Senha"
          placeholder="Mínimo 8 caracteres"
          secureTextEntry
          value={draft.password}
          onChangeText={(password) => update({ password })}
        />
        {!isLeigo ? (
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
