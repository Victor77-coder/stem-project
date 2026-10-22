import { useCallback, useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  COLLECTED,
  GLOSSARY,
  PROFILE_COMORBIDITIES,
  TEAM,
  seedHistory,
  type HistoryEvent,
  type HistoryIcon,
} from '@/content/profile';
import { useRegistration, type ProfileType, type RegistrationDraft, type Sexo } from '@/context/RegistrationContext';
import { api } from '@/lib/api';
import { colors } from '@/theme';

type Screen =
  | 'hub'
  | 'account'
  | 'physical'
  | 'location'
  | 'privacy'
  | 'permissions'
  | 'history'
  | 'glossary'
  | 'help'
  | 'about'
  | 'contact'
  | 'terms';

type Props = {
  profile: ProfileType;
  onNotifications: () => void;
  onCenters: () => void;
  onChooseProfile: () => void;
};

type PhysicalForm = {
  weight: string;
  height: string;
  sex: Sexo;
  comorbidities: string[];
};

const SEX_OPTIONS: { id: Sexo; label: string }[] = [
  { id: 'feminino', label: 'Feminino' },
  { id: 'masculino', label: 'Masculino' },
  { id: 'outro', label: 'Outro' },
];

const HISTORY_ICON: Record<HistoryIcon, keyof typeof Ionicons.glyphMap> = {
  pulse: 'pulse-outline',
  shield: 'shield-checkmark-outline',
  person: 'person-outline',
};

type ApiHistory = { id: number; icon: HistoryIcon; title: string; detail: string; when: string };

function fromApi(item: ApiHistory): HistoryEvent {
  return { id: String(item.id), icon: item.icon, title: item.title, detail: item.detail, when: stamp(new Date(item.when)) };
}

export function ProfileFlow({ profile, onNotifications, onCenters, onChooseProfile }: Props) {
  const { draft, update, signedIn, acceptedAt, save, signOut, deactivate } = useRegistration();
  const [screen, setScreen] = useState<Screen>('hub');
  const [confirm, setConfirm] = useState(false);
  const [exportNote, setExportNote] = useState('');
  const [history, setHistory] = useState<HistoryEvent[]>(() => (signedIn ? [] : seedHistory(profile)));
  const [physicalDraft, setPhysicalDraft] = useState<PhysicalForm | null>(null);
  const shown = present(draft, profile, acceptedAt);

  const loadHistory = useCallback(() => {
    if (!signedIn) return;
    api<ApiHistory[]>('/me/history/')
      .then((items) => setHistory(items.map(fromApi)))
      .catch(() => undefined);
  }, [signedIn]);

  useEffect(loadHistory, [loadHistory]);

  function pushHistory(events: HistoryEvent[]) {
    if (!events.length) return;
    setHistory((list) => [...events, ...list]);
  }

  async function persist(patch: Partial<RegistrationDraft>, events: HistoryEvent[], currentPassword?: string) {
    try {
      await save(patch, currentPassword);
    } catch (err) {
      Alert.alert('Não foi possível salvar', err instanceof Error ? err.message : 'Tente novamente.');
      return false;
    }
    if (signedIn) loadHistory();
    else pushHistory(events);
    setScreen('hub');
    return true;
  }

  async function leave() {
    await signOut();
    router.replace('/welcome');
  }

  async function inactivate(password: string) {
    try {
      await deactivate(password);
    } catch (err) {
      Alert.alert('Não foi possível inativar', err instanceof Error ? err.message : 'Tente novamente.');
      return;
    }
    setConfirm(false);
    router.replace('/welcome');
  }

  async function exportData() {
    if (!signedIn || !shown.email) {
      setExportNote('Adicione um e-mail em Dados da conta para receber a cópia.');
      return;
    }
    try {
      const data = await api<{ detail: string }>('/me/export/', { method: 'POST' });
      setExportNote(`${data.detail} (${shown.emailMasked})`);
    } catch (err) {
      setExportNote(err instanceof Error ? err.message : 'Não foi possível enviar agora.');
    }
  }

  function savePhysical(next: PhysicalForm, prev: PhysicalForm) {
    void persist(
      {
        weight: stripUnit(next.weight),
        height: stripUnit(next.height),
        sex: next.sex,
        comorbidities: next.comorbidities,
      },
      diffPhysical(prev, next),
    );
  }

  return (
    <View style={styles.fill}>
      {screen === 'hub' ? (
        <Hub
          profile={profile}
          shown={shown}
          onOpen={setScreen}
          onNotifications={onNotifications}
          onLogout={() => void leave()}
          onChooseProfile={onChooseProfile}
        />
      ) : null}
      {screen === 'account' ? (
        <AccountScreen
          shown={shown}
          draft={draft}
          onCancel={() => setScreen('hub')}
          onSave={(patch, events, currentPassword) => void persist(patch, events, currentPassword)}
        />
      ) : null}
      {screen === 'contact' ? (
        <ContactScreen draft={draft} onCancel={() => setScreen('hub')} onSave={(patch) => void persist(patch, [])} />
      ) : null}
      {screen === 'physical' ? (
        <PhysicalScreen
          initial={
            physicalDraft ?? {
              weight: shown.weight ? `${shown.weight} kg` : '',
              height: shown.height ? `${shown.height} m` : '',
              sex: shown.sex,
              comorbidities: shown.comorbidities,
            }
          }
          onChange={setPhysicalDraft}
          onCancel={() => {
            setPhysicalDraft(null);
            setScreen('hub');
          }}
          onHistory={() => setScreen('history')}
          onSave={(next, prev) => {
            setPhysicalDraft(null);
            savePhysical(next, prev);
          }}
        />
      ) : null}
      {screen === 'location' ? (
        <LocationScreen
          draft={draft}
          shown={shown}
          onCancel={() => setScreen('hub')}
          onSave={(patch, events) => void persist(patch, events)}
        />
      ) : null}
      {screen === 'privacy' ? (
        <PrivacyScreen
          shown={shown}
          exportNote={exportNote}
          onBack={() => setScreen('hub')}
          onReadTerm={() => router.push('/tcle')}
          onExport={() => void exportData()}
          onPermissions={() => setScreen('permissions')}
          onInactivate={() => setConfirm(true)}
        />
      ) : null}
      {screen === 'permissions' ? (
        <PermissionsScreen
          allowed={draft.allowLocation}
          onToggle={(allowLocation) => void save({ allowLocation }).catch(() => update({ allowLocation: !allowLocation }))}
          onNotifications={onNotifications}
          onBack={() => setScreen('privacy')}
        />
      ) : null}
      {screen === 'history' ? <HistoryScreen events={history} onBack={() => setScreen(profile === 'leigo' ? 'hub' : 'physical')} /> : null}
      {screen === 'glossary' ? <GlossaryScreen onBack={() => setScreen('hub')} /> : null}
      {screen === 'help' ? <HelpScreen onBack={() => setScreen('hub')} onCenters={onCenters} /> : null}
      {screen === 'about' ? <AboutScreen onBack={() => setScreen('hub')} /> : null}
      {screen === 'terms' ? (
        <TermsScreen
          accepted={draft.tcleAccepted || shown.demo}
          when={shown.termsWhen}
          onBack={() => setScreen('hub')}
          onAccept={() => {
            update({ tcleAccepted: true });
            pushHistory([event('shield', 'Termos aceitos', 'Versão 1.0')]);
          }}
        />
      ) : null}

      <ConfirmSheet visible={confirm} onCancel={() => setConfirm(false)} onConfirm={(password) => void inactivate(password)} />
    </View>
  );
}

