import { useCallback, useState } from 'react';
import {
  Alert,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  contarPendentes,
  toggleItem,
  addItem,
  removeItem,
  resumoEscala,
  sincronizarChecklistComCiclo,
  getAeroporto,
  LABEL_CAT,
  ICON_CAT,
  ORDEM_CATS,
} from '@owbuddy/domain';
import type { ChecklistData, ChecklistItem, EscalaResumo } from '@owbuddy/domain';
import { getEscala, getChecklist, setChecklist } from '../../src/storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomNavSpace, colors, maritime, spacing, radius, typography, surface } from '../../src/theme';
import { OWBackground } from '../../src/components/OWBackground';
import { formatDateBR } from '../../src/format';
import { analytics } from '../../src/analytics';

/** "Embarque hoje" / "Embarque amanhã" / "Faltam N dias" — mesma régua do OWNews /meu-embarque. */
function labelEmbarque(dias: number): string {
  if (dias <= 0) return 'Embarque hoje';
  if (dias === 1) return 'Embarque amanhã';
  return `Faltam ${dias} dias`;
}

/** Mensagem contextual do Buddy — lembrete inline quando embarque se aproxima. */
function labelBuddy(feitos: number, total: number, pendentes: number, diasParaEmbarque: number | null): string {
  if (pendentes === 0) return 'Tudo preparado. Bom embarque!';
  if (diasParaEmbarque != null) {
    if (diasParaEmbarque <= 0) {
      return pendentes === 1 ? 'Embarque hoje — ainda falta 1 item.' : `Embarque hoje — faltam ${pendentes} itens.`;
    }
    if (diasParaEmbarque === 1) {
      return pendentes === 1 ? 'Amanhã você embarca. Ainda falta 1 item.' : `Amanhã você embarca. Faltam ${pendentes} itens.`;
    }
    if (diasParaEmbarque <= 3) {
      return `Faltam ${diasParaEmbarque} dias. Ainda ${pendentes === 1 ? 'tem 1 item pendente' : `tem ${pendentes} itens pendentes`}.`;
    }
  }
  return pendentes === 1 ? 'Vai resolvendo. Ainda falta 1 item.' : `Vai resolvendo. Faltam ${pendentes} itens.`;
}

type Section = {
  cat: string;
  label: string;
  icon: string;
  data: ChecklistItem[];
};

function buildSections(data: ChecklistData): Section[] {
  // Agrupar por categoria canônica, na ordem definida
  const map = new Map<string, ChecklistItem[]>(ORDEM_CATS.map(c => [c, []]));
  for (const item of data.items) {
    const cat = item.cat ?? 'personalizados';
    const bucket = map.get(cat) ?? map.get('personalizados')!;
    bucket.push(item);
  }
  return ORDEM_CATS
    .map(cat => ({
      cat,
      label: LABEL_CAT[cat] ?? cat,
      icon: ICON_CAT[cat] ?? 'list-outline',
      data: map.get(cat) ?? [],
    }))
    .filter(s => s.data.length > 0);
}

