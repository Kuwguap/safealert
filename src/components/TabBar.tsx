import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

export type TabName = 'alerts' | 'map' | 'places' | 'settings';

const TAB_ICONS: Record<TabName, { active: keyof typeof Ionicons.glyphMap; idle: keyof typeof Ionicons.glyphMap }> = {
  alerts: { active: 'notifications', idle: 'notifications-outline' },
  map: { active: 'map', idle: 'map-outline' },
  places: { active: 'bookmark', idle: 'bookmark-outline' },
  settings: { active: 'settings', idle: 'settings-outline' },
};

interface TabBarProps {
  active: TabName | null; // null while a non-tab screen (Emergency) is open
  onTab: (tab: TabName) => void;
  onSos: () => void;
}

function TabItem({ tab, label, active, onPress }: { tab: TabName; label: string; active: boolean; onPress: () => void }) {
  const icon = TAB_ICONS[tab];
  return (
    <Pressable onPress={onPress} style={styles.item} hitSlop={10}>
      <Ionicons name={active ? icon.active : icon.idle} size={20} color={active ? colors.primary : colors.inactiveIcon} />
      <Text style={[styles.label, active ? styles.labelActive : null]}>{label}</Text>
    </Pressable>
  );
}

export default function TabBar({ active, onTab, onSos }: TabBarProps) {
  return (
    <View style={styles.bar}>
      <TabItem tab="alerts" label="Alerts" active={active === 'alerts'} onPress={() => onTab('alerts')} />
      <TabItem tab="map" label="Map" active={active === 'map'} onPress={() => onTab('map')} />
      <Pressable onPress={onSos} style={styles.sosWrap} hitSlop={10}>
        <View style={styles.sosButton}>
          <Text style={styles.sosText}>SOS</Text>
        </View>
      </Pressable>
      <TabItem tab="places" label="Places" active={active === 'places'} onPress={() => onTab('places')} />
      <TabItem tab="settings" label="Settings" active={active === 'settings'} onPress={() => onTab('settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    marginTop: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
  },
  item: {
    alignItems: 'center',
    gap: 3,
    minWidth: 44,
  },
  label: {
    fontFamily: fonts.sans400,
    fontSize: 10,
    color: colors.muted,
  },
  labelActive: {
    fontFamily: fonts.sans600,
    color: colors.primary,
  },
  sosWrap: {
    marginTop: -18,
  },
  sosButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.sos,
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.sos,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  sosText: {
    fontFamily: fonts.sora800,
    fontSize: 11,
    color: '#fff',
  },
});
