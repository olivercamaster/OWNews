// Analytics foundation — privacy-first event logging.
// Phase 1: logs to console only (no external service, zero cost).
// Phase 2 (future): wire to PostHog/Amplitude after user consent.
//
// NEVER log: nicknames, checklist content, localizador, obs, assento, poltrona,
// documents, trip details, or any user-typed text.

type EventName =
  | 'screen_view'
  // Retorno ao app (sem id de usuário/aparelho: só o evento, para contar uso, nunca para rastrear)
  | 'app_open'
  | 'aparencia_alterada'
  | 'scale_configured'
  | 'checklist_item_created'
  | 'checklist_reset'
  | 'trip_created'
  | 'trip_updated'
  | 'trip_deleted'
  | 'trip_map_opened'
  // Contatos do embarque e mala — só a AÇÃO, nunca nome, telefone ou texto do item.
  | 'contact_created'
  | 'contact_updated'
  | 'contact_deleted'
  | 'contact_call'
  | 'contact_whatsapp'
  | 'checklist_item_updated'
  | 'checklist_item_deleted'
  | 'share_scale'
  | 'certificate_created'
  | 'certificate_deleted'
  | 'city_configured'
  | 'buddy_prefs_saved'
  | 'offline_session_start'
  | 'sync_completed'
  | 'sync_failed'
  | 'weather_fetched'
  | 'weather_cache_hit'
  | 'news_opened'
  | 'news_open'
  | 'news_share'
  | 'news_source_open'
  | 'vaga_opened'
  | 'aeroportos_web_opened'
  | 'unidade_opened'
  | 'unidade_radar_web_opened'
  | 'weather_city_selected'
  | 'city_searched'
  | 'ferramentas_opened'
  | 'converter_used'
  | 'conta_login_senha'
  | 'conta_login_otp'
  | 'conta_logout'
  | 'conta_cadastro'
  | 'conta_recuperar_senha'
  | 'lembretes_ativados'
  | 'lembretes_desativados'
  | 'lembrete_aberto'
  // Camada parceiro pessoal — só tipo/ação, NUNCA nome, pessoa, relação, empresa, título ou obs.
  | 'event_created'
  | 'event_updated'
  | 'event_deleted'
  | 'payment_rule_configured'
  | 'payment_rule_removed'
  | 'transport_opened'
  | 'gift_ideas_opened'
  | 'preciso_de_opened'
  | 'proximos_opened'
  // Home personalizável — sem nome, cidade ou frase
  | 'home_customize_open'
  | 'home_module_hidden'
  | 'home_module_shown'
  | 'home_module_reordered'
  | 'home_module_size_changed'
  | 'home_preset_applied'
  | 'home_layout_reset'
  | 'greeting_style_changed'
  | 'daily_phrase_toggled'
  | 'weather_enabled'
  | 'weather_disabled'
  // Meu Histórico — só a AÇÃO (e o tipo do acontecimento). NUNCA unidade, empresa, função,
  // datas, hotel, voo, observação ou qualquer texto do registro.
  | 'historico_aberto'
  | 'embarque_registrado'
  | 'embarque_editado'
  | 'embarque_excluido'
  | 'acontecimento_registrado'
  | 'acontecimento_editado'
  | 'acontecimento_excluido'
  // OWBuddy+ — só a AÇÃO e valores fixos (origem/recurso/resultado). NUNCA preço, moeda,
  // token, recibo, ID de pedido, conta da loja ou qualquer dado de pagamento.
  | 'plus_tela_aberta'
  | 'plus_bloqueio_visto'
  | 'plus_agora_nao'
  | 'plus_cta_tocado'
  | 'plus_compra_resultado'
  | 'plus_restaurar_resultado'
  | 'plus_gerenciar_aberto'
  // Período Premium de 45 dias: só qual aviso e qual escolha (nenhum dado da pessoa)
  | 'premium_trial_iniciado'
  | 'premium_perto_conhecer'
  | 'premium_perto_ok'
  | 'premium_fim_conhecer'
  | 'premium_fim_continuar_free'
  // Minha Mala: reordenar item
  | 'checklist_item_moved';

type EventProps = Record<string, string | number | boolean | null>;

let _isOfflineSession = false;

export const analytics = {
  track(event: EventName, props?: EventProps): void {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(`[analytics] ${event}`, props ?? '');
    }
    // TODO Phase 2: forward to analytics provider here
  },

  screen(name: string): void {
    analytics.track('screen_view', { screen: name });
  },

  markOffline(): void {
    if (!_isOfflineSession) {
      _isOfflineSession = true;
      analytics.track('offline_session_start');
    }
  },

  markOnline(): void {
    _isOfflineSession = false;
  },
};
