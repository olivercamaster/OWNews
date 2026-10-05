import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
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
} from '@owbuddy/domain';
import type { ChecklistData, ChecklistItem, EscalaResumo } from '@owbuddy/domain';
import { getEscala, getChecklist, setChecklist } from '../../src/storage';
import { colors, spacing, radius, typography, surface } from '../../src/theme';
import { formatDateBR } from '../../src/format';
import { analytics } from '../../src/analytics';

/** "Embarque hoje" / "Embarque amanhã" / "Faltam N dias" — mesma régua do OWNews /meu-embarque. */
function labelEmbarque(dias: number): string {
  if (dias <= 0) return 'Embarque hoje';
  if (dias === 1) return 'Embarque amanhã';
  return `Faltam ${dias} dias`;
}

export default function MeuEmbarque() {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [resumo, setResumo] = useState<EscalaResumo | null>(null);
  const [aeroportoNome, setAeroportoNome] = useState<string | null>(null);
  const [novoItem, setNovoItem] = useState('');

  const load = useCallback(async () => {
    const [escala, checklist] = await Promise.all([getEscala(), getChecklist()]);
    const r = resumoEscala(escala);
    setResumo(r);
    setAeroportoNome(escala?.aeroporto ? (getAeroporto(escala.aeroporto)?.nome ?? escala.aeroporto) : null);

    // Chave ownews_checklist_mala: itens nunca são perdidos; ao virar o ciclo
    // (novo embarque) só o `ok` volta para false (paridade OWNews web).
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
    await persist(addItem(data, text));
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

  if (!data || !resumo) return <View style={styles.root} />;

  const counts = contarPendentes(data);
  const pct = counts.total > 0 ? Math.round((counts.feitos / counts.total) * 100) : 0;
  const tudo = counts.pendentes === 0;
  const temEscala = resumo.estado !== 'SEM_ESCALA';

  return (
    <View style={styles.root}>
      {/* ── Próximo embarque (vem da escala) ── */}
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

      <Text style={styles.buddyMsg}>Vai lembrando. Eu guardo pra você.</Text>

      {/* ── Lista ── */}
      <FlatList
        data={data.items}
        keyExtractor={item => item.id}
        style={styles.list}
        renderItem={({ item }) => (
          <MalaItem item={item} onToggle={toggle} onRemove={remove} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* ── Adicionar ── */}
      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={novoItem}
          onChangeText={setNovoItem}
          placeholder="Adicionar item..."
          placeholderTextColor={colors.mutedDim}
          returnKeyType="done"
          onSubmitEditing={add}
          maxLength={60}
        />
        <TouchableOpacity style={styles.addBtn} onPress={add} disabled={!novoItem.trim()}>
          <Ionicons name="add" size={26} color={colors.navy950} style={!novoItem.trim() ? { opacity: 0.4 } : undefined} />
        </TouchableOpacity>
      </View>
    </View>
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
      <Text style={styles.itemCat}>{item.cat}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy950 },

  embarqueCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: surface.card, borderRadius: radius.md,
    marginHorizontal: spacing.md, marginTop: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.line,
  },
  embarqueLeft: { flex: 1 },
  embarqueLabel: { ...typography.micro, color: colors.cyanDim },
  embarqueData: { fontSize: 18, fontWeight: '700', color: colors.white, marginTop: 2 },
  embarqueSub: { ...typography.small, marginTop: 2 },
  embarqueAero: { fontSize: 11, color: colors.mutedDim, marginTop: 2 },

  semEscalaCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: surface.card, borderRadius: radius.md,
    marginHorizontal: spacing.md, marginTop: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.line,
  },
  semEscalaText: { flex: 1, fontSize: 13, color: colors.muted },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, paddingBottom: spacing.sm },
  counterBig: { fontSize: 36, fontWeight: '700', color: colors.white },
  counterSub: { ...typography.small, marginTop: 2 },
  progressCircle: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  progressPct: { fontSize: 15, fontWeight: '700' },

  progressBg: { height: 3, backgroundColor: colors.line, marginHorizontal: spacing.md, marginBottom: spacing.sm, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2 },

  buddyMsg: { ...typography.small, fontStyle: 'italic', color: colors.mutedDim, textAlign: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.md },

  list: { flex: 1, paddingHorizontal: spacing.md },
  separator: { height: 1, backgroundColor: colors.lineSoft },

  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: spacing.sm },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: colors.green, borderColor: colors.green },
  itemText: { flex: 1, ...typography.body },
  itemTextDone: { color: colors.mutedDim, textDecorationLine: 'line-through' },
  itemCat: { ...typography.micro, fontSize: 9 },

  addRow: { flexDirection: 'row', padding: spacing.md, paddingTop: spacing.sm, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  addInput: { flex: 1, backgroundColor: colors.navy800, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 10, color: colors.white, fontSize: 15 },
  addBtn: { width: 44, height: 44, backgroundColor: colors.cyan, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
});