export default function MeuEmbarque() {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [resumo, setResumo] = useState<EscalaResumo | null>(null);
  const [aeroportoNome, setAeroportoNome] = useState<string | null>(null);
  const [novoItem, setNovoItem] = useState('');
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const [escala, checklist] = await Promise.all([getEscala(), getChecklist()]);
    const r = resumoEscala(escala);
    setResumo(r);
    setAeroportoNome(escala?.aeroporto ? (getAeroporto(escala.aeroporto)?.nome ?? escala.aeroporto) : null);
    // sincronizarChecklistComCiclo já aplica normalizarChecklistCats internamente
    const sync = sincronizarChecklistComCiclo(checklist, r.proximoEmbarqueISO);
    if (sync.alterado) {
      await setChecklist(sync.data);
      if (sync.resetado) analytics.track('checklist_reset');
    }
    setData(sync.data);
  }, []);

  useFocusEffect(useCallback(() => {
    analytics.screen('meu_embarque');
    load();
  }, [load]));

  const persist = async (updated: ChecklistData) => {
    setData(updated);
    await setChecklist(updated);
  };

  const toggle = (id: string) => { if (data) persist(toggleItem(data, id)); };

  const add = async () => {
    const text = novoItem.trim();
    if (!text || !data) return;
    await persist(addItem(data, text)); // vai para 'personalizados'
    setNovoItem('');
  };

  const remove = (id: string, label: string) => {
    Alert.alert('Remover item', `Remover "${label}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => { if (data) persist(removeItem(data, id)); },
      },
    ]);
  };

  if (!data || !resumo) return <OWBackground showWatermark={false}><View style={styles.root} /></OWBackground>;

  const counts = contarPendentes(data);
  const pct = counts.total > 0 ? Math.round((counts.feitos / counts.total) * 100) : 0;
  const tudo = counts.pendentes === 0;
  const temEscala = resumo.estado !== 'SEM_ESCALA';
  const sections = buildSections(data);

  return (
    <OWBackground>
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + spacing.md, paddingBottom: bottomNavSpace(insets.bottom) }]}
        ListHeaderComponent={
          <>
            {/* ── Buddy intro ── */}
            <View style={styles.buddyIntro}>
              <View style={styles.buddyIntroRow}>
                <Ionicons name="person-circle-outline" size={16} color={colors.cyanDim} />
                <Text style={styles.buddyIntroTitle}>O Buddy acompanha seu embarque</Text>
              </View>
              <Text style={styles.buddyIntroSub}>
                Marque o que já resolveu. Perto do embarque, eu te lembro do que ainda estiver pendente.
              </Text>
            </View>

            {/* ── Próximo embarque ── */}
            {temEscala && resumo.proximoEmbarqueISO && resumo.diasParaEmbarque != null ? (
              <TouchableOpacity style={styles.embarqueCard} onPress={() => router.push('/escala')} activeOpacity={0.85}>
                <View style={styles.embarqueLeft}>
                  <Text style={styles.embarqueLabel}>
                    {resumo.estado === 'EMBARCADO' ? 'PRÓXIMO EMBARQUE (APÓS A FOLGA)' : 'PRÓXIMO EMBARQUE'}
                  </Text>
                  <Text style={styles.embarqueData}>{formatDateBR(resumo.proximoEmbarqueISO)}</Text>
                  <Text style={styles.embarqueSub}>
                    {labelEmbarque(resumo.diasParaEmbarque)}
                    {' · '}
                    {counts.feitos}/{counts.total} {counts.feitos === 1 ? 'item pronto' : 'itens prontos'}
                  </Text>
                  {aeroportoNome ? <Text style={styles.embarqueAero}>{aeroportoNome}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.mutedDim} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.semEscalaCard} onPress={() => router.push('/escala-config')} activeOpacity={0.85}>
                <Ionicons name="calendar-outline" size={16} color={colors.cyanDim} />
                <Text style={styles.semEscalaText}>Configure sua escala para ver a data do próximo embarque</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.mutedDim} />
              </TouchableOpacity>
            )}

            {/* ── Contador ── */}
            <View style={styles.header}>
              <View>
                <Text style={styles.counterBig}>
                  {counts.feitos}
                  <Text style={{ color: colors.mutedDim, fontSize: 28 }}> / {counts.total}</Text>
                </Text>
                <Text style={styles.counterSub}>
                  {tudo ? 'Tudo preparado' : `${counts.pendentes} ${counts.pendentes === 1 ? 'item pendente' : 'itens pendentes'}`}
                </Text>
              </View>
              <View style={[styles.progressCircle, { borderColor: tudo ? colors.green : colors.cyan }]}>
                <Text style={[styles.progressPct, { color: tudo ? colors.green : colors.cyan }]}>{pct}%</Text>
              </View>
            </View>

            {/* ── Barra ── */}
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${pct}%` as `${number}%`, backgroundColor: tudo ? colors.green : colors.cyan }]} />
            </View>

            <Text style={styles.buddyMsg}>
              {labelBuddy(counts.feitos, counts.total, counts.pendentes, resumo.diasParaEmbarque ?? null)}
            </Text>
          </>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            {/* @ts-ignore — icon name comes from domain ICON_CAT; valid Ionicons names */}
            <Ionicons name={section.icon} size={13} color={colors.cyanDim} />
            <Text style={styles.sectionHeaderText}>{section.label}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <MalaItem item={item} onToggle={toggle} onRemove={remove} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        SectionSeparatorComponent={() => <View style={styles.sectionSep} />}
        ListFooterComponent={
          /* ── Adicionar ── */
          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              value={novoItem}
              onChangeText={setNovoItem}
              placeholder="Adicionar item personalizado..."
              placeholderTextColor={colors.mutedDim}
              returnKeyType="done"
              onSubmitEditing={add}
              maxLength={60}
            />
            <TouchableOpacity style={styles.addBtn} onPress={add} disabled={!novoItem.trim()}>
              <Ionicons name="add" size={26} color={colors.navy950} style={!novoItem.trim() ? { opacity: 0.4 } : undefined} />
            </TouchableOpacity>
          </View>
        }
      />
    </OWBackground>
  );
}

