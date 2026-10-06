import { useEffect, useState } from 'react';
import {
  FlatList,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, maritime, spacing, radius, typography, surface } from '../src/theme';
import { OWBackground } from '../src/components/OWBackground';
import { analytics } from '../src/analytics';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

type UnitDef = { id: string; label: string; toBase: number };
type Category = { id: string; label: string; icon: IoniconsName; units: UnitDef[] };

const CATEGORIES: Category[] = [
  {
    id: 'pressao', label: 'Pressão', icon: 'speedometer-outline',
    units: [
      { id: 'psi', label: 'PSI', toBase: 6894.757 },
      { id: 'bar', label: 'bar', toBase: 100000 },
      { id: 'kpa', label: 'kPa', toBase: 1000 },
      { id: 'atm', label: 'atm', toBase: 101325 },
      { id: 'mpa', label: 'MPa', toBase: 1000000 },
    ],
  },
  {
    id: 'comprimento', label: 'Comprimento', icon: 'resize-outline',
    units: [
      { id: 'm', label: 'm', toBase: 1 },
      { id: 'ft', label: 'ft', toBase: 0.3048 },
      { id: 'in', label: 'in', toBase: 0.0254 },
      { id: 'km', label: 'km', toBase: 1000 },
      { id: 'nm', label: 'nm', toBase: 1852 },
    ],
  },
  {
    id: 'peso', label: 'Peso', icon: 'barbell-outline',
    units: [
      { id: 'kg', label: 'kg', toBase: 1 },
      { id: 'lb', label: 'lb', toBase: 0.453592 },
      { id: 'ton', label: 'ton', toBase: 1000 },
      { id: 'g', label: 'g', toBase: 0.001 },
    ],
  },
  {
    id: 'temperatura', label: 'Temperatura', icon: 'thermometer-outline',
    units: [
      { id: 'c', label: '°C', toBase: 1 },
      { id: 'f', label: '°F', toBase: 1 },
      { id: 'k', label: 'K', toBase: 1 },
    ],
  },
  {
    id: 'velocidade', label: 'Velocidade', icon: 'speedometer-outline',
    units: [
      { id: 'kn', label: 'kn', toBase: 1852 / 3600 },
      { id: 'kmh', label: 'km/h', toBase: 1 / 3.6 },
      { id: 'ms', label: 'm/s', toBase: 1 },
      { id: 'mph', label: 'mph', toBase: 1609.344 / 3600 },
    ],
  },
  {
    id: 'volume', label: 'Volume', icon: 'flask-outline',
    units: [
      { id: 'l', label: 'L', toBase: 1 },
      { id: 'ml', label: 'mL', toBase: 0.001 },
      { id: 'm3', label: 'm³', toBase: 1000 },
      { id: 'gal', label: 'gal', toBase: 3.78541 },
      { id: 'ft3', label: 'ft³', toBase: 28.3168 },
      { id: 'bbl', label: 'bbl', toBase: 158.987 },
    ],
  },
];

function toBaseSI(val: number, fromId: string, cat: Category): number {
  if (cat.id === 'temperatura') {
    if (fromId === 'c') return val + 273.15;
    if (fromId === 'f') return (val - 32) * (5 / 9) + 273.15;
    return val;
  }
  return val * (cat.units.find(u => u.id === fromId)?.toBase ?? 1);
}

function fromBaseSI(baseVal: number, toId: string, cat: Category): number {
  if (cat.id === 'temperatura') {
    if (toId === 'c') return baseVal - 273.15;
    if (toId === 'f') return (baseVal - 273.15) * (9 / 5) + 32;
    return baseVal;
  }
  const factor = cat.units.find(u => u.id === toId)?.toBase ?? 1;
  return baseVal / factor;
}

function fmt(val: number): string {
  if (!isFinite(val) || isNaN(val)) return '—';
  const abs = Math.abs(val);
  if (abs === 0) return '0';
  if (abs >= 1e6 || (abs > 0 && abs < 0.0001)) return val.toExponential(4);
  if (abs >= 1000) return val.toFixed(2);
  if (abs >= 1) return val.toFixed(4);
  return val.toFixed(6);
}

