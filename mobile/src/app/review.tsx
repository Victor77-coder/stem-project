import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { useRegistration } from '@/context/RegistrationContext';
import { colors, type } from '@/theme';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || '—'}</Text>
    </View>
  );
}

const profileLabel = {
  doador: 'Doador',
  receptor: 'Receptor',
  leigo: 'Público leigo',
} as const;

export default function ReviewScreen() {
  const { draft, isLeigo, signedIn, signUp, changeProfile } = useRegistration();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await (signedIn ? changeProfile() : signUp());
      router.push('/conclusion');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <View style={{ gap: 10 }}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label={busy ? 'Enviando…' : 'Confirmar cadastro'} disabled={busy} onPress={confirm} />
          <Button label="Voltar e editar" variant="ghost" onPress={() => router.back()} />
        </View>
      }
    >
      <StepHeader
        title="Cadastro revisado"
        subtitle="Confira os dados antes de criar a conta. Administradores não farão busca nominal."
      />

      <View style={styles.card}>
        <Row label="Perfil" value={draft.profile ? profileLabel[draft.profile] : ''} />
        <Row label="Nome" value={draft.name} />
        <Row label="E-mail" value={draft.email} />
        {!isLeigo ? <Row label="CPF" value={draft.cpf} /> : null}
        {!isLeigo ? <Row label="Peso" value={draft.weight ? `${draft.weight} kg` : ''} /> : null}
        {!isLeigo ? <Row label="Altura" value={draft.height ? `${draft.height} m` : ''} /> : null}
        {!isLeigo ? <Row label="Sexo" value={draft.sex} /> : null}
        {!isLeigo ? (
          <Row label="Comorbidades" value={draft.comorbidities.length ? draft.comorbidities.join(', ') : ''} />
        ) : null}
        {!isLeigo ? <Row label="CEP" value={draft.cep} /> : null}
        {!isLeigo ? <Row label="Endereço" value={draft.address} /> : null}
        {!isLeigo ? <Row label="Cidade" value={[draft.city, draft.uf].filter(Boolean).join(' / ')} /> : null}
        <Row label="TCLE" value={draft.tcleAccepted ? `Aceito · v${draft.tcleVersion}` : 'Pendente'} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 8,
  },
  row: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 4,
  },
  label: { ...type.caption, color: colors.muted, fontWeight: '600' },
  error: { ...type.caption, color: colors.danger, textAlign: 'center' },
  value: { ...type.body, color: colors.ink },
});
