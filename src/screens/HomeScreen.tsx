import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapPanel, { MapChip, MapView, mapChipText } from '../components/MapPanel';
import { Card } from '../components/ui';
import { useApp } from '../state/AppContext';
import { colors, fonts } from '../theme';
import { timeAgo } from '../util/geo';

interface HomeScreenProps {
  onOpenAlert: (alertId: string) => void;
  onPost: () => void;
}

// 2a. Home — unified, location-aware alert feed
export default function HomeScreen({ onOpenAlert, onPost }: HomeScreenProps) {
  const app = useApp();
  const [mapView, setMapView] = useState<MapView>(app.settings.defaultMapView);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await app.refresh();
    setRefreshing(false);
  };

  const hazardText =
    app.alerts.length === 0
      ? 'No hazards near you'
      : `${app.alerts.length} hazard${app.alerts.length === 1 ? '' : 's'} near you`;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.scrollBody}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      {/* Header: logo + location pill (opens location switcher) */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoMark}>
            <View style={styles.logoDot} />
          </View>
          <Text style={styles.logoText}>SafeAlert</Text>
        </View>
        <Pressable style={styles.locationPill} onPress={() => setLocationsOpen(true)} hitSlop={8}>
          <View style={styles.locationDot} />
          <Text style={styles.locationText} numberOfLines={1}>
            {app.locationLabel}
          </Text>
          <Text style={styles.locationChevron}>▾</Text>
        </Pressable>
      </View>

      {/* Location fallback banner — tap to retry GPS */}
      {app.locationSource === 'fallback' ? (
        <Pressable style={styles.fallbackBanner} onPress={app.retryLocation}>
          <Text style={styles.fallbackText}>
            Couldn't get your location — showing the default area. Tap to try again.
          </Text>
        </Pressable>
      ) : null}

      {/* Weather card — Open-Meteo, for the active location */}
      <Card style={styles.weatherCard}>
        {app.weather ? (
          <>
            <View>
              <Text style={styles.weatherTemp}>{app.weather.currentTemp}</Text>
              <Text style={styles.weatherCondition}>{app.weather.condition}</Text>
            </View>
            <View style={styles.hourlyRow}>
              {app.weather.hourly.map((h, i) => (
                <View key={`${h.time}-${i}`} style={styles.hourlyCol}>
                  <Text style={styles.hourlyTime}>{h.time}</Text>
                  <Text style={[styles.hourlyTemp, h.cooling && { color: colors.flood }]}>{h.temp}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.weatherLoading}>
            {app.loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.weatherCondition}>Weather unavailable</Text>
            )}
          </View>
        )}
      </Card>

      {/* Alert stack — live NWS alerts for the active location */}
      <View style={styles.alertStack}>
        {app.error ? (
          <View style={[styles.alertCard, styles.emptyCard]}>
            <Text style={styles.emptyText}>{app.error}</Text>
          </View>
        ) : app.alerts.length === 0 ? (
          <View style={[styles.alertCard, styles.emptyCard]}>
            <View style={[styles.alertDot, { backgroundColor: colors.safeRing }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.alertTitle, { color: colors.safeDeep }]}>
                {app.loading ? 'Checking for alerts…' : 'No active alerts in your area'}
              </Text>
              {!app.loading && app.lastUpdated ? (
                <Text style={[styles.alertMeta, { color: colors.safeMeta }]}>
                  GDACS + NWS feeds · checked {timeAgo(app.lastUpdated)}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          app.alerts.slice(0, 3).map((alert) => {
            const amber = alert.type === 'amber';
            const flood = alert.type === 'flood';
            const palette = amber
              ? { bg: colors.amberBg, border: colors.amberBorder, title: colors.amberDeep, meta: colors.amberMeta, dot: colors.amberDot, chev: colors.primary }
              : flood
                ? { bg: colors.floodBg, border: colors.floodBorder, title: colors.floodDeep, meta: colors.floodMeta, dot: colors.flood, chev: colors.flood }
                : { bg: colors.card, border: colors.cardBorder, title: colors.ink, meta: colors.muted, dot: colors.faint, chev: colors.muted };
            const metaParts = [alert.areaDesc.split(';')[0], timeAgo(alert.sent)];
            if (alert.distanceMi != null) metaParts.push(`${alert.distanceMi.toFixed(1)} mi from you`);
            return (
              <Pressable
                key={alert.id}
                onPress={() => onOpenAlert(alert.id)}
                style={[styles.alertCard, { backgroundColor: palette.bg, borderColor: palette.border }]}
              >
                <View
                  style={[
                    styles.alertDot,
                    { backgroundColor: palette.dot },
                    amber && {
                      shadowColor: colors.amberGlow,
                      shadowOpacity: 1,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 0 },
                      elevation: 3,
                    },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.alertTitle, { color: palette.title }]} numberOfLines={1}>
                    {alert.event}
                  </Text>
                  <Text style={[styles.alertMeta, { color: palette.meta }]} numberOfLines={1}>
                    {metaParts.filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <Text style={[styles.alertChevron, { color: palette.chev }]}>›</Text>
              </Pressable>
            );
          })
        )}
      </View>

      {/* Map panel — centered on the active location */}
      <MapPanel center={app.center} view={mapView} onViewChange={setMapView} variant="amber" style={styles.map}>
        <MapChip style={{ bottom: 12, left: 12 }}>
          <View style={[styles.hazardDot, app.alerts.length === 0 && { backgroundColor: colors.safeRing, shadowColor: colors.safeRing }]} />
          <Text style={mapChipText}>{hazardText}</Text>
        </MapChip>
      </MapPanel>

      {/* Post-to-community FAB */}
      <Pressable style={styles.fab} onPress={onPost}>
        <Ionicons name="add" size={26} color="#fff" />
      </Pressable>

      {/* Location switcher: current GPS + saved places (managed in Places tab) */}
      <Modal visible={locationsOpen} transparent animationType="fade" onRequestClose={() => setLocationsOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setLocationsOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Locations</Text>
            <Pressable
              style={[styles.sheetRow, app.activePlaceId === null && styles.sheetRowSelected]}
              onPress={() => {
                app.setActivePlace(null);
                setLocationsOpen(false);
              }}
            >
              <View style={[styles.sheetDot, { backgroundColor: app.activePlaceId === null ? colors.primary : colors.inactiveIcon }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetLabel}>Current location</Text>
                <Text style={styles.sheetPlace}>{app.locationSource === 'fallback' ? 'Location unavailable — using default area' : 'Follows your GPS position'}</Text>
              </View>
              {app.activePlaceId === null ? <Text style={styles.sheetCheck}>✓</Text> : null}
            </Pressable>
            {app.places.map((loc) => {
              const selected = loc.id === app.activePlaceId;
              return (
                <Pressable
                  key={loc.id}
                  style={[styles.sheetRow, selected && styles.sheetRowSelected]}
                  onPress={() => {
                    app.setActivePlace(loc.id);
                    setLocationsOpen(false);
                  }}
                >
                  <View style={[styles.sheetDot, { backgroundColor: selected ? colors.primary : colors.inactiveIcon }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sheetLabel}>{loc.label}</Text>
                    <Text style={styles.sheetPlace}>{loc.place}</Text>
                  </View>
                  {selected ? <Text style={styles.sheetCheck}>✓</Text> : null}
                </Pressable>
              );
            })}
            {app.places.length === 0 ? (
              <Text style={styles.sheetHint}>Save places you care about from the Places tab.</Text>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollBody: { flexGrow: 1 },
  fab: {
    position: 'absolute',
    right: 30,
    bottom: 26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  logoMark: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.logoDot },
  logoText: { fontFamily: fonts.sora700, fontSize: 16, color: colors.ink },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 999,
    flexShrink: 1,
  },
  locationDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  locationText: { fontFamily: fonts.sans600, fontSize: 12, color: colors.body, flexShrink: 1 },
  locationChevron: { fontSize: 10, color: colors.faint },

  fallbackBanner: {
    marginHorizontal: 20,
    marginBottom: 8,
    paddingVertical: 9,
    paddingHorizontal: 13,
    backgroundColor: colors.amberBg,
    borderWidth: 1,
    borderColor: colors.amberBorder,
    borderRadius: 11,
  },
  fallbackText: { fontFamily: fonts.sans500, fontSize: 12, color: colors.amberDeep },

  weatherCard: {
    marginHorizontal: 20,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 66,
  },
  weatherLoading: { flex: 1, alignItems: 'center' },
  weatherTemp: { fontFamily: fonts.sora700, fontSize: 24, color: colors.ink },
  weatherCondition: { fontFamily: fonts.sans400, fontSize: 11.5, color: colors.muted },
  hourlyRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 6,
    borderLeftWidth: 1,
    borderLeftColor: colors.cardBorder,
  },
  hourlyCol: { alignItems: 'center', gap: 2 },
  hourlyTime: { fontFamily: fonts.sans400, fontSize: 10.5, color: colors.faint },
  hourlyTemp: { fontFamily: fonts.sans600, fontSize: 12.5, color: colors.body },

  alertStack: { marginTop: 10, marginHorizontal: 20, gap: 8 },
  alertCard: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  emptyCard: { backgroundColor: colors.safeBg, borderColor: colors.safeBorder },
  emptyText: { flex: 1, fontFamily: fonts.sans400, fontSize: 12.5, color: colors.bodySoft },
  alertDot: { width: 8, height: 8, borderRadius: 4 },
  alertTitle: { fontFamily: fonts.sora600, fontSize: 13.5 },
  alertMeta: { fontFamily: fonts.sans400, fontSize: 11.5, marginTop: 1 },
  alertChevron: { fontSize: 16 },

  map: { marginTop: 10, marginHorizontal: 20, flex: 1, minHeight: 150 },
  hazardDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.mapAccent,
    shadowColor: colors.mapAccent,
    shadowOpacity: 1,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(35,26,16,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 34,
    gap: 8,
  },
  sheetTitle: { fontFamily: fonts.sora700, fontSize: 16, color: colors.ink, marginBottom: 6 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 11,
    backgroundColor: colors.insetBg,
  },
  sheetRowSelected: { borderWidth: 1.5, borderColor: colors.primary },
  sheetDot: { width: 8, height: 8, borderRadius: 4 },
  sheetLabel: { fontFamily: fonts.sans600, fontSize: 13.5, color: colors.ink },
  sheetPlace: { fontFamily: fonts.sans400, fontSize: 11.5, color: colors.muted },
  sheetCheck: { fontSize: 14, color: colors.primary },
  sheetHint: { fontFamily: fonts.sans400, fontSize: 11.5, color: colors.faint, paddingHorizontal: 4 },
});