export default function FerramentasScreen() {
  const [catIdx, setCatIdx] = useState(0);
  const [fromUnitIdx, setFromUnitIdx] = useState(0);
  const [rawValue, setRawValue] = useState('1');

  const cat = CATEGORIES[catIdx]!;
  const fromUnit = cat.units[fromUnitIdx]!;

  useEffect(() => { analytics.screen('ferramentas'); }, []);

  const numVal = parseFloat(rawValue.replace(',', '.'));
  const baseVal = isNaN(numVal) ? NaN : toBaseSI(numVal, fromUnit.id, cat);

  const onCatChange = (idx: number) => {
    setCatIdx(idx);
    setFromUnitIdx(0);
    setRawValue('1');
  };

  const onSwapTo = (toIdx: number) => {
    const newBaseVal = isNaN(baseVal) ? NaN : baseVal;
    const newFromId = cat.units[toIdx]!.id;
    const converted = isNaN(newBaseVal) ? '' : fmt(fromBaseSI(newBaseVal, newFromId, cat));
    setFromUnitIdx(toIdx);
    setRawValue(converted);
    analytics.track('converter_used', { category: cat.id, unit: newFromId });
  };

  const cycleFromUnit = () => {
    const nextIdx = (fromUnitIdx + 1) % cat.units.length;
    onSwapTo(nextIdx);
  };

  const shareResult = async (toUnit: UnitDef, result: string) => {
    try {
      await Share.share({ message: `${rawValue} ${fromUnit.label} = ${result} ${toUnit.label}` });
    } catch {
      // ignore
    }
  };

  return (
    <OWBackground>
    <View style={styles.root}>
      {/* Category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catBar}
        contentContainerStyle={styles.catBarContent}
      >
        {CATEGORIES.map((c, i) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.catChip, i === catIdx && styles.catChipActive]}
            onPress={() => onCatChange(i)}
          >
            <Ionicons
              name={c.icon}
              size={14}
              color={i === catIdx ? colors.navy950 : colors.muted}
            />
            <Text style={[styles.catLabel, i === catIdx && styles.catLabelActive]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input row */}
      <View style={styles.inputCard}>
        <TextInput
          style={styles.valueInput}
          value={rawValue}
          onChangeText={setRawValue}
          keyboardType="decimal-pad"
          selectTextOnFocus
          placeholderTextColor={colors.mutedDim}
          placeholder="0"
        />
        <TouchableOpacity style={styles.unitChip} onPress={cycleFromUnit}>
          <Text style={styles.unitChipText}>{fromUnit.label}</Text>
          <Ionicons name="swap-vertical-outline" size={14} color={colors.navy950} />
        </TouchableOpacity>
      </View>

      {/* Results */}
      <FlatList
        data={cat.units.filter((_, i) => i !== fromUnitIdx)}
        keyExtractor={u => u.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        renderItem={({ item: u }) => {
          const result = isNaN(baseVal) ? '—' : fmt(fromBaseSI(baseVal, u.id, cat));
          return (
            <TouchableOpacity
              style={styles.resultRow}
              onPress={() => onSwapTo(cat.units.indexOf(u))}
              onLongPress={() => shareResult(u, result)}
              activeOpacity={0.7}
            >
              <View style={styles.resultLeft}>
                <Text style={styles.resultValue}>{result}</Text>
                <Text style={styles.resultUnit}>{u.label}</Text>
              </View>
              <Ionicons name="swap-horizontal-outline" size={16} color={colors.mutedDim} />
            </TouchableOpacity>
          );
        }}
      />

      <Text style={styles.hint}>Toque para inverter · Segure para compartilhar</Text>
    </View>
    </OWBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },

  catBar: { flexGrow: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: maritime.glassBorder },
  catBarContent: { padding: spacing.sm, gap: spacing.xs, flexDirection: 'row' },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 99,
    backgroundColor: maritime.glass,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
  },
  catChipActive: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  catLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  catLabelActive: { color: colors.navy950 },

  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.md,
    backgroundColor: maritime.glassElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cyan + '55',
    padding: spacing.md,
    ...maritime.cardShadow,
  },
  valueInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '700',
    color: colors.white,
  },
  unitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.cyan,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  unitChipText: { fontSize: 15, fontWeight: '700', color: colors.navy950 },

  list: { flex: 1 },
  listContent: { paddingHorizontal: spacing.md, gap: spacing.xs, paddingBottom: spacing.xl },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: maritime.glass,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderWidth: 1,
    borderColor: maritime.glassBorder,
  },
  resultLeft: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  resultValue: { fontSize: 22, fontWeight: '700', color: colors.white },
  resultUnit: { fontSize: 14, fontWeight: '600', color: colors.cyanDim },

  hint: {
    ...typography.micro,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: maritime.glassBorder,
  },
});
