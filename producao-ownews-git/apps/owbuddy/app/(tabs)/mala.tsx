import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
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
  editarItem,
  desmarcarTodos,
  ehItemPadrao,
  contarPadraoOcultos,
  restaurarItensPadrao,
  resumoEscala,
  sincronizarChecklistComCiclo,
  getAeroporto,
  LABEL_CAT,
  ICON_CAT,
  ORDEM_CATS,
} from '@owbuddy/domain';
import type { ChecklistData, ChecklistItem, EscalaResumo } from '@owbuddy/domain';
import { getEscala, getChecklist, setChecklist, getOcultarConcluidos, setOcultarConcluidos } from '../../src/storage';
import { confirmar } from '../../src/confirmar';
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
  if (total === 0) return 'Sua lista está vazia. Adicione o que você costuma levar.';
  if (pendentes === 0) return 'Tudo pronto. Bom embarque!';
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

function buildSections(data: ChecklistData, ocultarConcluidos: boolean): Section[] {
  // Agrupar por categoria canônica, na ordem definida
  const map = new Map<string, ChecklistItem[]>(ORDEM_CATS.map(c => [c, []]));
  for (const item of data.items) {
    if (ocultarConcluidos && item.ok) continue; // só esconde da tela; nada é apagado
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
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  // Menu de ações do item (⋯ ou toque longo). `confirmando` = 2º passo antes de excluir.
  const [menu, setMenu] = useState<{ item: ChecklistItem; confirmando: boolean } | null>(null);
  const [ocultarOk, setOcultarOk] = useState(false);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const [escala, checklist, ocultar] = await Promise.all([getEscala(), getChecklist(), getOcultarConcluidos()]);
    setOcultarOk(ocultar);
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

  const abrirMenu = (item: ChecklistItem) => setMenu({ item, confirmando: false });

  const editar = () => {
    if (!menu) return;
    setEditando({ id: menu.item.id, texto: menu.item.t });
    setMenu(null);
  };

  // Personalizado: excluir de vez (com confirmação). Padrão: só sai da lista pessoal.
  const excluirOuOcultar = () => {
    if (!menu || !data) return;
    if (!ehItemPadrao(menu.item.id) && !menu.confirmando) {
      setMenu({ ...menu, confirmando: true });
      return;
    }
    persist(removeItem(data, menu.item.id));
    setMenu(null);
  };

  const restaurarPadrao = () => { if (data) persist(restaurarItensPadrao(data)); };

  const alternarConcluidos = () => {
    const v = !ocultarOk;
    setOcultarOk(v);
    setOcultarConcluidos(v);
  };

  const salvarEdicao = async () => {
    if (data && editando) await persist(editarItem(data, editando.id, editando.texto));
    setEditando(null);
  };

  const desmarcar = () => {
    confirmar('Desmarcar todos?', 'Os itens continuam na lista, só voltam a ficar pendentes.', 'Desmarcar',
      () => { if (data) persist(desmarcarTodos(data)); });
  };

  if (!data || !resumo) return <OWBackground showWatermark={false}><View style={styles.root} /></OWBackground>;

  const counts = contarPendentes(data);
  const pct = counts.total > 0 ? Math.round((counts.feitos / counts.total) * 100) : 0;
  const tudo = counts.total > 0 && counts.pendentes === 0;
  const temEscala = resumo.estado !== 'SEM_ESCALA';
  const sections = buildSections(data, ocultarOk);
  const ocultosPadrao = contarPadraoOcultos(data);
  const corProgresso = tudo ? colors.green : colors.cyan;

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
                <Text style={styles.buddyIntroTitle}>Vai lembrando. Eu guardo pra você.</Text>
              </View>
              <Text style={styles.buddyIntroSub}>
                Marque o que já resolveu. Com os lembretes ligados (Meu Buddy), eu aviso 2 dias antes do embarque se ainda faltar algo. Use ⋯ para editar, excluir ou ocultar um item.
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
            <View style={[styles.counterCard, tudo && styles.counterCardDone]}>
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.counterBig, tudo && { color: colors.green }]}>
                    {counts.feitos}
                    <Text style={{ color: tudo ? colors.green : colors.mutedDim, fontSize: 26 }}> / {counts.total}</Text>
                  </Text>
                  <Text style={[styles.counterSub, tudo && styles.counterSubDone]}>
                    {tudo
                      ? 'Tudo preparado'
                      : counts.total === 0
                        ? 'Lista vazia'
                        : `${counts.pendentes} ${counts.pendentes === 1 ? 'item pendente' : 'itens pendentes'}`}
                  </Text>
                </View>
                {tudo ? (
                  <View style={styles.doneCircle}>
                    <Ionicons name="checkmark" size={30} color={colors.navy950} />
                  </View>
                ) : (
                  <View style={[styles.progressCircle, { borderColor: corProgresso }]}>
                    <Text style={[styles.progressPct, { color: corProgresso }]}>{pct}%</Text>
                  </View>
                )}
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${pct}%` as `${number}%`, backgroundColor: corProgresso }]} />
              </View>
              <Text style={[styles.buddyMsg, tudo && styles.buddyMsgDone]}>
                {labelBuddy(counts.feitos, counts.total, counts.pendentes, resumo.diasParaEmbarque ?? null)}
              </Text>
            </View>

            {/* ── Ocultar / mostrar concluídos (só exibição; nada é apagado) ── */}
            {counts.feitos > 0 && (
              <TouchableOpacity style={styles.toggleOk} onPress={alternarConcluidos} accessibilityRole="button">
                <Ionicons name={ocultarOk ? 'eye-outline' : 'eye-off-outline'} size={15} color={colors.cyanDim} />
                <Text style={styles.toggleOkText}>
                  {ocultarOk ? `Mostrar concluídos (${counts.feitos})` : 'Ocultar concluídos'}
                </Text>
              </TouchableOpacity>
            )}
            {ocultarOk && sections.length === 0 && counts.total > 0 && (
              <Text style={styles.allHidden}>
                {counts.feitos === 1 ? 'O item concluído está oculto.' : `Os ${counts.feitos} itens concluídos estão ocultos.`}
              </Text>
            )}
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
          editando?.id === item.id ? (
            <View style={styles.itemRow}>
              <TextInput
                style={[styles.addInput, { flex: 1 }]}
                value={editando.texto}
                onChangeText={t => setEditando({ id: item.id, texto: t })}
                autoFocus
                maxLength={60}
                returnKeyType="done"
                onSubmitEditing={salvarEdicao}
                accessibilityLabel="Editar item"
              />
              <TouchableOpacity onPress={salvarEdicao} hitSlop={10} accessibilityLabel="Salvar item">
                <Ionicons name="checkmark-circle" size={28} color={colors.cyan} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setEditando(null)} hitSlop={10} accessibilityLabel="Cancelar edição">
                <Ionicons name="close-circle-outline" size={28} color={colors.mutedDim} />
              </TouchableOpacity>
            </View>
          ) : (
            <MalaItem item={item} onToggle={toggle} onOptions={abrirMenu} />
          )
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        SectionSeparatorComponent={() => <View style={styles.sectionSep} />}
        ListFooterComponent={
          /* ── Adicionar ── */
          <>
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
          {counts.feitos > 0 && (
            <TouchableOpacity style={styles.resetBtn} onPress={desmarcar} accessibilityRole="button">
              <Ionicons name="refresh-outline" size={15} color={colors.mutedDim} />
              <Text style={styles.resetText}>Desmarcar todos</Text>
            </TouchableOpacity>
          )}
          {ocultosPadrao > 0 && (
            <TouchableOpacity style={styles.resetBtn} onPress={restaurarPadrao} accessibilityRole="button">
              <Ionicons name="arrow-undo-outline" size={15} color={colors.mutedDim} />
              <Text style={styles.resetText}>
                Restaurar itens padrão ({ocultosPadrao} {ocultosPadrao === 1 ? 'oculto' : 'ocultos'})
              </Text>
            </TouchableOpacity>
          )}
          </>
        }
      />

      {/* ── Ações do item: sheet por toque (funciona igual no Android, iOS e web) ── */}
      <Modal visible={!!menu} transparent animationType="fade" onRequestClose={() => setMenu(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setMenu(null)} accessibilityLabel="Fechar">
          <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} onPress={() => {}}>
            {menu && (menu.confirmando ? (
              <>
                <Text style={styles.sheetTitle}>Excluir “{menu.item.t}”?</Text>
                <Text style={styles.sheetSub}>Item personalizado — sai da sua lista de vez.</Text>
                <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnDanger]} onPress={excluirOuOcultar} accessibilityRole="button">
                  <Ionicons name="trash-outline" size={18} color={colors.white} />
                  <Text style={[styles.sheetBtnText, { color: colors.white }]}>Excluir item</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sheetBtn} onPress={() => setMenu(null)} accessibilityRole="button">
                  <Text style={[styles.sheetBtnText, styles.sheetCancel]}>Cancelar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.sheetTitle} numberOfLines={2}>{menu.item.t}</Text>
                <Text style={styles.sheetSub}>
                  {ehItemPadrao(menu.item.id) ? 'Item padrão do OWBuddy' : 'Item personalizado'}
                </Text>
                <TouchableOpacity style={styles.sheetBtn} onPress={editar} accessibilityRole="button">
                  <Ionicons name="create-outline" size={18} color={colors.cyanDim} />
                  <Text style={styles.sheetBtnText}>Editar nome</Text>
                </TouchableOpacity>
                {ehItemPadrao(menu.item.id) ? (
                  <TouchableOpacity style={styles.sheetBtn} onPress={excluirOuOcultar} accessibilityRole="button">
                    <Ionicons name="eye-off-outline" size={18} color={colors.muted} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sheetBtnText}>Ocultar da minha lista</Text>
                      <Text style={styles.sheetBtnHint}>Volta com “Restaurar itens padrão”</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.sheetBtn} onPress={excluirOuOcultar} accessibilityRole="button">
                    <Ionicons name="trash-outline" size={18} color={colors.red} />
                    <Text style={[styles.sheetBtnText, { color: colors.red }]}>Excluir item</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.sheetBtn} onPress={() => setMenu(null)} accessibilityRole="button">
                  <Text style={[styles.sheetBtnText, styles.sheetCancel]}>Cancelar</Text>
                </TouchableOpacity>
              </>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </OWBackground>
  );
}

function MalaItem({
  item,
  onToggle,
  onOptions,
}: {
  item: ChecklistItem;
  onToggle: (id: string) => void;
  onOptions: (item: ChecklistItem) => void;
}) {
  return (
    <View style={styles.itemRow}>
      <TouchableOpacity
        style={styles.itemMain}
        onPress={() => onToggle(item.id)}
        onLongPress={() => onOptions(item)}
        delayLongPress={450}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.ok }}
        accessibilityLabel={item.t}
        accessibilityHint="Toque para marcar ou desmarcar."
      >
        <View style={[styles.checkbox, item.ok && styles.checkboxDone]}>
          {item.ok && <Ionicons name="checkmark" size={14} color={colors.navy950} />}
        </View>
        <Text style={[styles.itemText, item.ok && styles.itemTextDone]}>{item.t}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.moreBtn}
        onPress={() => onOptions(item)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Opções de ${item.t}`}
      >
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.mutedDim} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, alignSelf: 'center', minHeight: 44, paddingHorizontal: spacing.md, marginBottom: spacing.md },
  resetText: { fontSize: 13, color: colors.mutedDim, fontWeight: '600' },
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

  counterCard: {
    marginHorizontal: spacing.md, marginTop: spacing.md,
    backgroundColor: maritime.glass, borderRadius: radius.lg,
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight,
    paddingBottom: spacing.sm,
  },
  counterCardDone: { borderColor: colors.green + '55', backgroundColor: 'rgba(18, 70, 66, 0.55)' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: spacing.md, paddingBottom: spacing.sm,
  },
  counterSubDone: { color: colors.green, fontWeight: '700', fontSize: 15 },
  doneCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center',
  },
  toggleOk: {
    flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end',
    minHeight: 40, paddingHorizontal: spacing.md, marginTop: 2,
  },
  toggleOkText: { fontSize: 13, color: colors.cyanDim, fontWeight: '600' },
  allHidden: { ...typography.small, color: colors.mutedDim, textAlign: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
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
    textAlign: 'center', paddingHorizontal: spacing.lg, marginBottom: 2,
  },
  buddyMsgDone: { fontStyle: 'normal', color: colors.white, fontWeight: '600', fontSize: 14 },

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
    flexDirection: 'row', alignItems: 'center', paddingVertical: 4,
    paddingLeft: spacing.md, paddingRight: spacing.xs, gap: spacing.sm, minHeight: 48,
  },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 9 },
  moreBtn: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  checkbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 2,
    borderColor: colors.line, alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.green, borderColor: colors.green },
  itemText: { flex: 1, ...typography.body },
  // Concluído: check verde + texto mais apagado. Sem risco — lista 100% não vira "parede riscada".
  itemTextDone: { color: colors.mutedDim },

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
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(2, 10, 18, 0.62)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: {
    width: '100%', maxWidth: 560,
    backgroundColor: surface.header, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderWidth: 1, borderColor: maritime.glassBorder, borderTopColor: maritime.edgeLight,
    paddingTop: spacing.lg, paddingHorizontal: spacing.md,
  },
  sheetTitle: { ...typography.h3, paddingHorizontal: spacing.xs },
  sheetSub: { ...typography.small, color: colors.mutedDim, paddingHorizontal: spacing.xs, marginTop: 2, marginBottom: spacing.sm },
  sheetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52,
    paddingHorizontal: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: maritime.glassBorder,
  },
  sheetBtnDanger: { backgroundColor: colors.red, borderTopWidth: 0, borderRadius: radius.md, justifyContent: 'center', marginTop: spacing.xs, marginBottom: spacing.xs },
  sheetBtnText: { fontSize: 15, fontWeight: '600', color: colors.white },
  sheetBtnHint: { fontSize: 12, color: colors.mutedDim, marginTop: 1 },
  sheetCancel: { flex: 1, textAlign: 'center', color: colors.muted },
  addBtn: {
    width: 44, height: 44, backgroundColor: colors.cyan,
    borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center',
  },
});
