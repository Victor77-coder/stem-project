import { StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NoticeChoices as Choices } from '@/context/RegistrationContext';
import { pushAvailable } from '@/lib/push';
import { colors } from '@/theme';

type Ion = keyof typeof Ionicons.glyphMap;

type Props = {
  value: Choices;
  onChange: (value: Choices) => void;
  /** E-mail do cadastro. Sem ele, o canal e-mail fica indisponível. */
  email: string;
  /** Convidado sem contato não cria conta, então não há para onde enviar. */
  disabled?: boolean;
};

const TOPICS: { key: 'campaigns' | 'events' | 'official'; icon: Ion; title: string; caption?: string }[] = [
  { key: 'campaigns', icon: 'megaphone-outline', title: 'Campanhas de doação', caption: 'Perto de você' },
  { key: 'events', icon: 'calendar-outline', title: 'Eventos de saúde' },
  { key: 'official', icon: 'document-text-outline', title: 'Comunicados oficiais', caption: 'Ministério da Saúde, INCA, Hemocentros' },
];

export function NoticeChoices({ value, onChange, email, disabled }: Props) {
  const set = (patch: Partial<Choices>) => onChange({ ...value, ...patch });
  const anyTopic = value.campaigns || value.events || value.official;
  const anyChannel = value.push || value.email;
  const hasEmail = email.trim().includes('@');

  return (
    <View style={styles.wrap}>
      <View style={styles.panel}>
        <Text style={styles.kicker}>ASSUNTOS</Text>
        {TOPICS.map((topic) => (
          <Row
            key={topic.key}
            icon={topic.icon}
            title={topic.title}
            caption={topic.caption}
            value={value[topic.key]}
            disabled={disabled}
            onChange={(on) => set({ [topic.key]: on })}
          />
        ))}
      </View>

      <View style={styles.panel}>
        <Text style={styles.kicker}>COMO AVISAR</Text>
        <Row
          icon="phone-portrait-outline"
          title="Notificações no celular"
          caption={pushAvailable ? 'O celular vai pedir sua permissão' : 'Disponível no aplicativo instalado'}
          value={value.push}
          disabled={disabled || !pushAvailable}
          onChange={(push) => set({ push })}
        />
        <Row
          icon="mail-outline"
          title="E-mail"
          caption={hasEmail ? `Enviaremos um código para ${email.trim()}` : 'Informe um e-mail no cadastro para ativar'}
          value={value.email && hasEmail}
          disabled={disabled || !hasEmail}
          onChange={(on) => set({ email: on })}
        />
      </View>

      {anyChannel && !anyTopic ? <Text style={styles.warn}>Escolha ao menos um assunto para receber avisos.</Text> : null}
      <Text style={styles.caption}>
        Os avisos dos assuntos escolhidos aparecem na caixa de entrada do aplicativo. Push e e-mail chegam das 8h às 21h.
        Você pode mudar tudo em Perfil › Notificações.
      </Text>
    </View>
  );
}

function Row({
  icon,
  title,
  caption,
  value,
  disabled,
  onChange,
}: {
  icon: Ion;
  title: string;
  caption?: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={disabled ? colors.textTertiary : colors.textSecondary} />
      <View style={styles.copy}>
        <Text style={[styles.title, disabled && styles.off]}>{title}</Text>
        {caption ? <Text style={styles.meta}>{caption}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.borderSubtle, true: colors.primary600 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  panel: { borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: 16, padding: 14, gap: 12 },
  kicker: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.4, color: colors.textTertiary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  copy: { flex: 1 },
  title: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: colors.ink },
  off: { color: colors.textTertiary },
  meta: { marginTop: 2, fontSize: 12, lineHeight: 16, color: colors.textTertiary },
  warn: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.warning700 },
  caption: { fontSize: 12, lineHeight: 16, color: colors.muted },
});
