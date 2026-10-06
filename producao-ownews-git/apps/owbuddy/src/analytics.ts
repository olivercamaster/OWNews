// Analytics foundation — privacy-first event logging.
// Phase 1: logs to console only (no external service, zero cost).
// Phase 2 (future): wire to PostHog/Amplitude after user consent.
//
// NEVER log: nicknames, checklist content, localizador, obs, assento, poltrona,
// documents, trip details, or any user-typed text.

type EventName =
  | 'screen_view'
  | 'scale_configured'
  | 'checklist_item_created'
  | 'checklist_reset'
  | 'trip_created'
  | 'trip_deleted'
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
  | 'weather_city_selected'
  | 'city_searched'
  | 'ferramentas_opened'
  | 'converter_used'
  | 'conta_login_senha'
  | 'conta_login_otp'
  | 'conta_logout';

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
