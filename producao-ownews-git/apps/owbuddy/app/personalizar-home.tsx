/**
 * Personalizar Home ("Meu Buddy do meu jeito"). Só LAYOUT — o que aparece na Home.
 * Notificações ficam em Meu Buddy → Lembretes; ocultar um card não desliga nada.
 *
 * Reordenar: arrastar pela alça (≡) ou usar ↑/↓ (toque e leitor de tela). Sem hover.
 * Tudo grátis no 1.0; o schema (ow-domain/home-prefs.ts) já prevê `plano` para o Buddy+.
 */
import { useCallback, useRef, useState } from 'react';
import { Animated, PanResponder, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  DEF_MODULO,
  DESCRICAO_PRESET,
  ESTILOS_SAUDACAO,
  LABEL_ESTILO_SAUDACAO,
  LABEL_PRESET,
  LABEL_TAMANHO,
  PREFS_HOME_PADRAO,
  alternarVisibilidade,
  aplicarPreset,
  definirTamanho,
  fraseDoDia,
  moverModulo,
  restaurarLayoutPadrao,
  saudacaoTopo,
  tamanhoDe,
} from '@owbuddy/domain';
import type { EstiloSaudacao, ModuloHome, PrefsHome, PresetHome, TamanhoModulo } from '@owbuddy/domain';
import { getBuddyPrefs, getCityPref, getPrefsHome, setCityPref, setPrefsHome } from '../src/storage';
import { colors, maritime, radius, spacing, typography, themed, tokens } from '../src/theme';
import { useTema } from '../src/tema';
import { OWBackground } from '../src/components/OWBackground';
import { CityPicker } from '../src/components/CityPicker';
import type { City } from '../src/cities';
import { confirmar } from '../src/confirmar';
import { analytics } from '../src/analytics';

const ROW_H = 64;
const PRESETS: PresetHome[] = ['EQUILIBRADO', 'ROTINA', 'CARREIRA', 'MINIMALISTA'];

