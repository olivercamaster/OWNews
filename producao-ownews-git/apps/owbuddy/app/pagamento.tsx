/**
 * Meu Pagamento — o usuário cadastra a REGRA da empresa; o app calcula a DATA PROVÁVEL
 * localmente (ow-domain/pagamento.ts). Nunca pede valor do salário. Nunca afirma certeza.
 */
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  AVISO_PAGAMENTO_OPCOES,
  CONFIG_PAGAMENTO_PADRAO,
  LABEL_AJUSTE,
  LABEL_REGRA,
  descreverRegra,
  hojeISO,
  proximosPagamentos,
} from '@owbuddy/domain';
import type { AjusteFimDeSemana, ConfigPagamento, RegraPagamento } from '@owbuddy/domain';
import { getPagamento, setPagamento } from '../src/storage';
import { colors, maritime, radius, spacing, typography } from '../src/theme';
import { OWBackground } from '../src/components/OWBackground';
import { formatDateBR } from '../src/format';
import { confirmar } from '../src/confirmar';
import { analytics } from '../src/analytics';

const REGRAS: RegraPagamento[] = ['ULTIMO_UTIL', 'PRIMEIRO_UTIL', 'QUINTO_UTIL', 'DIA_FIXO', 'NESIMO_UTIL'];
const AJUSTES: AjusteFimDeSemana[] = ['ANTECIPAR', 'POSTERGAR', 'SEM_AJUSTE'];
const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function diaSemana(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return SEMANA[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()]!;
}

