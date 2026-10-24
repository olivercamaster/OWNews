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
import { colors, maritime, radius, spacing, tone, typography, themed } from '../theme';
import { useTema } from '../tema';
import { anosDoSeletor, dataInicialSeletor, dataPorExtenso } from '../data-seletor';

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const ITEM_H = 48;
const VISIBLE = 5;

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
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
  useTema();
  const ref = useRef<FlatList>(null);
  // Índice que veio da própria rolagem: não rola de novo (evita brigar com o dedo).
  const daRolagem = useRef(-1);
  // Rolagem feita pelo código: os eventos de scroll dela não são gesto do
  // usuário (sem isso, a edição abria em "20" a caminho do 16).
  const programada = useRef<{ alvo: number; ate: number } | null>(null);

  // Com paddingVertical de 2 itens, o item i fica na faixa central quando o
  // offset é i * ITEM_H. (scrollToIndex + viewPosition somava o padding e
  // deslocava 2 itens: abria em "22 Ago 2024" mostrando 24 Out 2026.)
  const rolarPara = (i: number, animated: boolean) => {
    programada.current = { alvo: Math.max(0, i), ate: Date.now() + (animated ? 600 : 250) };
    ref.current?.scrollToOffset({ offset: Math.max(0, i) * ITEM_H, animated });
  };

  useEffect(() => {
    if (daRolagem.current === selectedIndex) { daRolagem.current = -1; return; }
    const t = setTimeout(() => rolarPara(selectedIndex, false), 50);
    return () => clearTimeout(t);
  }, [selectedIndex]);

  // A seleção acompanha o que está na faixa central — em toda plataforma.
  // (Antes só mudava no onMomentumScrollEnd, que não dispara na web: o
  // usuário rolava até 16 e o OK salvava o dia inicial.)
  const lerCentro = (y: number) => {
    const idx = Math.min(data.length - 1, Math.max(0, Math.round(y / ITEM_H)));
    const prog = programada.current;
    if (prog) {
      if (idx === prog.alvo || Date.now() > prog.ate) programada.current = null;
      if (Date.now() <= prog.ate) return;
    }
    if (idx !== selectedIndex) { daRolagem.current = idx; onSelect(idx); }
  };

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
              accessibilityRole="button"
              accessibilityLabel={`${label} ${item}`}
              accessibilityState={{ selected: index === selectedIndex }}
              onPress={() => {
                daRolagem.current = -1;
                onSelect(index);
                rolarPara(index, true);
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
          scrollEventThrottle={32}
          onScroll={(e) => lerCentro(e.nativeEvent.contentOffset.y)}
          onMomentumScrollEnd={(e) => lerCentro(e.nativeEvent.contentOffset.y)}
          getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
          style={{ height: ITEM_H * VISIBLE }}
          contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
          contentOffset={{ x: 0, y: Math.max(0, selectedIndex) * ITEM_H }}
          onLayout={() => rolarPara(selectedIndex, false)}
        />
      </View>
    </View>
  );
}

export function OWDatePicker({ visible, value, title = 'Data', onConfirm, onCancel }: OWDatePickerProps) {
  useTema();
  const [anos, setAnos] = useState<number[]>(() => anosDoSeletor(new Date(), value));
  const init = dataInicialSeletor(value);
  const [selD, setSelD] = useState(init.d - 1);     // índice em DAYS
  const [selM, setSelM] = useState(init.m - 1);     // índice em MESES_PT
  const [selY, setSelY] = useState(() => Math.max(0, anos.indexOf(init.y)));
  // As colunas só montam depois de sincronizar o estado desta abertura —
  // montar com o estado da abertura anterior gerava rolagem fantasma.
  const [abertura, setAbertura] = useState<number | null>(null);

  // Cada abertura recalcula: valor salvo (edição) ou hoje local (nova data).
  useEffect(() => {
    if (visible) {
      const hoje = new Date();
      const lista = anosDoSeletor(hoje, value);
      const t = dataInicialSeletor(value, hoje);
      setAnos(lista);
      setSelD(t.d - 1);
      setSelM(t.m - 1);
      setSelY(Math.max(0, lista.indexOf(t.y)));
      setAbertura(n => (n ?? 0) + 1);
    } else {
      setAbertura(null);
    }
  }, [visible, value]);

  const year  = anos[selY] ?? anos[0]!;
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
          <Text style={styles.selecionada} accessibilityLiveRegion="polite">
            {dataPorExtenso(clampedD + 1, month, year)}
          </Text>
          <View style={styles.columns} key={abertura ?? 'fechado'}>
            {abertura != null && (<>
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
              data={anos.map(String)}
              selectedIndex={selY}
              onSelect={setSelY}
              label="ANO"
            />
            </>)}
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

const styles = themed(() => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: maritime.overlay,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: tone.elevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    width: '100%',
    borderTopWidth: 1,
    borderColor: maritime.glassBorder,
  },
  title: { ...typography.h3, textAlign: 'center', marginBottom: 4 },
  selecionada: { ...typography.small, color: colors.cyan, textAlign: 'center', marginBottom: spacing.md },
  columns: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: spacing.sm, minHeight: ITEM_H * VISIBLE + 24 },
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
    ...maritime.botaoPrimario,
  },
  btnOkText: { color: colors.onAccent, fontWeight: '700', fontSize: 16 },
}));
