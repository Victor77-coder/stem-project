import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  KINDS_FOR,
  KIND_LABEL,
  ORIGINS,
  RADIUS_KM,
  centerById,
  filterOf,
  filtersFor,
  listCenters,
  originFromQuery,
  type CenterFilter,
  type CenterKind,
  type CenterResult,
  type Origin,
} from '@/content/centers';
import type { ProfileType } from '@/context/RegistrationContext';
import { api } from '@/lib/api';
import { hasLocationPermission, originFromCep, originFromCityName, requestDeviceOrigin } from '@/lib/location';
import { colors } from '@/theme';
import { CentersMap } from './CentersMap';
import { iconColor, kindIcon, wellColor } from './kind';

type Screen = 'permission' | 'map' | 'list' | 'detail';

type ApiCenter = Omit<CenterResult, 'cnes' | 'hours' | 'phone' | 'eventWhen' | 'km' | 'distance'> & {
  cnes: string | null;
  hours: string | null;
  phone: string | null;
  eventWhen: string | null;
  km: number | null;
  distance: string | null;
};

function fromApi(item: ApiCenter): CenterResult {
  return {
    ...item,
    cnes: item.cnes ?? undefined,
    hours: item.hours ?? undefined,
    phone: item.phone ?? undefined,
    eventWhen: item.eventWhen ?? undefined,
    km: item.km ?? 0,
    distance: item.distance ?? '',
  };
}

type FilterOption = { id: CenterFilter; label: string };

type Props = {
  initialFilter?: CenterFilter;
  profile: ProfileType;
  savedCity?: string;
  savedUf?: string;
  savedCep?: string;
  allowed?: boolean;
  onAllowLocation?: () => void;
};