export default function MeuPagamento() {
  const [cfg, setCfg] = useState<ConfigPagamento>({ ...CONFIG_PAGAMENTO_PADRAO });
  const [salvo, setSalvo] = useState<ConfigPagamento | null>(null);
  const [msg, setMsg] = useState('');

  useFocusEffect(useCallback(() => {
    getPagamento().then(p => { setSalvo(p); if (p) setCfg(p); });
  }, []));

  const mudar = (p: Partial<ConfigPagamento>) => { setCfg(c => ({ ...c, ...p })); setMsg(''); };

  const salvar = async () => {
    const final: ConfigPagamento = {
      ...cfg,
      dia: cfg.regra === 'DIA_FIXO' ? (cfg.dia ?? 5) : cfg.dia,
      nUtil: cfg.regra === 'NESIMO_UTIL' ? (cfg.nUtil ?? 3) : cfg.nUtil,
    };
    await setPagamento(final);
    setSalvo(final);
    setMsg('Regra salva.');
    analytics.track('payment_rule_configured', { regra: final.regra, ajuste: final.ajuste, aviso_dias: final.avisoDias });
  };

  const remover = () => confirmar('Remover Meu Pagamento?', 'A regra sai deste aparelho. Nada mais é alterado.', 'Remover', async () => {
    await setPagamento(null);
    setSalvo(null);
    setCfg({ ...CONFIG_PAGAMENTO_PADRAO });
    setMsg('');
    analytics.track('payment_rule_removed');
  }, true);

  const previsao = proximosPagamentos(cfg, hojeISO(), 3);
  const prox = previsao[0];

  return (
    <OWBackground>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {prox && (
          <View style={styles.resultado} accessibilityLiveRegion="polite">
            <Text style={styles.resLabel}>PAGAMENTO PREVISTO</Text>
            <Text style={styles.resData}>{formatDateBR(prox.iso)}</Text>
            <Text style={styles.resSub}>{diaSemana(prox.iso)}{prox.ajustado ? ` · ajustado de ${formatDateBR(prox.nominal)} (${prox.motivoAjuste === 'feriado' ? 'feriado' : 'fim de semana'})` : ''}</Text>
            <Text style={styles.resRegra}>Pela regra que você cadastrou: {descreverRegra(cfg)}.</Text>
            {previsao.length > 1 && (
              <Text style={styles.resProx}>Depois: {previsao.slice(1).map(p => formatDateBR(p.iso)).join(' · ')}</Text>
            )}
            {!salvo && <Text style={styles.resAviso}>Prévia — toque em Salvar para usar em Próximos dias.</Text>}
          </View>
        )}

        <Text style={styles.label}>Empresa (opcional)</Text>
        <TextInput
          style={styles.input}
          value={cfg.empresa ?? ''}
          onChangeText={t => mudar({ empresa: t })}
          placeholder="Ex.: Minha Empresa"
          placeholderTextColor={colors.mutedDim}
          maxLength={60}
          accessibilityLabel="Empresa"
        />

        <Text style={styles.label}>Regra de pagamento</Text>
        <View style={styles.lista}>
          {REGRAS.map((r, i) => (
            <TouchableOpacity key={r} style={[styles.opcao, i < REGRAS.length - 1 && styles.borda]} onPress={() => mudar({ regra: r })} accessibilityRole="radio" accessibilityState={{ checked: cfg.regra === r }}>
              <Ionicons name={cfg.regra === r ? 'radio-button-on' : 'radio-button-off'} size={20} color={cfg.regra === r ? colors.cyan : colors.mutedDim} />
              <Text style={styles.opcaoTexto}>{LABEL_REGRA[r]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {cfg.regra === 'DIA_FIXO' && (
          <>
            <Text style={styles.label}>Dia do mês</Text>
            <Stepper valor={cfg.dia ?? 5} min={1} max={31} onChange={v => mudar({ dia: v })} sufixo={(cfg.dia ?? 5) >= 29 ? ' (em mês menor, último dia)' : ''} />
            <Text style={styles.label}>Se cair em fim de semana ou feriado</Text>
            <View style={styles.lista}>
              {AJUSTES.map((a, i) => (
                <TouchableOpacity key={a} style={[styles.opcao, i < AJUSTES.length - 1 && styles.borda]} onPress={() => mudar({ ajuste: a })} accessibilityRole="radio" accessibilityState={{ checked: cfg.ajuste === a }}>
                  <Ionicons name={cfg.ajuste === a ? 'radio-button-on' : 'radio-button-off'} size={20} color={cfg.ajuste === a ? colors.cyan : colors.mutedDim} />
                  <Text style={styles.opcaoTexto}>{LABEL_AJUSTE[a]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {cfg.regra === 'NESIMO_UTIL' && (
          <>
            <Text style={styles.label}>Qual dia útil?</Text>
            <Stepper valor={cfg.nUtil ?? 3} min={1} max={20} onChange={v => mudar({ nUtil: v })} sufixo="º dia útil do mês" />
          </>
        )}

        <Text style={styles.label}>Dias úteis</Text>
        <TouchableOpacity style={[styles.lista, styles.opcao]} onPress={() => mudar({ considerarFeriados: !cfg.considerarFeriados })} accessibilityRole="checkbox" accessibilityState={{ checked: cfg.considerarFeriados }}>
          <Ionicons name={cfg.considerarFeriados ? 'checkbox' : 'square-outline'} size={20} color={cfg.considerarFeriados ? colors.cyan : colors.mutedDim} />
          <View style={{ flex: 1 }}>
            <Text style={styles.opcaoTexto}>Considerar feriados nacionais</Text>
            <Text style={styles.opcaoSub}>Ano-Novo, Sexta-feira Santa, Tiradentes, Dia do Trabalho, Independência, Aparecida, Finados, República, Consciência Negra e Natal. Não inclui Carnaval nem feriados estaduais/municipais.</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.label}>Avisar em Próximos dias</Text>
        <View style={styles.chips}>
          {AVISO_PAGAMENTO_OPCOES.map(d => (
            <TouchableOpacity key={d} style={[styles.chip, cfg.avisoDias === d && styles.chipAtivo]} onPress={() => mudar({ avisoDias: d })} accessibilityRole="button" accessibilityState={{ selected: cfg.avisoDias === d }}>
              <Text style={[styles.chipTexto, cfg.avisoDias === d && styles.chipTextoAtivo]}>{d === 0 ? 'Não avisar' : d === 1 ? '1 dia antes' : `${d} dias antes`}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.nota}>Estimativa baseada em dias úteis e na regra cadastrada. A folha real pode mudar — confirme com a sua empresa. O OWBuddy não pede nem guarda valor de salário.</Text>

        {msg ? <Text style={styles.ok}>{msg}</Text> : null}
        <TouchableOpacity style={styles.salvar} onPress={salvar} accessibilityRole="button">
          <Text style={styles.salvarTexto}>{salvo ? 'Salvar alterações' : 'Salvar'}</Text>
        </TouchableOpacity>
        {salvo && (
          <TouchableOpacity style={styles.remover} onPress={remover} accessibilityRole="button">
            <Text style={styles.removerTexto}>Remover Meu Pagamento</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </OWBackground>
  );
}

function Stepper({ valor, min, max, onChange, sufixo }: { valor: number; min: number; max: number; onChange: (v: number) => void; sufixo?: string }) {
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.max(min, valor - 1))} accessibilityLabel="Diminuir"><Ionicons name="remove" size={20} color={colors.white} /></TouchableOpacity>
      <Text style={styles.stepValor}>{valor}<Text style={styles.stepSufixo}>{sufixo ?? ''}</Text></Text>
      <TouchableOpacity style={styles.stepBtn} onPress={() => onChange(Math.min(max, valor + 1))} accessibilityLabel="Aumentar"><Ionicons name="add" size={20} color={colors.white} /></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xxl * 2 },
  resultado: {
    padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(165, 214, 167, 0.35)',
    borderTopColor: maritime.edgeLight, backgroundColor: maritime.glassElevated,
  },
  resLabel: { ...typography.micro, color: '#a5d6a7' },
  resData: { fontSize: 28, fontWeight: '800', color: colors.white, marginTop: 2 },
  resSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  resRegra: { fontSize: 13, color: colors.white, marginTop: spacing.sm, lineHeight: 18 },
  resProx: { fontSize: 12, color: colors.muted, marginTop: 4 },
  resAviso: { fontSize: 12, color: colors.amber, marginTop: 6 },
  label: { ...typography.micro, marginTop: spacing.md, marginBottom: spacing.sm },
  input: {
    backgroundColor: maritime.glass, borderRadius: radius.md, borderWidth: 1, borderColor: maritime.glassBorder,
    paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.white, fontSize: 15,
  },
  lista: { borderRadius: radius.lg, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass, overflow: 'hidden' },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 50, paddingHorizontal: spacing.md, paddingVertical: 10 },
  borda: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: maritime.glassBorder },
  opcaoTexto: { flex: 1, fontSize: 15, color: colors.white },
  opcaoSub: { fontSize: 12, color: colors.muted, marginTop: 2, lineHeight: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center', borderRadius: radius.xl, borderWidth: 1, borderColor: maritime.glassBorder, backgroundColor: maritime.glass },
  chipAtivo: { backgroundColor: colors.cyanFaint, borderColor: colors.cyan },
  chipTexto: { fontSize: 13, fontWeight: '600', color: colors.muted },
  chipTextoAtivo: { color: colors.cyan },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: maritime.glass, borderWidth: 1, borderColor: maritime.glassBorder },
  stepValor: { fontSize: 22, fontWeight: '800', color: colors.white },
  stepSufixo: { fontSize: 13, fontWeight: '500', color: colors.muted },
  nota: { fontSize: 12, color: colors.mutedDim, marginTop: spacing.md, lineHeight: 17 },
  ok: { fontSize: 13, color: colors.green, fontWeight: '700', marginTop: spacing.md },
  salvar: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.cyan, alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  salvarTexto: { fontSize: 16, fontWeight: '700', color: colors.navy950 },
  remover: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  removerTexto: { fontSize: 14, fontWeight: '600', color: colors.red },
});
