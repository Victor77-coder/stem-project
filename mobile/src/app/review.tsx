import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { hasEmailContact, useRegistration, type NoticeChoices } from '@/context/RegistrationContext';
import { resetTo } from '@/lib/navigation';
import { turnOnPush } from '@/lib/push';
import { colors, type } from '@/theme';

function noticesSummary(notices: NoticeChoices, email: string) {
  const topics = [notices.campaigns && 'Campanhas', notices.events && 'Eventos', notices.official && 'Comunicados'].filter(Boolean);
  const channels = [notices.push && 'Celular', notices.email && hasEmailContact(email) && 'E-mail'].filter(Boolean);
  if (!topics.length && !channels.length) return 'Nenhum';
  return [topics.join(', ') || 'Nenhum assunto', channels.join(', ') || 'Só na caixa de entrada'].join(' · ');
}

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
  convidado: 'Convidado',
} as const;

export default function ReviewScreen() {
  const { draft, isConvidado, signedIn, signUp, changeProfile } = useRegistration();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await (signedIn ? changeProfile() : signUp());
      // Sem permissão do sistema, a conta fica criada e o push pode ser ligado depois no Perfil.
      if (!signedIn && draft.notices.push) await turnOnPush().catch(() => false);
      resetTo('/conclusion'); // a conta existe: o voltar não reabre o cadastro
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
        {!isConvidado ? <Row label="CPF" value={draft.cpf} /> : null}
        {!isConvidado ? <Row label="Peso" value={draft.weight ? `${draft.weight} kg` : ''} /> : null}
        {!isConvidado ? <Row label="Altura" value={draft.height ? `${draft.height} m` : ''} /> : null}
        {!isConvidado ? <Row label="Sexo" value={draft.sex} /> : null}
        {!isConvidado ? (
          <Row label="Comorbidades" value={draft.comorbidities.length ? draft.comorbidities.join(', ') : ''} />
        ) : null}
        {!isConvidado ? <Row label="CEP" value={draft.cep} /> : null}
        {!isConvidado ? <Row label="Endereço" value={draft.address} /> : null}
        {!isConvidado ? <Row label="Cidade" value={[draft.city, draft.uf].filter(Boolean).join(' / ')} /> : null}
        <Row label="TCLE" value={draft.tcleAccepted ? `Aceito · v${draft.tcleVersion}` : 'Pendente'} />
        {!signedIn ? <Row label="Avisos" value={noticesSummary(draft.notices, draft.email)} /> : null}
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
