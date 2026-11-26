import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Field } from '@/components/Field';
import { Logo } from '@/components/Logo';
import { NavPair } from '@/components/NavPair';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { useRegistration } from '@/context/RegistrationContext';
import { hasErrors, locationErrors, type FieldErrors } from '@/lib/validation';
import { colors, type } from '@/theme';

export default function LocationScreen() {
  const { draft, update, signedIn, totalSteps } = useRegistration();
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState('Preenchimento automático de endereço via API');
  const [errors, setErrors] = useState<FieldErrors>({});

  // Endereço é opcional (RF001 nota 6); só não segue com CEP ou UF inválidos.
  function next() {
    const found = locationErrors(draft);
    setErrors(found);
    if (!hasErrors(found)) router.push(signedIn ? '/review' : '/avisos');
  }

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
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro) {
        setHint('CEP não encontrado.');
        return;
      }
      // Número e complemento ficam com o usuário; o bairro do ViaCEP pode ser editado.
      update({
        address: data.logradouro ?? '',
        district: data.bairro ?? '',
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
          onRight={next}
        />
      }
    >
      <StepHeader
        title="Localização"
        subtitle="Etapa opcional. Informe o CEP para preencher o endereço automaticamente."
        step={5}
        total={totalSteps}
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
              onChangeText={(cep) => {
                setErrors(({ cep: _removed, ...rest }) => rest);
                update({ cep });
              }}
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
        <Text style={[styles.hint, errors.cep ? styles.error : null]}>{errors.cep ?? hint}</Text>
      </View>

      <Field
        label="Endereço"
        placeholder="Preenchido após CEP"
        value={draft.address}
        onChangeText={(address) => update({ address })}
      />

      <View style={styles.row}>
        <View style={styles.third}>
          <Field label="Número" placeholder="Nº" value={draft.number} onChangeText={(number) => update({ number })} />
        </View>
        <View style={styles.half}>
          <Field label="Bairro" placeholder="Bairro" value={draft.district} onChangeText={(district) => update({ district })} />
        </View>
      </View>

      <Field
        label="Complemento"
        placeholder="Apto, bloco, referência (opcional)"
        value={draft.complement}
        onChangeText={(complement) => update({ complement })}
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
            maxLength={2}
            error={errors.uf}
            value={draft.uf}
            onChangeText={(uf) => {
              setErrors(({ uf: _removed, ...rest }) => rest);
              update({ uf });
            }}
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
  error: { color: colors.danger },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  third: { width: 110 },
});
