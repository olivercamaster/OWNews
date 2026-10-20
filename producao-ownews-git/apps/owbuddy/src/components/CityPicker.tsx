/**
 * Escolha MANUAL da cidade do clima da Home (nunca GPS). Busca por nome (Open-Meteo
 * geocoding, src/geocoding.ts) + cidades frequentes offline.
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, surface, typography, themed } from '../theme';
import { useTema } from '../tema';
import { CITIES, type City } from '../cities';
import { searchCities } from '../geocoding';
import { analytics } from '../analytics';

export function CityPicker({ visivel, cidadeAtual, onEscolher, onFechar }: {
  visivel: boolean;
  cidadeAtual: City | null;
  onEscolher: (c: City) => void;
  onFechar: () => void;
}) {
  useTema();
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [citySearching, setCitySearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (visivel) { setCityQuery(''); setCityResults([]); } }, [visivel]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (cityQuery.trim().length < 2) { setCityResults([]); setCitySearching(false); return; }
    setCitySearching(true);
    searchTimer.current = setTimeout(async () => {
      analytics.track('city_searched', { query_length: cityQuery.trim().length });
      setCityResults(await searchCities(cityQuery));
      setCitySearching(false);
    }, 350);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [cityQuery]);

  const escolher = (c: City) => onEscolher(c);

  return (
      <Modal visible={visivel} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => onFechar()} style={{ zIndex: 999 }}>
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Buscar cidade</Text>
            <TouchableOpacity onPress={() => onFechar()} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={16} color={colors.mutedDim} />
            <TextInput
              style={styles.searchInput}
              value={cityQuery}
              onChangeText={setCityQuery}
              placeholder="Digite o nome da cidade..."
              placeholderTextColor={colors.mutedDim}
              autoFocus
              autoCorrect={false}
            />
            {citySearching && <ActivityIndicator size="small" color={colors.cyan} />}
            {!citySearching && cityQuery.length > 0 && (
              <TouchableOpacity onPress={() => setCityQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.mutedDim} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            data={cityResults.length > 0 ? cityResults : CITIES}
            keyExtractor={c => `${c.name}-${c.lat}-${c.lon}`}
            ListHeaderComponent={cityResults.length === 0 && cityQuery.length < 2
              ? <Text style={styles.modalSub}>Cidades frequentes — ou busque qualquer cidade</Text>
              : cityResults.length === 0 && cityQuery.length >= 2 && !citySearching
              ? <Text style={styles.modalSub}>Nenhuma cidade encontrada</Text>
              : null
            }
            renderItem={({ item: c }) => (
              <TouchableOpacity
                style={[styles.cityRow, cidadeAtual?.name === c.name && styles.cityRowActive]}
                onPress={() => escolher(c)}
              >
                <Text style={[styles.cityName, cidadeAtual?.name === c.name && styles.cityNameActive]}>{c.name}</Text>
                <Text style={styles.cityState}>{c.state}</Text>
                {cidadeAtual?.name === c.name && (
                  <Ionicons name="checkmark" size={18} color={colors.cyan} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  modalRoot: { flex: 1, backgroundColor: surface.header },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  modalTitle: { ...typography.h2 },
  modalSub: { ...typography.small, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, color: colors.mutedDim },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    backgroundColor: surface.card,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.white,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
    gap: spacing.sm,
  },
  cityRowActive: { backgroundColor: colors.cyanFaint },
  cityName: { flex: 1, fontSize: 15, color: colors.white, fontWeight: '500' },
  cityNameActive: { color: colors.cyan },
  cityState: { fontSize: 13, color: colors.mutedDim, width: 24 },
}));
