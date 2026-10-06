/**
 * OWTimePicker — seletor de horário para o OWBuddy.
 * Modal com duas colunas scroll (horas 00–23, minutos 00/05/.../55).
 * Pure React Native — sem dependência nativa adicional.
 * Compatível com Expo Go SDK 57, Android e iOS.
 *
 * Uso:
 *   <OWTimePicker
 *     visible={show}
 *     value="19:45"           // string "HH:mm" ou "" para nenhum
 *     onConfirm={(v) => setHora(v)}
 *     onCancel={() => setShow(false)}
 *   />
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
export { normalizeHora } from '../hora-utils';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));
const ITEM_H = 48;
const VISIBLE = 5; // quantos itens mostrar por coluna

interface OWTimePickerProps {
  visible: boolean;
  value?: string; // "HH:mm" ou ""
  onConfirm: (v: string) => void;
  onCancel: () => void;
}

function parseTime(v: string | undefined): { h: number; m: number } {
  if (!v) return { h: 0, m: 0 };
  // "HH:mm" → h, m
  const parts = v.split(':');
  const h = Math.min(23, Math.max(0, parseInt(parts[0] ?? '0', 10)));
  const rawM = parseInt(parts[1] ?? '0', 10);
  // Arredonda para o múltiplo de 5 mais próximo
  const m = Math.min(55, Math.round(rawM / 5) * 5);
  return { h, m };
}

export function OWTimePicker({ visible, value, onConfirm, onCancel }: OWTimePickerProps) {
  const init = parseTime(value);
  const [selH, setSelH] = useState(init.h);
  const [selM, setSelM] = useState(init.m / 5); // índice em MINUTES

  const hRef = useRef<FlatList>(null);
  const mRef = useRef<FlatList>(null);

  // Sincronizar quando value muda
  useEffect(() => {
    if (visible) {
      const t = parseTime(value);
      setSelH(t.h);
      setSelM(t.m / 5);
    }
  }, [visible, value]);

  // Scroll inicial
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        hRef.current?.scrollToIndex({ index: selH, animated: false, viewPosition: 0.5 });
        mRef.current?.scrollToIndex({ index: selM, animated: false, viewPosition: 0.5 });
      }, 50);
    }
  }, [visible]);

  const confirm = () => {
    const hStr = HOURS[selH]!;
    const mStr = MINUTES[selM]!;
    onConfirm(`${hStr}:${mStr}`);
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Horário</Text>

          <View style={styles.columns}>
            {/* Horas */}
            <View style={styles.colWrap}>
              <Text style={styles.colLabel}>HORA</Text>
              <View style={styles.pickerWrap}>
                <View style={styles.selector} pointerEvents="none" />
                <FlatList
                  ref={hRef}
                  data={HOURS}
                  keyExtractor={i => i}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={[styles.item, index === selH && styles.itemSel]}
                      onPress={() => {
                        setSelH(index);
                        hRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
                      }}
                    >
                      <Text style={[styles.itemText, index === selH && styles.itemTextSel]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_H}
                  decelerationRate="fast"
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
                    setSelH(Math.min(23, Math.max(0, idx)));
                  }}
                  getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
                  style={{ height: ITEM_H * VISIBLE }}
                  contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
                  initialScrollIndex={selH}
                  onScrollToIndexFailed={() => {}}
                />
              </View>
            </View>

            <Text style={styles.colon}>:</Text>

            {/* Minutos */}
            <View style={styles.colWrap}>
              <Text style={styles.colLabel}>MIN</Text>
              <View style={styles.pickerWrap}>
                <View style={styles.selector} pointerEvents="none" />
                <FlatList
                  ref={mRef}
                  data={MINUTES}
                  keyExtractor={i => i}
                  renderItem={({ item, index }) => (
                    <TouchableOpacity
                      style={[styles.item, index === selM && styles.itemSel]}
                      onPress={() => {
                        setSelM(index);
                        mRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
                      }}
                    >
                      <Text style={[styles.itemText, index === selM && styles.itemTextSel]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )}
                  showsVerticalScrollIndicator={false}
                  snapToInterval={ITEM_H}
                  decelerationRate="fast"
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
                    setSelM(Math.min(11, Math.max(0, idx)));
                  }}
                  getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
                  style={{ height: ITEM_H * VISIBLE }}
                  contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
                  initialScrollIndex={selM}
                  onScrollToIndexFailed={() => {}}
                />
              </View>
            </View>
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

/** Normaliza string de hora legada para "HH:mm": "1945" → "19:45", "945" → "09:45" */

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
  columns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
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
  item: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  itemSel: {},
  itemText: { fontSize: 28, fontWeight: '300', color: colors.mutedDim },
  itemTextSel: { color: colors.white, fontWeight: '700' },
  colon: { fontSize: 32, fontWeight: '700', color: colors.white, marginTop: 28 },
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
