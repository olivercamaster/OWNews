/**
 * OWDatePicker — seletor de data com 3 colunas (dia / mês / ano).
 * Pure React Native — sem dependência nativa adicional.
 * Compatível com Expo Go SDK 57, Android e iOS.
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, maritime, radius, spacing, typography } from '../theme';

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ITEM_H = 48;
const VISIBLE = 5;

const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 12 }, (_, i) => THIS_YEAR - 2 + i);

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function parseISO(v: string | undefined): { d: number; m: number; y: number } {
  if (!v || v.length < 10) {
    const t = new Date();
    return { d: t.getDate(), m: t.getMonth() + 1, y: t.getFullYear() };
  }
  return {
    y: parseInt(v.slice(0, 4), 10),
    m: parseInt(v.slice(5, 7), 10),
    d: parseInt(v.slice(8, 10), 10),
  };
}

function toISO(d: number, m: number, y: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

interface OWDatePickerProps {
  visible: boolean;
  value?: string;       // YYYY-MM-DD ou ""
  title?: string;
  onConfirm: (v: string) => void;
  onCancel: () => void;
}

function PickerCol({
  data,
  selectedIndex,
  onSelect,
  label,
}: {
  data: string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  label: string;
}) {
  const ref = useRef<FlatList>(null);

  useEffect(() => {
    setTimeout(() => {
      ref.current?.scrollToIndex({ index: Math.max(0, selectedIndex), animated: false, viewPosition: 0.5 });
    }, 50);
  }, [selectedIndex]);

  return (
    <View style={styles.colWrap}>
      <Text style={styles.colLabel}>{label}</Text>
      <View style={styles.pickerWrap}>
        <View style={styles.selector} pointerEvents="none" />
        <FlatList
          ref={ref}
          data={data}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => {
                onSelect(index);
                ref.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
              }}
            >
              <Text style={[styles.itemText, index === selectedIndex && styles.itemTextSel]}>
                {item}
              </Text>
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_H}
          decelerationRate="fast"
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
            onSelect(Math.min(data.length - 1, Math.max(0, idx)));
          }}
          getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
          style={{ height: ITEM_H * VISIBLE }}
          contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
          initialScrollIndex={Math.max(0, selectedIndex)}
          onScrollToIndexFailed={() => {}}
        />
      </View>
    </View>
  );
}

export function OWDatePicker({ visible, value, title = 'Data', onConfirm, onCancel }: OWDatePickerProps) {
  const init = parseISO(value);
  const [selD, setSelD] = useState(init.d - 1);     // índice em DAYS
  const [selM, setSelM] = useState(init.m - 1);     // índice em MESES_PT
  const [selY, setSelY] = useState(() => {           // índice em YEARS
    const i = YEARS.indexOf(init.y);
    return i >= 0 ? i : 2;
  });

  useEffect(() => {
    if (visible) {
      const t = parseISO(value);
      setSelD(t.d - 1);
      setSelM(t.m - 1);
      const yi = YEARS.indexOf(t.y);
      setSelY(yi >= 0 ? yi : 2);
    }
  }, [visible, value]);

  const year  = YEARS[selY]!;
  const month = selM + 1;
  const maxDay = daysInMonth(month, year);
  const DAYS = Array.from({ length: maxDay }, (_, i) => String(i + 1).padStart(2, '0'));

  // Clamp day when month/year changes
  const clampedD = Math.min(selD, maxDay - 1);

  const confirm = () => {
    const day = clampedD + 1;
    onConfirm(toISO(day, month, year));
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.columns}>
            <PickerCol
              data={DAYS}
              selectedIndex={clampedD}
              onSelect={setSelD}
              label="DIA"
            />
            <PickerCol
              data={MESES_PT}
              selectedIndex={selM}
              onSelect={setSelM}
              label="MÊS"
            />
            <PickerCol
              data={YEARS.map(String)}
              selectedIndex={selY}
              onSelect={setSelY}
              label="ANO"
            />
          </View>
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btnCancel} onPress={onCancel}>
              <Text style={styles.btnCancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnOk} onPress={confirm}>
              <Text style={styles.btnOkText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#071e2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    width: '100%',
    borderTopWidth: 1,
    borderColor: maritime.glassBorder,
  },
  title: { ...typography.h3, textAlign: 'center', marginBottom: spacing.lg },
  columns: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: spacing.sm },
  colWrap: { alignItems: 'center', flex: 1 },
  colLabel: { ...typography.micro, color: colors.mutedDim, marginBottom: 8 },
  pickerWrap: { position: 'relative', width: '100%' },
  selector: {
    position: 'absolute',
    top: ITEM_H * 2,
    left: 0,
    right: 0,
    height: ITEM_H,
    backgroundColor: maritime.glassActive,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: maritime.glassBorderActive,
    zIndex: 0,
  },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontSize: 22, fontWeight: '300', color: colors.mutedDim },
  itemTextSel: { color: colors.white, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  btnCancel: {
    flex: 1, padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: maritime.glassBorder, alignItems: 'center',
  },
  btnCancelText: { color: colors.muted, fontWeight: '600' },
  btnOk: {
    flex: 2, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.cyan, alignItems: 'center',
  },
  btnOkText: { color: colors.navy950, fontWeight: '700', fontSize: 16 },
});
