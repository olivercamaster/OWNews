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
  cicloAlvoChecklist,
  ehRecorrente,
  progressoMala,
  diasEntreISO,
  getAeroporto,
  LABEL_CAT,
  ICON_CAT,
  ORDEM_CATS,
} from '@owbuddy/domain';
import type { ChecklistData, ChecklistItem, EscalaResumo } from '@owbuddy/domain';
import { getEscala, getChecklist, setChecklist, getOcultarConcluidos, setOcultarConcluidos } from '../../src/storage';
import { confirmar } from '../../src/confirmar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bottomNavSpace, colors, maritime, spacing, radius, typography, surface, themed, tokens, tone } from '../../src/theme';
import { OWProgresso } from '../../src/components/OWProgresso';
import { useTema } from '../../src/tema';
import { OWBackground } from '../../src/components/OWBackground';
import { formatDateBR } from '../../src/format';
import { analytics } from '../../src/analytics';
import { avisar } from '../../src/feedback';
import { useAcaoUnica } from '../../src/acoes';

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
  useTema();
  const [data, setData] = useState<ChecklistData | null>(null);
  const [resumo, setResumo] = useState<EscalaResumo | null>(null);
  const [aeroportoNome, setAeroportoNome] = useState<string | null>(null);
  const [novoItem, setNovoItem] = useState('');
  const [novoTodo, setNovoTodo] = useState(true);
  // Painel do item (⋯ ou toque longo): editar nome, "todos os embarques", ocultar/excluir.
  // `confirmando` = 2º passo antes de excluir.
  const [menu, setMenu] = useState<{ item: ChecklistItem; confirmando: boolean; texto: string; todo: boolean } | null>(null);
  const [alvo, setAlvo] = useState<{ iso: string; dias: number } | null>(null);
  const [ocultarOk, setOcultarOk] = useState(false);
  const insets = useSafeAreaInsets();

  const load = useCallback(async () => {
    const [escala, checklist, ocultar] = await Promise.all([getEscala(), getChecklist(), getOcultarConcluidos()]);
    setOcultarOk(ocultar);
    const r = resumoEscala(escala);
    setResumo(r);
    setAeroportoNome(escala?.aeroporto ? (getAeroporto(escala.aeroporto)?.nome ?? escala.aeroporto) : null);
    // Mala do embarque-alvo: no dia do embarque ainda é a de hoje (não zera de manhã).
    // sincronizarChecklistComCiclo já aplica normalizarChecklistCats internamente.
    const alvoISO = cicloAlvoChecklist(r);
    setAlvo(alvoISO ? { iso: alvoISO, dias: diasEntreISO(r.hojeISO, alvoISO) } : null);
    const sync = sincronizarChecklistComCiclo(checklist, alvoISO, r.hojeISO);
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

  const [add] = useAcaoUnica(async () => {
    const text = novoItem.trim();
    if (!text || !data) return;
    const novo = addItem(data, text, 'personalizados', novoTodo);
    setNovoItem('');
    if (novo === data) { avisar('Esse item já está na lista'); return; }
    await persist(novo);
    analytics.track('checklist_item_created', { todo_embarque: novoTodo });
    avisar('Item adicionado');
  });

  const abrirMenu = (item: ChecklistItem) => setMenu({ item, confirmando: false, texto: item.t, todo: ehRecorrente(item) });

  const salvarItem = async () => {
    if (!menu || !data) return;
    if (!menu.texto.trim()) return;
    await persist(editarItem(data, menu.item.id, menu.texto, menu.todo));
    analytics.track('checklist_item_updated');
    avisar('Item atualizado');
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
    analytics.track('checklist_item_deleted');
    avisar(ehItemPadrao(menu.item.id) ? 'Item oculto' : 'Item excluído');
    setMenu(null);
  };

  const restaurarPadrao = () => { if (data) persist(restaurarItensPadrao(data)); };

  const alternarConcluidos = () => {
    const v = !ocultarOk;
    setOcultarOk(v);
    setOcultarConcluidos(v);
  };

  const desmarcar = () => {
    confirmar('Desmarcar todos?', 'Os itens continuam na lista, só voltam a ficar pendentes.', 'Desmarcar',
      () => { if (data) persist(desmarcarTodos(data)); });
  };

  if (!data || !resumo) return <OWBackground showWatermark={false}><View style={styles.root} /></OWBackground>;

  const counts = contarPendentes(data);
  const prog = progressoMala(data);
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
                Toque no item para marcar. Em ⋯ você edita, escolhe se vale para todo embarque e exclui. No embarque seguinte, eu desmarco tudo de novo — os itens continuam.
              </Text>
            </View>

            {/* ── Próximo embarque ── */}
            {temEscala && alvo ? (
              <TouchableOpacity style={styles.embarqueCard} onPress={() => router.push('/escala')} activeOpacity={0.85}>
                <View style={styles.embarqueLeft}>
                  <Text style={styles.embarqueLabel}>
                    {alvo.dias === 0 ? 'EMBARQUE HOJE' : resumo.estado === 'EMBARCADO' ? 'PRÓXIMO EMBARQUE (APÓS A FOLGA)' : 'PRÓXIMO EMBARQUE'}
                  </Text>
                  <Text style={styles.embarqueData}>{formatDateBR(alvo.iso)}</Text>
                  <Text style={styles.embarqueSub}>
                    {labelEmbarque(alvo.dias)}
                    {' · '}
                    {prog.texto}
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
                      ? 'Mala pronta'
                      : counts.total === 0
                        ? 'Lista vazia'
                        : `${counts.feitos} de ${counts.total} itens prontos`}
                  </Text>
                </View>
                {tudo ? (
                  <View style={styles.doneCircle}>
                    <Ionicons name="checkmark" size={30} color={colors.onAccent} />
                  </View>
                ) : (
                  <View style={styles.progressCircle}>
                    <Text style={[styles.progressPct, { color: corProgresso }]}>{pct}%</Text>
                  </View>
                )}
              </View>
              <OWProgresso valor={pct / 100} cor={corProgresso} style={styles.progressBg} />
              <Text style={[styles.buddyMsg, tudo && styles.buddyMsgDone]}>
                {labelBuddy(counts.feitos, counts.total, counts.pendentes, alvo?.dias ?? null)}
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
            <Ionicons name={section.icon} size={13} color={colors.iconDefault} />
            <Text style={styles.sectionHeaderText}>{section.label}</Text>
          </View>
        )}
        renderItem={({ item }) => <MalaItem item={item} onToggle={toggle} onOptions={abrirMenu} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        SectionSeparatorComponent={() => <View style={styles.sectionSep} />}
        ListFooterComponent={
          /* ── Adicionar ── */
          <>
          <View style={styles.addWrap}>
          <Text style={styles.addTitulo}>Adicionar item</Text>
          <View style={styles.addRowInner}>
            <TextInput
              style={styles.addInput}
              value={novoItem}
              onChangeText={setNovoItem}
              placeholder="Ex.: carregador, chinelo, remédio"
              placeholderTextColor={colors.mutedDim}
              returnKeyType="done"
              onSubmitEditing={() => add()}
              maxLength={60}
              accessibilityLabel="Nome do novo item"
            />
            <TouchableOpacity style={[styles.addBtn, !novoItem.trim() && styles.addBtnOff]} onPress={() => add()} disabled={!novoItem.trim()} accessibilityRole="button" accessibilityLabel="Adicionar item" accessibilityState={{ disabled: !novoItem.trim() }}>
              <Ionicons name="add" size={26} color={colors.onAccent} />
            </TouchableOpacity>
          </View>
          <TodoEmbarque valor={novoTodo} onChange={setNovoTodo} />
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
                <Text style={styles.sheetTitle}>Editar item</Text>
                <Text style={styles.sheetSub}>
                  {ehItemPadrao(menu.item.id) ? 'Item padrão do OWBuddy' : 'Item personalizado'}
                </Text>
                <TextInput
                  style={styles.addInput}
                  value={menu.texto}
                  onChangeText={t => setMenu({ ...menu, texto: t })}
                  maxLength={60}
                  returnKeyType="done"
                  onSubmitEditing={salvarItem}
                  accessibilityLabel="Nome do item"
                />
                <TodoEmbarque valor={menu.todo} onChange={v => setMenu({ ...menu, todo: v })} />
                <TouchableOpacity style={[styles.sheetBtn, styles.sheetBtnPrimario, !menu.texto.trim() && { opacity: 0.5 }]} onPress={salvarItem} disabled={!menu.texto.trim()} accessibilityRole="button">
                  <Text style={[styles.sheetBtnText, { color: colors.onAccent }]}>Salvar</Text>
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

/** "Usar em todos os embarques" — sem ele, o item vale só para este embarque. */
function TodoEmbarque({ valor, onChange }: { valor: boolean; onChange: (v: boolean) => void }) {
  useTema();
  return (
    <TouchableOpacity
      style={styles.todoRow}
      onPress={() => onChange(!valor)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: valor }}
      accessibilityLabel="Usar em todos os embarques"
    >
      <View style={[styles.checkbox, valor && styles.checkboxDone]}>
        {valor && <Ionicons name="checkmark" size={14} color={colors.onAccent} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.todoTexto}>Usar em todos os embarques</Text>
        {!valor && <Text style={styles.todoSub}>Só neste embarque — sai da lista no próximo.</Text>}
      </View>
    </TouchableOpacity>
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
  useTema();
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
          {item.ok && <Ionicons name="checkmark" size={14} color={colors.onAccent} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemText, item.ok && styles.itemTextDone]}>{item.t}</Text>
          {!ehRecorrente(item) && <Text style={styles.soEste}>só neste embarque</Text>}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.moreBtn}
        onPress={() => onOptions(item)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Editar ou excluir ${item.t}`}
      >
        <Ionicons name="ellipsis-horizontal" size={18} color={colors.mutedDim} />
      </TouchableOpacity>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
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
    borderLeftColor: tokens.accentRule,
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
  embarqueLabel: { ...typography.micro, color: colors.kicker },
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
  counterCardDone: { borderColor: colors.green + '50', backgroundColor: tokens.successSoft },
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
  counterBig: { fontSize: 40, fontWeight: '700', color: colors.white, letterSpacing: -1, fontVariant: ['tabular-nums'] },
  counterSub: { ...typography.small, marginTop: 2 },
  // Mostrador neutro: a cor fica só no número (a barra embaixo já mostra o avanço)
  progressCircle: {
    width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, borderColor: tone.border,
    backgroundColor: maritime.sunken, alignItems: 'center', justifyContent: 'center',
  },
  progressPct: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },

  progressBg: { marginHorizontal: spacing.md, marginBottom: spacing.sm },

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
    ...typography.label, color: colors.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  sectionSep: { height: 4 },

  separator: { height: 1, backgroundColor: maritime.glassBorder, marginLeft: spacing.md + 22 + spacing.sm },

  itemRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 4,
    paddingLeft: spacing.md, paddingRight: spacing.xs, gap: spacing.sm, minHeight: 48,
  },
  itemMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 9 },
  moreBtn: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center' },
  checkbox: {
    width: 22, height: 22, borderRadius: 5, borderWidth: 2,
    borderColor: tokens.controlBorder, alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.green, borderColor: colors.green },
  itemText: { flex: 1, ...typography.body },
  // Concluído: check verde + texto mais apagado. Sem risco — lista 100% não vira "parede riscada".
  itemTextDone: { color: colors.mutedDim },

  addWrap: {
    padding: spacing.md, paddingTop: spacing.sm,
    borderTopWidth: 1, borderTopColor: maritime.glassBorder, marginTop: spacing.sm,
  },
  addTitulo: { ...typography.label, color: colors.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  addRowInner: { flexDirection: 'row', gap: spacing.sm },
  addBtnOff: { opacity: 0.45 },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44, marginTop: 6 },
  todoTexto: { fontSize: 14, color: colors.white, fontWeight: '500' },
  todoSub: { fontSize: 12, color: colors.mutedDim, marginTop: 1 },
  soEste: { fontSize: 11, color: colors.amber, marginTop: 1, fontWeight: '600' },
  sheetBtnPrimario: { backgroundColor: colors.cyan, borderTopWidth: 0, borderRadius: radius.md, justifyContent: 'center', marginTop: spacing.sm, marginBottom: spacing.xs },
  addInput: {
    flex: 1, backgroundColor: maritime.field, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 10,
    color: colors.white, fontSize: 15,
    borderWidth: 1, borderColor: maritime.fieldBorder,
  },
  sheetBackdrop: { flex: 1, backgroundColor: maritime.overlay, justifyContent: 'flex-end', alignItems: 'center' },
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
    ...maritime.botaoPrimario,
  },
}));
