import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapPanel, { MapChip, MapView, mapChipText } from '../components/MapPanel';
import { useApp } from '../state/AppContext';
import { colors, fonts } from '../theme';
import { timeAgo } from '../util/geo';

// Map tab — full-height hazard map for the active location
export default function MapScreen({ onOpenAlert }: { onOpenAlert: (id: string) => void }) {
  const app = useApp();
  const [mapView, setMapView] = useState<MapView>(app.settings.defaultMapView);

  return (
    <View style={styles.screen}>
      <View style={styles.titleBlock}>
        <Text style={styles.title}>Map</Text>
        <Text style={styles.subtitle}>{app.locationLabel}</Text>
      </View>

      <MapPanel center={app.center} zoom={12} view={mapView} onViewChange={setMapView} variant="amber" style={styles.map}>
        <MapChip style={{ top: 12, left: 12 }}>
          <View style={[styles.dot, { backgroundColor: app.alerts.length ? colors.mapAccent : colors.safeRing }]} />
          <Text style={mapChipText}>
            {app.alerts.length === 0
              ? 'No hazards near you'
              : `${app.alerts.length} hazard${app.alerts.length === 1 ? '' : 's'} near you`}
          </Text>
        </MapChip>
        {app.lastUpdated ? (
          <MapChip style={{ bottom: 12, left: 12, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 8 }}>
            <Text style={[mapChipText, { fontFamily: fonts.sans400 }]}>Updated {timeAgo(app.lastUpdated)}</Text>
          </MapChip>
        ) : null}
      </MapPanel>

      {/* Hazards on the map — tap to open the detail screen */}
      {app.alerts.length > 0 ? (
        <View style={styles.legend}>
          {app.alerts.slice(0, 3).map((a) => {
            const tint = a.type === 'amber' ? colors.amberDot : a.type === 'flood' ? colors.flood : colors.faint;
            return (
              <Pressable key={a.id} style={styles.legendRow} onPress={() => onOpenAlert(a.id)}>
                <View style={[styles.dot, { backgroundColor: tint }]} />
                <Text style={styles.legendText} numberOfLines={1}>
                  {a.event}
                  {a.distanceMi != null ? ` · ${a.distanceMi.toFixed(1)} mi` : ''}
                </Text>
                <Text style={[styles.legendChevron, { color: tint }]}>›</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  titleBlock: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontFamily: fonts.sora700, fontSize: 20, color: colors.ink },
  subtitle: { fontFamily: fonts.sans400, fontSize: 12.5, color: colors.muted, marginTop: 2 },
  map: { flex: 1, marginHorizontal: 20 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: { marginTop: 10, marginHorizontal: 20, gap: 8 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 13,
  },
  legendText: { flex: 1, fontFamily: fonts.sans600, fontSize: 13, color: colors.ink },
  legendChevron: { fontSize: 16 },
});