function MalaItem({
  item,
  onToggle,
  onRemove,
}: {
  item: ChecklistItem;
  onToggle: (id: string) => void;
  onRemove: (id: string, label: string) => void;
}) {
  return (
    <TouchableOpacity
      style={styles.itemRow}
      onPress={() => onToggle(item.id)}
      onLongPress={() => onRemove(item.id, item.t)}
      delayLongPress={500}
    >
      <View style={[styles.checkbox, item.ok && styles.checkboxDone]}>
        {item.ok && <Ionicons name="checkmark" size={14} color={colors.navy950} />}
      </View>
      <Text style={[styles.itemText, item.ok && styles.itemTextDone]}>{item.t}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  listContent: {},

  buddyIntro: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: 4,
    padding: spacing.sm,
    backgroundColor: maritime.glass,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
    borderLeftWidth: 2,
    borderLeftColor: colors.cyan,
    gap: 5,
  },
  buddyIntroRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  buddyIntroTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.white,
  },
  buddyIntroSub: {
    fontSize: 12,
    color: colors.muted,
    lineHeight: 17,
  },

  embarqueCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: maritime.glassElevated, borderRadius: radius.md,
    marginHorizontal: spacing.md, marginTop: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: maritime.glassBorder,
  },
  embarqueLeft: { flex: 1 },
  embarqueLabel: { ...typography.micro, color: colors.cyanDim },
  embarqueData: { fontSize: 18, fontWeight: '700', color: colors.white, marginTop: 2 },
  embarqueSub: { ...typography.small, marginTop: 2 },
  embarqueAero: { fontSize: 11, color: colors.mutedDim, marginTop: 2 },

  semEscalaCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: maritime.glass, borderRadius: radius.md,
    marginHorizontal: spacing.md, marginTop: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: maritime.glassBorder,
  },
  semEscalaText: { flex: 1, fontSize: 13, color: colors.muted },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: spacing.md, paddingBottom: spacing.sm,
  },
  counterBig: { fontSize: 36, fontWeight: '700', color: colors.white },
  counterSub: { ...typography.small, marginTop: 2 },
  progressCircle: {
    width: 60, height: 60, borderRadius: 30, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  progressPct: { fontSize: 15, fontWeight: '700' },

  progressBg: {
    height: 3, backgroundColor: 'rgba(22, 68, 94, 0.4)',
    marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: 3, borderRadius: 2 },

  buddyMsg: {
    ...typography.small, fontStyle: 'italic', color: colors.mutedDim,
    textAlign: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.sm,
  },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 6,
  },
  sectionHeaderText: {
    ...typography.label, color: colors.cyanDim, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  sectionSep: { height: 4 },

  separator: { height: 1, backgroundColor: 'rgba(22, 68, 94, 0.3)', marginLeft: spacing.md + 22 + spacing.sm },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 13,
    paddingHorizontal: spacing.md, gap: spacing.sm,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 2,
    borderColor: colors.line, alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.green, borderColor: colors.green },
  itemText: { flex: 1, ...typography.body },
  itemTextDone: { color: colors.mutedDim, textDecorationLine: 'line-through' },

  addRow: {
    flexDirection: 'row', padding: spacing.md, paddingTop: spacing.sm,
    gap: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(22, 68, 94, 0.4)',
    marginTop: spacing.sm,
  },
  addInput: {
    flex: 1, backgroundColor: maritime.glass, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 10,
    color: colors.white, fontSize: 15,
    borderWidth: 1, borderColor: maritime.glassBorder,
  },
  addBtn: {
    width: 44, height: 44, backgroundColor: colors.cyan,
    borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
  },
});