export function CentersFlow({
  initialFilter = 'todos',
  profile,
  savedCity = '',
  savedUf = '',
  savedCep = '',
  allowed = false,
  onAllowLocation,
}: Props) {
  const [screen, setScreen] = useState<Screen>(allowed ? 'map' : 'permission');
  const [cepMode, setCepMode] = useState(false);
  const [cep, setCep] = useState(savedCep);
  const [hint, setHint] = useState('');
  const [locating, setLocating] = useState(false);
  const [blocked, setBlocked] = useState(false);
  // Até o endereço do cadastro ser localizado (efeito abaixo), só Maceió e Recife têm origem embarcada.
  const [origin, setOrigin] = useState<Origin>(() => originFromQuery(savedCity) ?? { ...ORIGINS.maceio, mode: 'cep' });
  const queryRun = useRef(0);
  // CEP ou cidade não encontrados. A cidade só vira aviso se o texto também não achou unidade pelo nome: no Enter
  // a lista ainda é a da busca anterior, então a decisão fica para a hora de desenhar, com os resultados atuais.
  const [searchMiss, setSearchMiss] = useState<{ message: string; city: boolean } | null>(null);
  const kinds = KINDS_FOR[profile];
  const filters = useMemo(() => filtersFor(profile), [profile]);
  const [filter, setFilter] = useState<CenterFilter>(() => filterOf(profile, initialFilter));
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [browse, setBrowse] = useState<'map' | 'list'>('map');

  useEffect(() => {
    setFilter(filterOf(profile, initialFilter));
  }, [initialFilter, profile]);

  const nameQuery = query.replace(/\D/g, '').length === 8 ? '' : query;
  const local = useMemo(() => listCenters(origin, filter, nameQuery, kinds), [origin, filter, nameQuery, kinds]);
  const [remote, setRemote] = useState<{ results: CenterResult[]; outsideRadius: boolean } | null>(null);
  const [offline, setOffline] = useState(false);
  const results = remote?.results ?? local;
  const searchHint = searchMiss && (!searchMiss.city || results.length === 0) ? searchMiss.message : '';
  // Nada no raio (ex.: centro de transplante em Alagoas): a API manda os mais próximos fora dele.
  const outsideRadius = remote?.outsideRadius ?? false;
  const selected = selectedId ? (results.find((item) => item.id === selectedId) ?? centerById(selectedId, origin)) : undefined;

  useEffect(() => {
    const params = new URLSearchParams({
      lat: String(origin.lat),
      lng: String(origin.lng),
      raio: String(RADIUS_KM),
      perfil: profile,
    });
    if (filter !== 'todos') params.set('kind', filter);
    if (nameQuery.trim()) params.set('q', nameQuery.trim());
    let active = true;
    api<{ results: ApiCenter[]; outsideRadius?: boolean }>(`/centros/?${params}`)
      .then((data) => {
        if (!active) return;
        setRemote({ results: data.results.map(fromApi), outsideRadius: Boolean(data.outsideRadius) });
        setOffline(false);
      })
      .catch(() => {
        if (!active) return;
        setRemote(null);
        setOffline(true);
      });
    return () => {
      active = false;
    };
  }, [origin, filter, nameQuery, profile]);

  // Origem pelo endereço do cadastro, em qualquer UF. Não passa por cima do GPS nem de uma busca já feita.
  useEffect(() => {
    const cepDigits = savedCep.replace(/\D/g, '');
    const saved = cepDigits.length === 8 ? originFromCep(cepDigits) : savedCity ? originFromCityName(savedCity, savedUf) : null;
    if (!saved) return;
    const run = queryRun.current;
    let active = true;
    void saved.then((result) => {
      if (!active || !result.ok || run !== queryRun.current) return;
      setOrigin((current) => (current.mode === 'gps' ? current : result.origin));
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onQuery(value: string) {
    setQuery(value);
    setSearchMiss(null);
    const digits = value.replace(/\D/g, '');
    const run = ++queryRun.current;
    if (digits.length === 8) {
      void originFromCep(digits).then((result) => {
        if (run !== queryRun.current) return;
        if (result.ok) setOrigin(result.origin);
        else setSearchMiss({ message: result.message, city: false });
      });
    }
  }

  /** Enter na busca: texto que não é CEP vira cidade (qualquer UF). Se for nome de unidade, segue como filtro. */
  function onSearch() {
    const value = query.trim();
    if (value.replace(/\D/g, '').length === 8 || value.length < 3) return;
    const run = ++queryRun.current;
    void originFromCityName(value).then((result) => {
      if (run !== queryRun.current) return;
      if (!result.ok) {
        setSearchMiss({ message: result.message, city: true });
        return;
      }
      setOrigin(result.origin);
      setQuery('');
      setSearchMiss(null);
    });
  }

  function openMap(next: Origin) {
    setOrigin(next);
    setBrowse('map');
    setScreen('map');
  }

  const locate = useCallback(async () => {
    setLocating(true);
    const result = await requestDeviceOrigin();
    setLocating(false);
    if (result.ok) {
      setBlocked(false);
      setHint('');
      if (!allowed) onAllowLocation?.();
      setOrigin(result.origin);
      setBrowse('map');
      setScreen('map');
      return;
    }
    setScreen('permission');
    setCepMode(true);
    if (result.reason === 'denied') {
      setBlocked(!result.canAskAgain);
      setHint('Sem permissão de localização. Informe o CEP ou a cidade.');
    } else {
      setHint('Não foi possível obter sua localização agora. Informe o CEP ou a cidade.');
    }
  }, [allowed, onAllowLocation]);

  useEffect(() => {
    if (!allowed) return;
    // RF009: a posição é renovada a cada visita à aba, sem pedir permissão de novo se já houver.
    void hasLocationPermission()
      .catch(() => false)
      .then((granted) => {
        if (granted) void locate();
        else setScreen('permission');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!blocked) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void hasLocationPermission().then((granted) => granted && void locate());
    });
    return () => subscription.remove();
  }, [blocked, locate]);

  async function submitCep() {
    const value = cep.trim();
    if (value.replace(/\D/g, '').length !== 8 && value.length < 3) {
      setHint('Informe um CEP com 8 dígitos ou o nome da cidade.');
      return;
    }
    setLocating(true);
    const result = await originFromCep(value);
    setLocating(false);
    if (!result.ok) {
      setHint(result.message);
      return;
    }
    setHint('');
    openMap(result.origin);
  }

  function openDetail(id: string) {
    setSelectedId(id);
    setScreen('detail');
  }

  if (screen === 'permission') {
    return (
      <PermissionScreen
        cepMode={cepMode}
        cep={cep}
        hint={hint}
        locating={locating}
        blocked={blocked && Platform.OS !== 'web'}
        onCep={setCep}
        onAllow={() => void locate()}
        onAskCep={() => setCepMode(true)}
        onSubmitCep={() => void submitCep()}
        onOpenSettings={() => void Linking.openSettings()}
      />
    );
  }

  if (screen === 'detail' && selected) {
    return (
      <DetailScreen
        center={selected}
        origin={origin}
        nearby={results}
        onBack={() => setScreen(browse)}
        onOpen={openDetail}
      />
    );
  }

  if (screen === 'list') {
    return (
      <ListScreen
        origin={origin}
        filter={filter}
        filters={filters}
        query={query}
        results={results}
        outsideRadius={outsideRadius}
        offline={offline}
        onFilter={setFilter}
        onQuery={onQuery}
        onSearch={onSearch}
        searchHint={searchHint}
        onOpen={openDetail}
        onMap={() => {
          setBrowse('map');
          setScreen('map');
        }}
      />
    );
  }

  return (
    <MapScreen
      origin={origin}
      filter={filter}
      filters={filters}
      query={query}
      results={results}
      outsideRadius={outsideRadius}
      offline={offline}
      onFilter={setFilter}
      onQuery={onQuery}
      onSearch={onSearch}
      searchHint={searchHint}
      onOpen={openDetail}
      onList={() => {
        setBrowse('list');
        setScreen('list');
      }}
    />
  );
}

function LocateMark({ size = 36, color = colors.teal600 }: { size?: number; color?: string }) {
  const dot = Math.max(8, Math.round(size * 0.28));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="locate-outline" size={size} color={color} />
      <View
        style={{
          position: 'absolute',
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

function PermissionScreen({
  cepMode,
  cep,
  hint,
  locating,
  blocked,
  onCep,
  onAllow,
  onAskCep,
  onSubmitCep,
  onOpenSettings,
}: {
  cepMode: boolean;
  cep: string;
  hint: string;
  locating: boolean;
  blocked: boolean;
  onCep: (value: string) => void;
  onAllow: () => void;
  onAskCep: () => void;
  onSubmitCep: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <View style={styles.fill}>
      <ScrollView contentContainerStyle={styles.permissionBody} showsVerticalScrollIndicator={false}>
        <View style={styles.targetWell}>
          <LocateMark size={36} />
        </View>
        <Text style={styles.permissionTitle}>Encontre centros perto de você</Text>
        <Text style={styles.permissionBodyText}>
          Usamos sua localização apenas para mostrar hemocentros, centros transplantadores e campanhas próximas.
        </Text>
        <View style={styles.checks}>
          <CheckRow text="Não guardamos histórico de rotas" />
          <CheckRow text="Você pode informar só o CEP" />
          <CheckRow text="Pode desativar a qualquer momento" />
        </View>
        {cepMode ? (
          <View style={styles.cepBlock}>
            <Text style={styles.cepLabel}>CEP ou cidade</Text>
            <TextInput
              placeholder="57010-000 ou Maceió"
              placeholderTextColor={colors.textTertiary}
              keyboardType="default"
              value={cep}
              onChangeText={onCep}
              style={styles.cepInput}
            />
            {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.permissionFooter}>
        {cepMode ? (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={locating}
              onPress={onSubmitCep}
              style={[styles.primary, locating && styles.busy]}
            >
              <Text style={styles.primaryText}>{locating ? 'Buscando…' : 'Ver centros próximos'}</Text>
            </Pressable>
            {blocked ? (
              <Pressable accessibilityRole="button" onPress={onOpenSettings} style={styles.ghost}>
                <Text style={styles.ghostText}>Ativar localização nos ajustes</Text>
              </Pressable>
            ) : (
              <Pressable accessibilityRole="button" disabled={locating} onPress={onAllow} style={styles.ghost}>
                <Text style={styles.ghostText}>Usar minha localização</Text>
              </Pressable>
            )}
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              disabled={locating}
              onPress={onAllow}
              style={[styles.primary, locating && styles.busy]}
            >
              <Text style={styles.primaryText}>{locating ? 'Localizando…' : 'Permitir localização'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onAskCep} style={styles.ghost}>
              <Text style={styles.ghostText}>Informar só o CEP</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function CheckRow({ text }: { text: string }) {
  return (
    <View style={styles.checkRow}>
      <Ionicons name="checkmark" size={16} color={colors.teal600} />
      <Text style={styles.checkText}>{text}</Text>
    </View>
  );
}

function OfflineNotice() {
  return (
    <View style={styles.offline} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warning700} />
      <Text style={styles.offlineText}>
        Sem conexão com o servidor. Mostrando só os centros salvos no app, que podem não estar perto de você.
      </Text>
    </View>
  );
}

function OutsideRadiusNotice() {
  return (
    <View style={styles.outside}>
      <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
      <Text style={styles.outsideText}>
        Nenhuma unidade num raio de {RADIUS_KM} km. Mostrando as mais próximas, com a distância de cada uma.
      </Text>
    </View>
  );
}

function MapScreen({
  origin,
  filter,
  filters,
  query,
  results,
  outsideRadius,
  offline,
  onFilter,
  onQuery,
  onSearch,
  searchHint,
  onOpen,
  onList,
}: {
  origin: Origin;
  filter: CenterFilter;
  filters: FilterOption[];
  query: string;
  results: CenterResult[];
  outsideRadius: boolean;
  offline: boolean;
  onFilter: (value: CenterFilter) => void;
  onQuery: (value: string) => void;
  onSearch: () => void;
  searchHint: string;
  onOpen: (id: string) => void;
  onList: () => void;
}) {
  return (
    <View style={styles.fill}>
      <CentersMap origin={origin} results={results} onOpen={onOpen} />
      <View style={styles.searchFloat}>
        <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
        <TextInput
          placeholder="Buscar por CEP ou cidade"
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={onQuery}
          onSubmitEditing={onSearch}
          returnKeyType="search"
          style={styles.searchInput}
        />
      </View>
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {searchHint ? <Text style={[styles.hint, styles.searchHint]}>{searchHint}</Text> : null}
        {offline ? <OfflineNotice /> : null}
        {outsideRadius ? <OutsideRadiusNotice /> : null}
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>
            {outsideRadius ? 'Mais próximas' : 'Perto de você'} · {results.length} {results.length === 1 ? 'unidade' : 'unidades'}
          </Text>
          <Pressable accessibilityRole="button" onPress={onList}>
            <Text style={styles.link}>Ver lista</Text>
          </Pressable>
        </View>
        <FilterRow options={filters} value={filter} onChange={onFilter} />
        <ScrollView style={styles.sheetList} showsVerticalScrollIndicator={false}>
          {results.slice(0, 4).map((center) => (
            <CenterRow key={center.id} center={center} onPress={() => onOpen(center.id)} />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function ListScreen({
  origin,
  filter,
  filters,
  query,
  results,
  outsideRadius,
  offline,
  onFilter,
  onQuery,
  onSearch,
  searchHint,
  onOpen,
  onMap,
}: {
  origin: Origin;
  filter: CenterFilter;
  filters: FilterOption[];
  query: string;
  results: CenterResult[];
  outsideRadius: boolean;
  offline: boolean;
  onFilter: (value: CenterFilter) => void;
  onQuery: (value: string) => void;
  onSearch: () => void;
  searchHint: string;
  onOpen: (id: string) => void;
  onMap: () => void;
}) {
  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <View style={styles.iconBtn} />
        <Text style={styles.topTitle}>Centros</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Ver mapa" onPress={onMap} style={styles.iconBtn}>
          <Ionicons name="map-outline" size={22} color={colors.ink} />
        </Pressable>
      </View>
      <Text style={styles.pageSubtitle}>
        {origin.label} · {outsideRadius ? 'mais próximas, fora do raio de' : 'raio de'} {RADIUS_KM} km
      </Text>
      <View style={[styles.searchFloat, styles.searchInList]}>
        <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
        <TextInput
          placeholder="Buscar por CEP ou cidade"
          placeholderTextColor={colors.textTertiary}
          value={query}
          onChangeText={onQuery}
          onSubmitEditing={onSearch}
          returnKeyType="search"
          style={styles.searchInput}
        />
      </View>
      {searchHint ? <Text style={[styles.hint, styles.searchHint]}>{searchHint}</Text> : null}
      {offline ? <OfflineNotice /> : null}
      {outsideRadius ? <OutsideRadiusNotice /> : null}
      <FilterRow options={filters} value={filter} onChange={onFilter} />
      {results.length === 0 ? (
        <Text style={styles.empty}>Nenhuma unidade neste raio para o filtro escolhido.</Text>
      ) : (
        results.map((center) => <CenterRow key={center.id} center={center} onPress={() => onOpen(center.id)} />)
      )}
      {results.length ? <Text style={styles.source}>{sourceLine(results)}</Text> : null}
    </ScrollView>
  );
}

const sortable = (date: string) => date.split('/').reverse().join('');

/** RF08: fonte e data vêm das unidades listadas (a carga do CNES é mensal), não de uma data fixa no código. */
function sourceLine(centers: { source: string; sourceDate: string }[]) {
  const sources = [...new Set(centers.map((center) => center.source).filter(Boolean))];
  const newest = centers
    .map((center) => center.sourceDate)
    .filter(Boolean)
    .reduce((best, date) => (sortable(date) > sortable(best) ? date : best), '');
  const label = sources.length > 1 ? 'Fontes' : 'Fonte';
  return `${label}: ${sources.join(', ') || 'CNES/DataSUS'}${newest ? ` · dados de até ${newest}` : ''}`;
}

function DetailScreen({
  center,
  origin,
  nearby,
  onBack,
  onOpen,
}: {
  center: CenterResult;
  origin: Origin;
  nearby: CenterResult[];
  onBack: () => void;
  onOpen: (id: string) => void;
}) {
  const maps = `https://www.google.com/maps/search/?api=1&query=${center.lat},${center.lng}`;
  const phone = center.phone ? `tel:${center.phone.replace(/\D/g, '')}` : null;
  const pins = nearby.some((item) => item.id === center.id) ? nearby : [center, ...nearby];
  const meta = [center.cnes ? `CNES ${center.cnes}` : null, `a ${center.distance} de você`].filter(Boolean).join(' · ');

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <CentersMap origin={origin} results={pins} onOpen={onOpen} height={248} focus={center} />
        <Pressable accessibilityRole="button" accessibilityLabel="Voltar" onPress={onBack} style={styles.backFab}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.detailBody}>
        <View style={styles.metaRow}>
          <KindChip kind={center.kind} />
          {center.openNow ? (
            <View style={styles.openChip}>
              <Text style={styles.openChipText}>Aberto agora</Text>
            </View>
          ) : null}
          {center.eventWhen ? (
            <View style={styles.timeChip}>
              <Text style={styles.timeChipText}>{center.eventWhen}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.detailTitle}>{center.name}</Text>
        <Text style={styles.detailMeta}>{meta}</Text>

        <View style={styles.detailActions}>
          {phone ? (
            <Pressable accessibilityRole="button" onPress={() => Linking.openURL(phone)} style={styles.secondary}>
              <Text style={styles.secondaryText}>Ligar</Text>
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => Linking.openURL(maps)} style={[styles.primary, styles.flex]}>
            <Text style={styles.primaryText}>Como chegar</Text>
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <InfoRow icon="location-outline" text={`${center.address}, ${center.city}/${center.uf}`} />
          {center.hours ? <InfoRow icon="time-outline" text={center.hours} /> : null}
          {center.eventWhen ? <InfoRow icon="calendar-outline" text={center.eventWhen} /> : null}
          {center.phone ? <InfoRow icon="call-outline" text={center.phone} /> : null}
        </View>

        {center.services.length > 0 ? (
          <View style={styles.servicesBlock}>
            <Text style={styles.servicesTitle}>Serviços</Text>
            <View style={styles.serviceWrap}>
              {center.services.map((item) => (
                <View key={item} style={styles.serviceChip}>
                  <Text style={styles.serviceChipText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.note}>
          <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.noteText}>
            Fonte: {center.source} · Dados de {center.sourceDate}. Confirme horários antes de ir.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function InfoRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={colors.textTertiary} />
      <Text style={styles.infoRowText}>{text}</Text>
    </View>
  );
}

function FilterRow({
  options,
  value,
  onChange,
}: {
  options: FilterOption[];
  value: CenterFilter;
  onChange: (value: CenterFilter) => void;
}) {
  if (!options.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipsScroll}
      contentContainerStyle={styles.chips}
    >
      {options.map((item) => {
        const on = item.id === value;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(item.id)}
            style={[styles.chip, on ? styles.chipOn : styles.chipOff]}
          >
            <Text style={[styles.chipText, on ? styles.chipTextOn : styles.chipTextOff]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function CenterRow({ center, onPress }: { center: CenterResult; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.row}>
      <View style={[styles.well, { backgroundColor: wellColor(center.kind) }]}>
        <Ionicons name={kindIcon(center.kind)} size={22} color={iconColor(center.kind)} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.rowTitle}>{center.name}</Text>
        <Text style={styles.rowMeta}>{center.listAddress}</Text>
        <View style={styles.rowFoot}>
          <KindChip kind={center.kind} />
          <Text style={[styles.rowKm, { color: iconColor(center.kind) }]}>{center.distance}</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

function KindChip({ kind }: { kind: CenterKind }) {
  return (
    <View style={[styles.kindChip, { backgroundColor: wellColor(kind) }]}>
      <Text style={[styles.kindChipText, { color: iconColor(kind) }]}>{KIND_LABEL[kind]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  permissionBody: { paddingHorizontal: 28, paddingTop: 48, paddingBottom: 24, alignItems: 'center' },
  targetWell: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.teal100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionTitle: {
    marginTop: 24,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  permissionBodyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  checks: { marginTop: 24, alignSelf: 'stretch', gap: 12, backgroundColor: colors.primary50, borderRadius: 16, padding: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkText: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.ink },
  cepBlock: { marginTop: 20, alignSelf: 'stretch', gap: 6 },
  cepLabel: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: colors.ink },
  cepInput: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
  },
  hint: { fontSize: 13, lineHeight: 18, color: colors.danger600 },
  searchHint: { marginBottom: 8 },
  permissionFooter: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  primary: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: '#FFFFFF' },
  ghost: { height: 44, alignItems: 'center', justifyContent: 'center' },
  ghostText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.primary600 },
  busy: { opacity: 0.6 },
  searchFloat: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  searchInList: { position: 'relative', top: 0, left: 0, right: 0, marginTop: 14, marginBottom: 4 },
  searchInput: { flex: 1, fontSize: 16, lineHeight: 22, color: colors.ink, paddingVertical: 8 },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    maxHeight: '52%',
    borderTopWidth: 1,
    borderColor: colors.borderSubtle,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderSubtle,
    marginBottom: 10,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sheetTitle: { flex: 1, fontSize: 16, lineHeight: 24, fontWeight: '700', color: colors.ink },
  link: { fontSize: 14, lineHeight: 21, fontWeight: '600', color: colors.primary600 },
  sheetList: { marginTop: 4, flexShrink: 1 },
  offline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.warning100,
  },
  offlineText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.warning700 },
  outside: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  outsideText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  chipsScroll: { flexGrow: 0, flexShrink: 0 },
  chips: { gap: 8, paddingVertical: 12 },
  chip: { height: 32, borderRadius: 999, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.primary600 },
  chipOff: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderSubtle },
  chipText: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  chipTextOn: { color: '#FFFFFF' },
  chipTextOff: { color: colors.textSecondary },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
  iconBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pageSubtitle: { fontSize: 14, lineHeight: 21, color: colors.textSecondary, textAlign: 'center' },
  empty: { marginTop: 16, fontSize: 14, lineHeight: 21, color: colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  well: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.ink },
  rowMeta: { marginTop: 2, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  rowFoot: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowKm: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  source: { marginTop: 8, fontSize: 12, lineHeight: 16, color: colors.textTertiary },
  detailScroll: { paddingBottom: 28 },
  hero: { position: 'relative' },
  backFab: {
    position: 'absolute',
    top: 12,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  detailBody: { paddingHorizontal: 20, paddingTop: 16 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kindChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  kindChipText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  openChip: { backgroundColor: colors.success100, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  openChipText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.success600 },
  timeChip: { backgroundColor: colors.surfaceMuted, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  timeChipText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.textSecondary },
  detailTitle: { marginTop: 12, fontSize: 22, lineHeight: 28, fontWeight: '700', color: colors.ink },
  detailMeta: { marginTop: 6, fontSize: 14, lineHeight: 21, color: colors.textTertiary },
  detailActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  infoCard: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoRowText: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.ink },
  servicesBlock: { marginTop: 20, gap: 10 },
  servicesTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: colors.ink },
  serviceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  serviceChipText: { fontSize: 13, lineHeight: 18, color: colors.textSecondary, fontWeight: '500' },
  note: {
    marginTop: 16,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  secondary: {
    height: 48,
    minWidth: 112,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.ink },
  flex: { flex: 1 },
});
