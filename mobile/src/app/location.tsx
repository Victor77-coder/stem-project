import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { NavPair } from '@/components/NavPair';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { useRegistration } from '@/context/RegistrationContext';
import { colors, type } from '@/theme';

export default function LocationScreen() {
  const { draft, update } = useRegistration();
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState('Preenchimento automático de endereço via API');

  async function consultarCep() {
    const cep = draft.cep.replace(/\D/g, '');
    if (cep.length !== 8) {
      setHint('Informe um CEP com 8 dígitos.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = (await response.json()) as {
        erro?: boolean;
        logradouro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro) {
        setHint('CEP não encontrado.');
        return;
      }
      update({
        address: data.logradouro ?? '',
        city: data.localidade ?? '',
        uf: data.uf ?? '',
      });
      setHint('Preenchimento automático de endereço via API');
    } catch {
      setHint('Não foi possível consultar o CEP agora.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen
      footer={
        <NavPair
          onLeft={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/physical');
          }}
          onRight={() => router.push('/review')}
        />
      }
    >
      <StepHeader
        title="Localização"
        subtitle="Informe o CEP para preenchimento automático do endereço"
        step={5}
        total={5}
        brand={<Logo />}
      />

      <View style={styles.block}>
        <Text style={styles.label}>CEP</Text>
        <View style={styles.cepRow}>
          <View style={styles.cepField}>
            <TextInput
              placeholder="00000-000"
              placeholderTextColor={colors.muted}
              keyboardType="number-pad"
              value={draft.cep}
              onChangeText={(cep) => update({ cep })}
              style={styles.cepInput}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={loading}
            onPress={consultarCep}
            style={({ pressed }) => [styles.cepBtn, pressed && { opacity: 0.86 }, loading && { opacity: 0.55 }]}
          >
            <Text style={styles.cepBtnText}>{loading ? 'Buscando' : 'Consultar CEP'}</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>{hint}</Text>
      </View>

      <Field
        label="Endereço"
        placeholder="Preenchido após CEP"
        value={draft.address}
        onChangeText={(address) => update({ address })}
      />

      <View style={styles.row}>
        <View style={styles.half}>
          <Field
            label="Cidade"
            placeholder="------"
            value={draft.city}
            onChangeText={(city) => update({ city })}
          />
        </View>
        <View style={styles.half}>
          <Field
            label="Estado"
            placeholder="------"
            autoCapitalize="characters"
            value={draft.uf}
            onChangeText={(uf) => update({ uf })}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: 6 },
  label: { ...type.secondary, color: colors.ink, fontWeight: '600' },
  cepRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  cepField: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    justifyContent: 'center',
  },
  cepInput: { ...type.body, color: colors.ink },
  cepBtn: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cepBtnText: { ...type.caption, color: '#fff', fontWeight: '700' },
  hint: { ...type.caption, color: colors.muted },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
});
