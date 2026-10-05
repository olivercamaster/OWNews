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
import { useFocusEffect } from 'expo-router';
import {
  criarChecklistPadrao,
  contarPendentes,
  toggleItem,
  addItem,
  removeItem,
  calcularMomento,
  proximaDataEmbarque,
} from '@owbuddy/domain';
import type { ChecklistData, ChecklistItem } from '@owbuddy/domain';
import { getEscala, getChecklist, setChecklist } from '../../src/storage';
import { colors, spacing, radius, typography } from '../../src/theme';

export default function MinhaMala() {
  const [data, setData] = useState<ChecklistData | null>(null);
  const [novoItem, setNovoItem] = useState('');

  const load = useCallback(async () => {
    const [escala, checklist] = await Promise.all([getEscala(), getChecklist()]);
    const proxEmb = escala ? proximaDataEmbarque(escala) : null;
    const cicloISO = proxEmb ? proxEmb.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

    if (!checklist || checklist.ciclo !== cicloISO) {
      const novo = checklist
        ? { ...checklist, ciclo: cicloISO }
        : criarChecklistPadrao(cicloISO);
      await setChecklist(novo);
      setData(novo);
    } else {
      setData(checklist);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (id: string) => {
    if (!data) return;
    const updated = toggleItem(data, id);
    setData(updated);
    await setChecklist(updated);
  };

  const add = async () => {
    const text = novoItem.trim();
    if (!text || !data) return;
    const updated = addItem(data, text);
    setData(updated);
    await setChecklist(updated);
    setNovoItem('');
  };

  const remove = (id: string, label: string) => {
    Alert.alert('Remover item', `Remover "${label}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          if (!data) return;
          const updated = removeItem(data, id);
          setData(updated);
          await setChecklist(updated);
        },
      },
    ]);
  };

  if (!data) return <View style={styles.root} />;

  const counts = contarPendentes(data);
  const pct = counts.total > 0 ? Math.round((counts.feitos / counts.total) * 100) : 0;
  const tudo = counts.pendentes === 0;

  return (
    <View style={styles.root}>
      {/* Counter header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.counterBig}>
            {counts.feitos}
            <Text style={{ color: colors.mutedDim, fontSize: 28 }}> / {counts.total}</Text>
          </Text>
          <Text style={styles.counterSub}>
            {tudo ? 'Tudo preparado ✓' : `${counts.pendentes} ${counts.pendentes === 1 ? 'item pendente' : 'itens pendentes'}`}
          </Text>
        </View>
        <View style={[styles.progressCircle, { borderColor: tudo ? colors.green : colors.cyan }]}>
          <Text style={[styles.progressPct, { color: tudo ? colors.green : colors.cyan }]}>{pct}%</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: tudo ? colors.green : colors.cyan }]} />
      </View>

      {/* Buddy message */}
      <Text style={styles.buddyMsg}>Vai lembrando. Eu guardo pra você.</Text>

      {/* List */}
      <FlatList
        data={data.items}
        keyExtractor={item => item.id}
        style={styles.list}
        renderItem={({ item }) => (
          <MalaItem item={item} onToggle={toggle} onRemove={remove} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* Add item */}
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
          <Text style={[styles.addBtnText, !novoItem.trim() && { opacity: 0.4 }]}>+</Text>
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
        {item.ok && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={[styles.itemText, item.ok && styles.itemTextDone]}>{item.t}</Text>
      <Text style={styles.itemCat}>{item.cat}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy950 },

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
  checkmark: { fontSize: 13, color: colors.navy950, fontWeight: '700' },
  itemText: { flex: 1, ...typography.body },
  itemTextDone: { color: colors.mutedDim, textDecorationLine: 'line-through' },
  itemCat: { ...typography.micro, fontSize: 9 },

  addRow: { flexDirection: 'row', padding: spacing.md, paddingTop: spacing.sm, gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  addInput: { flex: 1, backgroundColor: colors.navy800, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 10, color: colors.white, fontSize: 15 },
  addBtn: { width: 44, height: 44, backgroundColor: colors.cyan, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 24, fontWeight: '300', color: colors.navy950 },
});