export default function PersonalizarHome() {
  useTema();
  const [p, setP] = useState<PrefsHome>(PREFS_HOME_PADRAO);
  const [nome, setNome] = useState('');
  const [city, setCity] = useState<City | null>(null);
  const [picker, setPicker] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  useFocusEffect(useCallback(() => {
    Promise.all([getPrefsHome(), getBuddyPrefs(), getCityPref()]).then(([h, b, c]) => {
      // Abrir a personalização também conta como "dica vista".
      const home = h.dicaVista ? h : { ...h, dicaVista: true };
      setP(home);
      if (!h.dicaVista) setPrefsHome(home);
      setNome(b.apelido?.trim() ?? '');
      setCity(c);
    });
  }, []));

  const salvar = (novo: PrefsHome) => { setP(novo); setPrefsHome(novo); };

  const mover = (de: number, para: number) => {
    if (de === para) return;
    salvar(moverModulo(p, de, para));
    analytics.track('home_module_reordered');
  };

  const agora = new Date();

  return (
    <OWBackground>
      <ScrollView contentContainerStyle={styles.content} scrollEnabled={!arrastando}>
        {/* ── Presets ── */}
        <Text style={styles.secao}>Ponto de partida</Text>
        <View style={styles.presets}>
          {PRESETS.map(pr => (
            <TouchableOpacity
              key={pr}
              style={[styles.preset, p.preset === pr && styles.presetAtivo]}
              onPress={() => { salvar(aplicarPreset(p, pr)); analytics.track('home_preset_applied', { preset: pr }); }}
              accessibilityRole="button"
              accessibilityState={{ selected: p.preset === pr }}
            >
              <Text style={[styles.presetTitulo, p.preset === pr && { color: colors.cyan }]}>{LABEL_PRESET[pr]}</Text>
              <Text style={styles.presetSub} numberOfLines={3}>{DESCRICAO_PRESET[pr]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.hint}>Depois de escolher, ajuste à vontade abaixo.</Text>

        {/* ── Módulos ── */}
        <Text style={styles.secao}>Na minha Home</Text>
        <Text style={styles.hint}>Arraste pela alça ≡ ou use as setas. O olho mostra/oculta — nada é apagado.</Text>
        <View style={styles.lista}>
          {p.ordem.map((id, i) => (
            <LinhaModulo
              key={id}
              id={id}
              index={i}
              total={p.ordem.length}
              visivel={!p.ocultos.includes(id)}
              tamanho={tamanhoDe(p, id)}
              onMover={mover}
              onArrastando={setArrastando}
              onVisibilidade={() => {
                const novo = alternarVisibilidade(p, id);
                salvar(novo);
                analytics.track(novo.ocultos.includes(id) ? 'home_module_hidden' : 'home_module_shown', { modulo: id });
              }}
              onTamanho={t => { salvar(definirTamanho(p, id, t)); analytics.track('home_module_size_changed', { modulo: id, tamanho: t }); }}
            />
          ))}
        </View>

        {/* ── Saudação ── */}
        <Text style={styles.secao}>Saudação</Text>
        <View style={styles.preview}>
          <Text style={styles.previewSaud}>{saudacaoTopo(agora, p.estiloSaudacao, nome)}</Text>
          {p.fraseDoDia && <Text style={styles.previewFrase}>“{fraseDoDia(agora, p.estiloSaudacao)}”</Text>}
        </View>
        <View style={styles.chips}>
          {ESTILOS_SAUDACAO.map(e => (
            <TouchableOpacity
              key={e}
              style={[styles.chip, p.estiloSaudacao === e && styles.chipAtivo]}
              onPress={() => { salvar({ ...p, estiloSaudacao: e as EstiloSaudacao }); analytics.track('greeting_style_changed', { estilo: e }); }}
              accessibilityRole="button"
              accessibilityState={{ selected: p.estiloSaudacao === e }}
            >
              <Text style={[styles.chipTexto, p.estiloSaudacao === e && styles.chipTextoAtivo]}>{LABEL_ESTILO_SAUDACAO[e]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Frase do dia</Text>
          <Switch
            value={p.fraseDoDia}
            onValueChange={v => { salvar({ ...p, fraseDoDia: v }); analytics.track('daily_phrase_toggled', { ativo: v }); }}
            trackColor={{ true: colors.cyan, false: tokens.controlBorder }}
            accessibilityLabel="Frase do dia"
          />
        </View>
        <TouchableOpacity onPress={() => router.push('/buddy-config')} accessibilityRole="button" style={styles.linkRow}>
          <Text style={styles.link}>{nome ? `Nome na saudação: ${nome} · alterar em Meu Buddy` : 'Quer seu nome na saudação? Defina o apelido em Meu Buddy'}</Text>
        </TouchableOpacity>

        {/* ── Clima ── */}
        <Text style={styles.secao}>Clima da sua cidade</Text>
        <View style={styles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.switchLabel}>Mostrar clima na Home</Text>
            <Text style={styles.hintInline}>Clima urbano da cidade escolhida — não é meteorologia offshore.</Text>
          </View>
          <Switch
            value={p.clima}
            onValueChange={v => { salvar({ ...p, clima: v }); analytics.track(v ? 'weather_enabled' : 'weather_disabled'); }}
            trackColor={{ true: colors.cyan, false: tokens.controlBorder }}
            accessibilityLabel="Mostrar clima na Home"
          />
        </View>
        <TouchableOpacity style={styles.cidade} onPress={() => setPicker(true)} accessibilityRole="button" accessibilityLabel="Escolher cidade">
          <Ionicons name="location-outline" size={16} color={colors.cyanDim} />
          <Text style={styles.cidadeTexto}>{city ? `${city.name}${city.state ? ', ' + city.state : ''}` : 'Escolher cidade'}</Text>
          <Text style={styles.link}>Alterar</Text>
        </TouchableOpacity>

        {/* ── Restaurar ── */}
        <TouchableOpacity
          style={styles.restaurar}
          onPress={() => confirmar('Restaurar layout padrão?', 'Volta ordem, visibilidade e tamanhos. Seus dados (escala, eventos, viagem, checklist, certificados, pagamento) não mudam.', 'Restaurar', () => {
            salvar(restaurarLayoutPadrao(p));
            analytics.track('home_layout_reset');
          })}
          accessibilityRole="button"
        >
          <Ionicons name="refresh-outline" size={16} color={colors.muted} />
          <Text style={styles.restaurarTexto}>Restaurar layout padrão</Text>
        </TouchableOpacity>
      </ScrollView>

      <CityPicker
        visivel={picker}
        cidadeAtual={city}
        onEscolher={async c => { await setCityPref(c); setCity(c); setPicker(false); analytics.track('city_configured'); }}
        onFechar={() => setPicker(false)}
      />
    </OWBackground>
  );
}

function LinhaModulo({
  id, index, total, visivel, tamanho, onMover, onArrastando, onVisibilidade, onTamanho,
}: {
  id: ModuloHome;
  index: number;
  total: number;
  visivel: boolean;
  tamanho: TamanhoModulo;
  onMover: (de: number, para: number) => void;
  onArrastando: (v: boolean) => void;
  onVisibilidade: () => void;
  onTamanho: (t: TamanhoModulo) => void;
}) {
  useTema();
  const def = DEF_MODULO[id];
  const dy = useRef(new Animated.Value(0)).current;
  const [ativo, setAtivo] = useState(false);
  // Refs: o PanResponder é criado uma vez; índice e callbacks mudam a cada reordenação.
  const ref = useRef({ index, total, onMover, onArrastando });
  ref.current = { index, total, onMover, onArrastando };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => { setAtivo(true); ref.current.onArrastando(true); },
    onPanResponderMove: (_e, g) => dy.setValue(g.dy),
    onPanResponderRelease: (_e, g) => {
      const { index: i, total: t } = ref.current;
      const alvo = Math.max(0, Math.min(t - 1, i + Math.round(g.dy / ROW_H)));
      dy.setValue(0); setAtivo(false); ref.current.onArrastando(false);
      ref.current.onMover(i, alvo);
    },
    onPanResponderTerminate: () => { dy.setValue(0); setAtivo(false); ref.current.onArrastando(false); },
  })).current;

  const proximo = (t: TamanhoModulo) => def.tamanhos[(def.tamanhos.indexOf(t) + 1) % def.tamanhos.length]!;

  return (
    <Animated.View
      style={[styles.linha, !visivel && styles.linhaOculta, ativo && styles.linhaAtiva, { transform: [{ translateY: dy }], zIndex: ativo ? 10 : 0 }]}
      accessibilityLabel={`${def.label}${visivel ? '' : ', oculto'}`}
      accessibilityActions={[{ name: 'moverAcima', label: 'Mover para cima' }, { name: 'moverAbaixo', label: 'Mover para baixo' }]}
      onAccessibilityAction={e => {
        if (e.nativeEvent.actionName === 'moverAcima') onMover(index, index - 1);
        if (e.nativeEvent.actionName === 'moverAbaixo') onMover(index, index + 1);
      }}
    >
      <View style={styles.alca} {...pan.panHandlers} accessibilityLabel={`Arrastar ${def.label}`} accessibilityHint="Arraste para cima ou para baixo">
        <Ionicons name="reorder-three" size={24} color={colors.muted} />
      </View>
      <View style={styles.setas}>
        <TouchableOpacity onPress={() => onMover(index, index - 1)} disabled={index === 0} hitSlop={4} accessibilityLabel={`Subir ${def.label}`}>
          <Ionicons name="chevron-up" size={16} color={index === 0 ? colors.line : colors.mutedDim} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onMover(index, index + 1)} disabled={index === total - 1} hitSlop={4} accessibilityLabel={`Descer ${def.label}`}>
          <Ionicons name="chevron-down" size={16} color={index === total - 1 ? colors.line : colors.mutedDim} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.linhaLabel, !visivel && { color: colors.mutedDim }]} numberOfLines={2}>{def.label}</Text>
      {def.tamanhos.length > 1 ? (
        <TouchableOpacity style={styles.tamanho} onPress={() => onTamanho(proximo(tamanho))} accessibilityRole="button" accessibilityLabel={`Tamanho de ${def.label}: ${LABEL_TAMANHO[tamanho]}. Toque para trocar`}>
          <Text style={styles.tamanhoTexto}>{LABEL_TAMANHO[tamanho]}</Text>
        </TouchableOpacity>
      ) : <View style={styles.tamanhoVazio} />}
      {def.podeOcultar ? (
        <TouchableOpacity style={styles.olho} onPress={onVisibilidade} accessibilityRole="switch" accessibilityState={{ checked: visivel }} accessibilityLabel={`${visivel ? 'Ocultar' : 'Mostrar'} ${def.label}`}>
          <Ionicons name={visivel ? 'eye-outline' : 'eye-off-outline'} size={20} color={visivel ? colors.cyanDim : colors.mutedDim} />
        </TouchableOpacity>
      ) : (
        <View style={styles.olho} accessibilityLabel="Sempre visível">
          <Ionicons name="lock-closed-outline" size={16} color={colors.mutedDim} />
        </View>
      )}
    </Animated.View>
  );
}

const styles = themed(() => StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl * 2 },
  secao: { ...typography.micro, marginTop: spacing.lg, marginBottom: spacing.sm },
  hint: { fontSize: 12, color: colors.mutedDim, marginBottom: spacing.sm, marginTop: 2 },
  hintInline: { fontSize: 12, color: colors.mutedDim, marginTop: 2 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  preset: {
    width: '48.5%', minHeight: 78, padding: spacing.sm + 2, borderRadius: radius.md,
    borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass,
  },
  presetAtivo: { borderColor: colors.cyan, backgroundColor: colors.cyanFaint },
  presetTitulo: { fontSize: 14, fontWeight: '700', color: colors.white },
  presetSub: { fontSize: 11.5, color: colors.muted, marginTop: 2, lineHeight: 15 },
  lista: { borderRadius: radius.lg, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass },
  linha: {
    height: ROW_H, flexDirection: 'row', alignItems: 'center', gap: 4, paddingRight: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: maritime.glassBorder, backgroundColor: 'transparent',
  },
  linhaOculta: { opacity: 0.75 },
  linhaAtiva: { backgroundColor: maritime.glassElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.cyan },
  alca: { width: 44, height: ROW_H, alignItems: 'center', justifyContent: 'center' },
  setas: { width: 22, alignItems: 'center', justifyContent: 'center', gap: 2 },
  linhaLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.white },
  tamanho: { minWidth: 84, minHeight: 34, paddingHorizontal: 10, borderRadius: radius.xl, borderWidth: 1, borderColor: maritime.glassBorder, alignItems: 'center', justifyContent: 'center' },
  tamanhoTexto: { fontSize: 12, fontWeight: '700', color: colors.cyanDim },
  tamanhoVazio: { minWidth: 84 },
  olho: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  preview: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass, marginBottom: spacing.sm },
  previewSaud: { fontSize: 20, fontWeight: '700', color: colors.white },
  previewFrase: { fontSize: 14, color: colors.muted, fontStyle: 'italic', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center', borderRadius: radius.xl, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass },
  chipAtivo: { backgroundColor: colors.cyanFaint, borderColor: colors.cyan },
  chipTexto: { fontSize: 13, fontWeight: '600', color: colors.muted },
  chipTextoAtivo: { color: colors.cyan },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, minHeight: 52 },
  switchLabel: { fontSize: 15, color: colors.white, fontWeight: '600' },
  linkRow: { minHeight: 40, justifyContent: 'center' },
  link: { fontSize: 13, color: colors.cyanDim, fontWeight: '600' },
  cidade: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 50, paddingHorizontal: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass,
  },
  cidadeTexto: { flex: 1, fontSize: 15, color: colors.white },
  restaurar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, marginTop: spacing.xl },
  restaurarTexto: { fontSize: 14, fontWeight: '600', color: colors.muted },
}));