function Hub({
  profile,
  shown,
  onOpen,
  onNotifications,
  onLogout,
  onChooseProfile,
}: {
  profile: ProfileType;
  shown: Shown;
  onOpen: (screen: Screen) => void;
  onNotifications: () => void;
  onLogout: () => void;
  onChooseProfile: () => void;
}) {
  const leigo = profile === 'leigo';
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{shown.initials}</Text>
        </View>
        <View style={styles.identityCopy}>
          <Text style={styles.identityName}>{shown.name}</Text>
          {leigo ? null : <Text style={styles.identityEmail}>{shown.emailMasked}</Text>}
          <Text style={styles.identityRole}>{shown.role}</Text>
        </View>
      </View>

      {leigo ? (
        <View style={styles.upgrade}>
          <Text style={styles.upgradeKicker}>QUER IR ALÉM?</Text>
          <Text style={styles.upgradeTitle}>Torne-se Doador ou acompanhe seu tratamento</Text>
          <Text style={styles.upgradeBody}>
            Você poderá acompanhar uma jornada personalizada. Pediremos o TCLE antes de qualquer dado.
          </Text>
          <Pressable accessibilityRole="button" onPress={onChooseProfile} style={styles.upgradeBtn}>
            <Text style={styles.upgradeBtnText}>Escolher perfil</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.kicker}>{leigo ? 'CONTA' : 'MEUS DADOS'}</Text>
      {leigo ? (
        <Row icon="mail-outline" title="Contato (opcional)" caption="Adicione um e-mail para receber novidades" onPress={() => onOpen('contact')} />
      ) : (
        <>
          <Row icon="person-outline" title="Dados da conta" caption="E-mail, senha e contato" onPress={() => onOpen('account')} />
          <Row icon="pulse-outline" title="Dados físicos" caption="Peso, altura, sexo e comorbidades" onPress={() => onOpen('physical')} />
          <Row icon="location-outline" title="Localização" caption={shown.locationLine} onPress={() => onOpen('location')} />
        </>
      )}

      {leigo ? null : <Text style={styles.kicker}>PREFERÊNCIAS</Text>}
      <Row
        icon="notifications-outline"
        title="Notificações"
        caption={leigo ? 'Campanhas e eventos' : 'Campanhas, eventos e comunicados'}
        onPress={onNotifications}
      />
      {leigo ? (
        <Row icon="document-text-outline" title="Termos de uso" caption={shown.termsWhen} onPress={() => onOpen('terms')} />
      ) : (
        <Row icon="shield-checkmark-outline" title="Privacidade e consentimento" caption={shown.tcleHub} onPress={() => onOpen('privacy')} />
      )}

      {leigo ? null : (
        <>
          <Text style={styles.kicker}>AJUDA</Text>
          <Row icon="book-outline" title="Glossário" caption="Termos como HLA, REDOME e TCTH" onPress={() => onOpen('glossary')} />
          <Row icon="help-circle-outline" title="Ajuda e suporte" onPress={() => onOpen('help')} />
          <Row icon="information-circle-outline" title="Sobre nós" onPress={() => onOpen('about')} />
          <Pressable accessibilityRole="button" onPress={onLogout} style={styles.logout}>
            <Ionicons name="log-out-outline" size={16} color={colors.danger600} />
            <Text style={styles.logoutText}>Sair da conta</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function AccountScreen({
  shown,
  draft,
  onCancel,
  onSave,
}: {
  shown: Shown;
  draft: RegistrationDraft;
  onCancel: () => void;
  onSave: (patch: Partial<RegistrationDraft>, events: HistoryEvent[], currentPassword: string) => void;
}) {
  const [name, setName] = useState(draft.name || (shown.demo ? shown.name : ''));
  const [email, setEmail] = useState(draft.email || (shown.demo ? 'mn@gmail.com' : ''));
  const [cpf, setCpf] = useState(draft.cpf);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [error, setError] = useState('');

  function save() {
    if (nextPassword && nextPassword.length < 8) {
      setError('A nova senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    if (nextPassword && draft.password && currentPassword !== draft.password) {
      setError('A senha atual não confere.');
      return;
    }
    const events: HistoryEvent[] = [];
    if (name.trim() !== draft.name && name.trim()) events.push(event('person', 'Nome atualizado', 'Dados da conta'));
    if (email.trim() !== draft.email && email.trim()) events.push(event('person', 'E-mail atualizado', 'Dados da conta'));
    if (cpf.trim() !== draft.cpf) events.push(event('person', 'CPF atualizado', 'Dados da conta'));
    if (nextPassword) events.push(event('shield', 'Senha alterada', 'Acesso à conta'));
    onSave(
      {
        name: name.trim(),
        email: email.trim(),
        cpf: cpf.trim(),
        ...(nextPassword ? { password: nextPassword } : {}),
      },
      events,
      currentPassword,
    );
  }

  return (
    <FormScreen title="Dados da conta" onCancel={onCancel} onSave={save}>
      <Field label="Nome" value={name} onChangeText={setName} autoCapitalize="words" />
      <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="CPF" value={cpf} onChangeText={setCpf} keyboardType="number-pad" placeholder="000.000.000-00" />
      <Field label="Senha atual" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry placeholder="Somente para trocar a senha" />
      <Field label="Nova senha" value={nextPassword} onChangeText={setNextPassword} secureTextEntry placeholder="Mínimo 8 caracteres" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Info text="Cada alteração fica registrada com data e hora no seu histórico." />
    </FormScreen>
  );
}

function ContactScreen({
  draft,
  onCancel,
  onSave,
}: {
  draft: RegistrationDraft;
  onCancel: () => void;
  onSave: (patch: Partial<RegistrationDraft>) => void;
}) {
  const [name, setName] = useState(draft.name);
  const [email, setEmail] = useState(draft.email);

  return (
    <FormScreen
      title="Contato"
      onCancel={onCancel}
      onSave={() => onSave({ name: name.trim(), email: email.trim() })}
    >
      <Text style={styles.pageSubtitle}>Opcional. Serve só para receber novidades. Este perfil não pede dados clínicos.</Text>
      <Field label="Nome" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Como devemos te chamar" />
      <Field label="E-mail" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="voce@email.com" />
    </FormScreen>
  );
}

function PhysicalScreen({
  initial,
  onChange,
  onCancel,
  onHistory,
  onSave,
}: {
  initial: PhysicalForm;
  onChange: (next: PhysicalForm) => void;
  onCancel: () => void;
  onHistory: () => void;
  onSave: (next: PhysicalForm, prev: PhysicalForm) => void;
}) {
  const [form, setForm] = useState(initial);
  function edit(patch: Partial<PhysicalForm>) {
    const next = { ...form, ...patch };
    setForm(next);
    onChange(next);
  }
  const { weight, height, sex, comorbidities } = form;
  const [picking, setPicking] = useState(false);
  const options = extraComorbidities(initial.comorbidities);

  function toggle(item: string) {
    const list = form.comorbidities;
    if (item === 'Nenhuma') {
      edit({ comorbidities: list.includes('Nenhuma') ? [] : ['Nenhuma'] });
      return;
    }
    const withoutNone = list.filter((entry) => entry !== 'Nenhuma');
    edit({
      comorbidities: withoutNone.includes(item) ? withoutNone.filter((entry) => entry !== item) : [...withoutNone, item],
    });
  }

  return (
    <View style={styles.fill}>
      <TopBar title="Dados físicos" onBack={onCancel} actionIcon="time-outline" actionLabel="Histórico de alterações" onAction={onHistory} />
      <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.metricRow}>
          <Metric label="Peso" value={weight} onChangeText={(value) => edit({ weight: value })} placeholder="kg" />
          <Metric label="Altura" value={height} onChangeText={(value) => edit({ height: value })} placeholder="m" />
        </View>
        <Text style={styles.fieldLabel}>Sexo biológico</Text>
        <Pressable accessibilityRole="button" onPress={() => setPicking(true)} style={styles.select}>
          <Text style={styles.selectText}>{sexLabel(sex)}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textTertiary} />
        </Pressable>
        <Text style={styles.fieldLabel}>Comorbidades</Text>
        <View style={styles.chips}>
          {options.map((item) => {
            const on = comorbidities.includes(item);
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => toggle(item)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
        <Info text="Cada alteração fica registrada com data e hora no seu histórico." />
      </ScrollView>
      <Footer onCancel={onCancel} onSave={() => onSave({ weight, height, sex, comorbidities }, initial)} />
      <OptionSheet
        visible={picking}
        title="Sexo biológico"
        options={SEX_OPTIONS}
        selected={sex}
        onSelect={(id) => {
          edit({ sex: id });
          setPicking(false);
        }}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

function LocationScreen({
  draft,
  shown,
  onCancel,
  onSave,
}: {
  draft: RegistrationDraft;
  shown: Shown;
  onCancel: () => void;
  onSave: (patch: Partial<RegistrationDraft>, events: HistoryEvent[]) => void;
}) {
  const [cep, setCep] = useState(draft.cep || (shown.demo ? shown.cep : ''));
  const [city, setCity] = useState(draft.city || (shown.demo ? shown.city : ''));
  const [uf, setUf] = useState(draft.uf || (shown.demo ? shown.uf : ''));
  const [address, setAddress] = useState(draft.address);
  const [allow, setAllow] = useState(draft.allowLocation);
  const [hint, setHint] = useState('');
  const [loading, setLoading] = useState(false);

  async function consultar() {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) {
      setHint('Informe um CEP com 8 dígitos.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await response.json()) as { erro?: boolean; logradouro?: string; localidade?: string; uf?: string };
      if (data.erro) {
        setHint('CEP não encontrado.');
        return;
      }
      setAddress(data.logradouro ?? '');
      setCity(data.localidade ?? '');
      setUf(data.uf ?? '');
      setHint('');
    } catch {
      setHint('Não foi possível consultar o CEP agora.');
    } finally {
      setLoading(false);
    }
  }

  function save() {
    const changed = cep !== draft.cep || city !== draft.city || uf !== draft.uf;
    onSave(
      { cep, city, uf, address, allowLocation: allow },
      changed ? [event('person', 'Localização atualizada', city && uf ? `${city}/${uf}` : 'CEP atualizado')] : [],
    );
  }

  return (
    <FormScreen title="Localização" onCancel={onCancel} onSave={save}>
      <Text style={styles.fieldLabel}>CEP</Text>
      <View style={styles.cepRow}>
        <TextInput
          value={cep}
          onChangeText={setCep}
          placeholder="00000-000"
          placeholderTextColor={colors.textTertiary}
          keyboardType="number-pad"
          style={[styles.input, styles.cepInput]}
        />
        <Pressable accessibilityRole="button" onPress={consultar} style={styles.cepBtn}>
          <Text style={styles.cepBtnText}>{loading ? '...' : 'Consultar'}</Text>
        </Pressable>
      </View>
      <Field label="Cidade" value={city} onChangeText={setCity} />
      <Field label="UF" value={uf} onChangeText={setUf} autoCapitalize="characters" maxLength={2} />
      {address ? <Field label="Endereço" value={address} onChangeText={setAddress} /> : null}
      {hint ? <Text style={styles.error}>{hint}</Text> : null}
      <View style={styles.switchRow}>
        <View style={styles.noticeCopy}>
          <Text style={styles.rowTitle}>Usar localização do aparelho</Text>
          <Text style={styles.rowCaption}>Para centros perto de você. Sem histórico de rotas.</Text>
        </View>
        <Switch
          accessibilityLabel="Usar localização do aparelho"
          value={allow}
          onValueChange={setAllow}
          trackColor={{ false: colors.borderSubtle, true: colors.primary600 }}
        />
      </View>
    </FormScreen>
  );
}

function PrivacyScreen({
  shown,
  exportNote,
  onBack,
  onReadTerm,
  onExport,
  onPermissions,
  onInactivate,
}: {
  shown: Shown;
  exportNote: string;
  onBack: () => void;
  onReadTerm: () => void;
  onExport: () => void;
  onPermissions: () => void;
  onInactivate: () => void;
}) {
  return (
    <View style={styles.fill}>
      <TopBar title="Privacidade" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.panel}>
          <View style={styles.termRow}>
            <View style={[styles.well, { backgroundColor: colors.primary100 }]}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary600} />
            </View>
            <View style={styles.noticeCopy}>
              <Text style={styles.rowTitle}>Termo de Consentimento (TCLE)</Text>
              <Text style={styles.rowCaption}>{shown.tcleDetail}</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={onReadTerm} style={styles.outlineBtn}>
            <Text style={styles.outlineBtnText}>Ler termo completo</Text>
          </Pressable>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Dados que coletamos</Text>
          {COLLECTED.map((item) => (
            <View key={item} style={styles.checkLine}>
              <Ionicons name="checkmark" size={16} color={colors.success600} />
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
          <Text style={styles.footnote}>Não coletamos prontuário, exames ou senha do Gov.br.</Text>
        </View>

        <Text style={styles.kicker}>SEUS DIREITOS (LGPD)</Text>
        <Row icon="download-outline" title="Baixar meus dados" caption="Receba uma cópia por e-mail" onPress={onExport} />
        {exportNote ? <Text style={styles.exportNote}>{exportNote}</Text> : null}
        <Row icon="phone-portrait-outline" title="Permissões do aparelho" caption="Localização e notificações" onPress={onPermissions} />
        <Pressable accessibilityRole="button" onPress={onInactivate} style={styles.dangerRow}>
          <View style={[styles.well, { backgroundColor: colors.danger100 }]}>
            <Ionicons name="trash-outline" size={18} color={colors.danger600} />
          </View>
          <View style={styles.noticeCopy}>
            <Text style={styles.dangerTitle}>Inativar minha conta</Text>
            <Text style={styles.rowCaption}>Seus dados pessoais serão anonimizados.</Text>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function PermissionsScreen({
  allowed,
  onToggle,
  onNotifications,
  onBack,
}: {
  allowed: boolean;
  onToggle: (value: boolean) => void;
  onNotifications: () => void;
  onBack: () => void;
}) {
  return (
    <View style={styles.fill}>
      <TopBar title="Permissões" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageSubtitle}>Você escolhe o que o aparelho pode compartilhar com o STEM.</Text>
        <View style={styles.panel}>
          <View style={styles.switchRow}>
            <View style={styles.noticeCopy}>
              <Text style={styles.rowTitle}>Localização</Text>
              <Text style={styles.rowCaption}>Centros e campanhas perto de você. Sem histórico de rotas.</Text>
            </View>
            <Switch
              accessibilityLabel="Localização"
              value={allowed}
              onValueChange={onToggle}
              trackColor={{ false: colors.borderSubtle, true: colors.primary600 }}
            />
          </View>
        </View>
        <Row icon="notifications-outline" title="Notificações" caption="Campanhas, eventos e comunicados" onPress={onNotifications} />
      </ScrollView>
    </View>
  );
}

function HistoryScreen({ events, onBack }: { events: HistoryEvent[]; onBack: () => void }) {
  return (
    <View style={styles.fill}>
      <TopBar title="Histórico" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Histórico de alterações</Text>
        <Text style={styles.pageSubtitle}>Registro das mudanças nos seus dados físicos e consentimentos.</Text>
        {events.map((item) => (
          <View key={item.id} style={styles.historyCard}>
            <View style={styles.well}>
              <Ionicons name={HISTORY_ICON[item.icon]} size={18} color={colors.primary600} />
            </View>
            <View style={styles.noticeCopy}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowCaption}>{item.detail}</Text>
              <Text style={styles.historyWhen}>{item.when}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function GlossaryScreen({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.fill}>
      <TopBar title="Glossário" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageSubtitle}>Termos como HLA, REDOME e TCTH, no mesmo sentido usado em Aprender.</Text>
        {GLOSSARY.map((item) => (
          <View key={item.term} style={styles.panel}>
            <Text style={styles.panelTitle}>{item.term}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function HelpScreen({ onBack, onCenters }: { onBack: () => void; onCenters: () => void }) {
  return (
    <View style={styles.fill}>
      <TopBar title="Ajuda e suporte" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Como o STEM ajuda</Text>
        <Text style={styles.body}>
          O app explica etapas, centros e conceitos. Não substitui o hemocentro nem a equipe médica, não agenda atendimento e não confirma compatibilidade.
        </Text>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Dúvida sobre cadastro ou doação</Text>
          <Text style={styles.body}>Procure o hemocentro mais próximo. A avaliação é feita pela equipe de lá.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onCenters} style={[styles.primaryBtn, styles.blockBtn]}>
          <Text style={styles.primaryBtnText}>Ver centros</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function AboutScreen({ onBack }: { onBack: () => void }) {
  return (
    <View style={[styles.fill, styles.aboutBg]}>
      <TopBar title="Sobre nós" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.aboutCard}>
          <View style={styles.mark}>
            <Ionicons name="bulb-outline" size={22} color="#C6A04A" />
            <Text style={styles.markCesmac}>CESMAC</Text>
            <Text style={styles.markCitec}>CITEC</Text>
          </View>
          <Text style={styles.aboutCredit}>
            Desenvolvido pela <Text style={styles.aboutGold}>CITEC</Text>
          </Text>
        </View>
        <Text style={styles.kicker}>EQUIPE</Text>
        {TEAM.map((person) => (
          <View key={person.name} style={styles.teamCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials(person.name)}</Text>
            </View>
            <View>
              <Text style={styles.rowTitle}>{person.name}</Text>
              <Text style={styles.rowCaption}>{person.role}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.aboutFooter}>CESMAC</Text>
        <Text style={styles.aboutFooterSub}>Centro Universitário</Text>
      </ScrollView>
    </View>
  );
}

function TermsScreen({
  accepted,
  when,
  onBack,
  onAccept,
}: {
  accepted: boolean;
  when: string;
  onBack: () => void;
  onAccept: () => void;
}) {
  return (
    <View style={styles.fill}>
      <TopBar title="Termos de uso" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Termos de uso</Text>
          <Text style={styles.rowCaption}>{accepted ? when : 'Aceite pendente'}</Text>
          <Text style={styles.body}>
            O perfil leigo usa o STEM para aprender. Não coletamos dados clínicos. Um e-mail é opcional, só para novidades. O app não agenda atendimento e não confirma compatibilidade.
          </Text>
        </View>
        {accepted ? null : (
          <Pressable accessibilityRole="button" onPress={onAccept} style={[styles.primaryBtn, styles.blockBtn]}>
            <Text style={styles.primaryBtnText}>Li e aceito os termos</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function ConfirmSheet({
  visible,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = useState('');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.sheetBackdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onCancel} style={styles.sheetDismiss} />
        <View style={styles.sheet}>
          <View style={styles.warnBadge}>
            <Ionicons name="warning-outline" size={22} color={colors.danger600} />
          </View>
          <Text style={styles.sheetTitle}>Inativar sua conta?</Text>
          <Text style={styles.sheetBody}>
            Seu perfil ficará inativo e seus dados pessoais serão anonimizados. Registros anonimizados são mantidos apenas para histórico, conforme a LGPD.
          </Text>
          <Field label="Confirme com sua senha" value={password} onChangeText={setPassword} secureTextEntry />
          <Pressable accessibilityRole="button" onPress={() => onConfirm(password)} style={styles.dangerBtn}>
            <Text style={styles.primaryBtnText}>Sim, inativar conta</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onCancel} style={styles.outlineBtn}>
            <Text style={styles.outlineBtnText}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function TopBar({
  title,
  onBack,
  actionIcon,
  actionLabel,
  onAction,
}: {
  title: string;
  onBack: () => void;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} hitSlop={8} style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={22} color={colors.ink} />
      </Pressable>
      <Text style={styles.topTitle}>{title}</Text>
      {actionIcon && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} hitSlop={8} style={styles.iconBtn}>
          <Ionicons name={actionIcon} size={20} color={colors.ink} />
        </Pressable>
      ) : (
        <View style={styles.iconBtn} />
      )}
    </View>
  );
}

function Row({
  icon,
  title,
  caption,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  caption?: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <View style={styles.well}>
        <Ionicons name={icon} size={18} color={colors.textSecondary} />
      </View>
      <View style={styles.noticeCopy}>
        <Text style={styles.rowTitle}>{title}</Text>
        {caption ? <Text style={styles.rowCaption}>{caption}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

function Field({
  label,
  ...rest
}: {
  label: string;
} & ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={colors.textTertiary} style={styles.input} {...rest} />
    </View>
  );
}

function Metric({ label, value, onChangeText, placeholder }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={styles.input}
      />
    </View>
  );
}

function Info({ text }: { text: string }) {
  return (
    <View style={styles.info}>
      <Ionicons name="information-circle-outline" size={16} color={colors.primary600} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

function Footer({ onCancel, onSave, saveLabel = 'Salvar' }: { onCancel: () => void; onSave: () => void; saveLabel?: string }) {
  return (
    <View style={styles.footer}>
      <Pressable accessibilityRole="button" onPress={onCancel} style={[styles.outlineBtn, styles.footerCancel]}>
        <Text style={styles.outlineBtnText}>Cancelar</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onSave} style={[styles.primaryBtn, styles.footerSave]}>
        <Text style={styles.primaryBtnText}>{saveLabel}</Text>
      </Pressable>
    </View>
  );
}

function FormScreen({
  title,
  onCancel,
  onSave,
  saveLabel,
  children,
}: {
  title: string;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.fill}>
      <TopBar title={title} onBack={onCancel} />
      <ScrollView contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      <Footer onCancel={onCancel} onSave={onSave} saveLabel={saveLabel} />
    </View>
  );
}

function OptionSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { id: Sexo; label: string }[];
  selected: Sexo;
  onSelect: (id: Sexo) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fechar" onPress={onClose} style={styles.sheetDismiss} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{title}</Text>
          {options.map((option) => {
            const on = option.id === selected;
            return (
              <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onSelect(option.id)} style={styles.optionRow}>
                <Text style={[styles.rowTitle, on && styles.optionOn]}>{option.label}</Text>
                {on ? <Ionicons name="checkmark" size={18} color={colors.primary600} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

type Shown = {
  demo: boolean;
  name: string;
  email: string;
  emailMasked: string;
  initials: string;
  role: string;
  weight: string;
  height: string;
  sex: Sexo;
  comorbidities: string[];
  cep: string;
  city: string;
  uf: string;
  locationLine: string;
  tcleHub: string;
  tcleDetail: string;
  termsWhen: string;
};

function present(draft: RegistrationDraft, profile: ProfileType, acceptedAt: string | null): Shown {
  const demo = !acceptedAt && !draft.name && !draft.email && !draft.weight && !draft.cep && !draft.cpf;
  const accepted = acceptedAt ? new Date(acceptedAt) : null;
  const acceptedDay = accepted ? accepted.toLocaleDateString('pt-BR') : '';
  const acceptedTime = accepted ? accepted.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  const leigo = profile === 'leigo';
  const sex: Sexo = draft.sex || (demo && !leigo ? 'feminino' : '');
  const name = leigo ? draft.name || 'Visitante' : draft.name || 'Maria Silva';
  const email = draft.email || (demo && !leigo ? 'mn@gmail.com' : '');
  const city = draft.city || (demo && !leigo ? 'Maceió' : '');
  const uf = draft.uf || (demo && !leigo ? 'AL' : '');
  const cep = draft.cep || (demo && !leigo ? '57035-230' : '');
  const place = city && uf ? `${city}/${uf}` : city || uf;
  return {
    demo,
    name,
    email,
    emailMasked: email ? maskEmail(email) : '',
    initials: leigo && !draft.name ? 'V' : initials(name),
    role: roleLabel(profile, sex),
    weight: draft.weight || (demo && !leigo ? '68' : ''),
    height: draft.height || (demo && !leigo ? '1,65' : ''),
    sex,
    comorbidities: draft.comorbidities.length ? draft.comorbidities : demo && !leigo ? ['Hipertensão'] : [],
    cep,
    city,
    uf,
    locationLine: cep || place ? `CEP ${formatCep(cep) || '—'} · ${place || '—'}` : 'Informe seu CEP',
    tcleHub: accepted
      ? `TCLE v${draft.tcleVersion} aceito em ${acceptedDay}`
      : draft.tcleAccepted || (demo && !leigo)
        ? 'TCLE v1.0 aceito em 17/10/2026'
        : 'TCLE pendente',
    tcleDetail: accepted
      ? `Versão ${draft.tcleVersion} · aceito em ${acceptedDay} às ${acceptedTime}`
      : draft.tcleAccepted || (demo && !leigo)
        ? 'Versão 1.0 · aceito em 01/10/2026 às 21:15'
        : 'Versão 1.0 · aceite pendente',
    termsWhen: accepted ? `Aceito em ${acceptedDay}` : draft.tcleAccepted || demo ? 'Aceito em 17/10/2026' : 'Aceite pendente',
  };
}

function roleLabel(profile: ProfileType, sex: Sexo) {
  if (profile === 'leigo') return 'Público leigo';
  if (profile === 'receptor') return sex === 'masculino' ? 'Receptor' : 'Receptora';
  return sex === 'masculino' ? 'Doador' : 'Doadora';
}

function sexLabel(sex: Sexo) {
  return SEX_OPTIONS.find((option) => option.id === sex)?.label ?? 'Selecionar';
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '•';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

function maskEmail(value: string) {
  const [name, domain] = value.split('@');
  if (!name || !domain) return value;
  return `${name.slice(0, 1)}***@${domain}`;
}

function formatCep(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 8) return value;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function stripUnit(value: string) {
  return value.replace(/\s*(kg|m)$/i, '').trim();
}

function extraComorbidities(selected: string[]) {
  const extra = selected.filter((item) => !PROFILE_COMORBIDITIES.includes(item));
  return [...PROFILE_COMORBIDITIES, ...extra];
}

function stamp(date = new Date()) {
  const day = date.toLocaleDateString('pt-BR');
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

function event(icon: HistoryIcon, title: string, detail: string): HistoryEvent {
  return { id: `${Date.now()}-${title}`, icon, title, detail, when: stamp() };
}

function diffPhysical(prev: PhysicalForm, next: PhysicalForm) {
  const events: HistoryEvent[] = [];
  const prevWeight = stripUnit(prev.weight);
  const nextWeight = stripUnit(next.weight);
  const prevHeight = stripUnit(prev.height);
  const nextHeight = stripUnit(next.height);
  if (prevWeight !== nextWeight && nextWeight) {
    events.push(event('pulse', 'Peso alterado', prevWeight ? `${prevWeight} kg → ${nextWeight} kg` : `${nextWeight} kg`));
  }
  if (prevHeight !== nextHeight && nextHeight) {
    events.push(event('pulse', 'Altura alterada', prevHeight ? `${prevHeight} m → ${nextHeight} m` : `${nextHeight} m`));
  }
  if (prev.sex !== next.sex && next.sex) {
    events.push(event('pulse', 'Sexo biológico alterado', sexLabel(next.sex)));
  }
  next.comorbidities
    .filter((item) => item !== 'Nenhuma' && !prev.comorbidities.includes(item))
    .forEach((item) => events.push(event('pulse', 'Comorbidade adicionada', item)));
  prev.comorbidities
    .filter((item) => item !== 'Nenhuma' && !next.comorbidities.includes(item))
    .forEach((item) => events.push(event('pulse', 'Comorbidade removida', item)));
  return events;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
  formContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 48 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16, lineHeight: 24, fontWeight: '600', color: colors.ink },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primary100, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: colors.primary600 },
  identityCopy: { flex: 1, gap: 2 },
  identityName: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: colors.ink },
  identityEmail: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  identityRole: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.primary600 },
  kicker: { marginTop: 16, marginBottom: 8, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.6, color: colors.textTertiary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  well: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  noticeCopy: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.ink },
  rowCaption: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, minHeight: 40 },
  logoutText: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.danger600 },
  upgrade: { backgroundColor: colors.primary600, borderRadius: 16, padding: 16, gap: 8 },
  upgradeKicker: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.6, color: '#D6E6FA' },
  upgradeTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: '#fff' },
  upgradeBody: { fontSize: 14, lineHeight: 20, color: '#E7F0FC' },
  upgradeBtn: { alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, marginTop: 4 },
  upgradeBtnText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.primary600 },
  pageTitle: { fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.ink },
  pageSubtitle: { marginTop: 4, marginBottom: 8, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  panel: { marginTop: 12, borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 16, padding: 14, gap: 10 },
  panelTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  termRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink },
  footnote: { fontSize: 12, lineHeight: 16, color: colors.textTertiary },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.danger100,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 8,
  },
  dangerTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.danger600 },
  exportNote: { marginTop: -2, marginBottom: 8, fontSize: 13, lineHeight: 18, color: colors.primary600 },
  historyCard: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
  },
  historyWhen: { fontSize: 12, lineHeight: 16, color: colors.textTertiary },
  field: { gap: 6 },
  fieldLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.ink },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  metricRow: { flexDirection: 'row', gap: 12 },
  metric: { flex: 1, gap: 6 },
  select: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: { fontSize: 15, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.bg },
  chipOn: { backgroundColor: colors.primary600, borderColor: colors.primary600 },
  chipText: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: colors.textSecondary },
  chipTextOn: { color: '#fff' },
  info: { flexDirection: 'row', gap: 8, backgroundColor: colors.primary50, borderRadius: 12, padding: 12, alignItems: 'flex-start' },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.primary600 },
  error: { fontSize: 13, lineHeight: 18, color: colors.danger600 },
  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  footerCancel: { flex: 0.8 },
  footerSave: { flex: 1.2 },
  outlineBtn: { minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.borderSubtle, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  outlineBtnText: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: colors.ink },
  primaryBtn: { minHeight: 48, borderRadius: 24, backgroundColor: colors.primary600, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  blockBtn: { marginTop: 16 },
  primaryBtnText: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: '#fff' },
  cepRow: { flexDirection: 'row', gap: 8 },
  cepInput: { flex: 1 },
  cepBtn: { minHeight: 48, paddingHorizontal: 14, borderRadius: 14, backgroundColor: colors.primary100, alignItems: 'center', justifyContent: 'center' },
  cepBtnText: { fontSize: 14, fontWeight: '600', color: colors.primary600 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aboutBg: { backgroundColor: colors.primary50 },
  aboutCard: { backgroundColor: colors.bg, borderRadius: 16, padding: 20, alignItems: 'center', gap: 12 },
  mark: { alignItems: 'center', gap: 2 },
  markCesmac: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: colors.primary900, letterSpacing: 1 },
  markCitec: { fontSize: 14, lineHeight: 18, fontWeight: '800', color: '#C6A04A', letterSpacing: 2 },
  aboutCredit: { fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  aboutGold: { color: '#C6A04A', fontWeight: '700' },
  teamCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.bg, borderRadius: 16, padding: 12, marginBottom: 8 },
  aboutFooter: { marginTop: 20, textAlign: 'center', fontSize: 16, fontWeight: '800', color: colors.primary900, letterSpacing: 1 },
  aboutFooterSub: { textAlign: 'center', fontSize: 12, color: colors.textSecondary },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(28, 36, 51, 0.45)', justifyContent: 'flex-end' },
  sheetDismiss: { flex: 1 },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 28, gap: 12 },
  warnBadge: { alignSelf: 'center', width: 48, height: 48, borderRadius: 24, backgroundColor: colors.danger100, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { textAlign: 'center', fontSize: 18, lineHeight: 24, fontWeight: '700', color: colors.ink },
  sheetBody: { textAlign: 'center', fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  dangerBtn: { minHeight: 48, borderRadius: 24, backgroundColor: colors.danger600, alignItems: 'center', justifyContent: 'center' },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  optionOn: { color: colors.primary600 },
});
