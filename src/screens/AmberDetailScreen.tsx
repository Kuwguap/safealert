import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { ActiveAlert } from '../api/nws';
import MapPanel, { MapChip, MapView, mapChipText } from '../components/MapPanel';
import { BackHeader, Card, LivePill } from '../components/ui';
import { useApp } from '../state/AppContext';
import { colors, fonts } from '../theme';
import { timeAgo } from '../util/geo';

// 1b. AMBER alert detail — live "Child Abduction Emergency" data.
// Child/vehicle specifics and photos arrive in the alert description text;
// dedicated photo payloads come with the production alert feed integration.
export default function AmberDetailScreen({
  alert,
  onBack,
  onReport,
}: {
  alert: ActiveAlert;
  onBack: () => void;
  onReport: () => void;
}) {
  const app = useApp();
  const [mapView, setMapView] = useState<MapView>(app.settings.defaultMapView);
  const center = alert.centroid ?? app.center;

  return (
    <View style={styles.screen}>
      <BackHeader
        title="Active alert"
        subtitle={`${alert.areaDesc.split(';')[0]} · issued ${timeAgo(alert.sent)}`}
        subtitleColor={colors.amberMeta}
        onBack={onBack}
        right={<LivePill bg={colors.amberBg} border={colors.amberBorder} color={colors.primaryDeep} />}
      />

      <View style={styles.body}>
        {/* Who to look for — from the alert bulletin */}
        <Card style={styles.descCard}>
          <Text style={styles.eventName}>{alert.event}</Text>
          <Text style={styles.headline} numberOfLines={2}>
            {alert.headline.split(' by NWS')[0]}
          </Text>
          {alert.imageUrl ? <Image source={{ uri: alert.imageUrl }} style={styles.photo} resizeMode="cover" /> : null}
          <ScrollView style={styles.descScroll}>
            <Text style={styles.descText}>
              {alert.description.trim() || 'Details are being distributed by the issuing agency.'}
            </Text>
            {alert.instruction ? <Text style={styles.instruction}>{alert.instruction.trim()}</Text> : null}
          </ScrollView>
          <View style={styles.tagRow}>
            <View style={styles.sourceTag}>
              <Text style={styles.sourceTagText}>{alert.senderName}</Text>
            </View>
          </View>
        </Card>

        {/* Alert-area map */}
        <MapPanel center={center} zoom={12} view={mapView} onViewChange={setMapView} variant="amber" style={styles.map}>
          <MapChip style={{ top: 12, left: 12, paddingVertical: 6, paddingHorizontal: 11, borderRadius: 8 }}>
            <Text style={mapChipText} numberOfLines={1}>
              Alert area · {alert.areaDesc.split(';')[0]}
            </Text>
          </MapChip>
        </MapPanel>
      </View>

      {/* Action row */}
      <View style={styles.actions}>
        <Pressable style={styles.primaryBtn} onPress={onReport}>
          <Text style={styles.primaryBtnText}>I saw something</Text>
        </Pressable>
        <Pressable
          style={styles.shareBtn}
          onPress={() => Share.share({ message: `${alert.headline}\n\n${alert.description}`.slice(0, 800) }).catch(() => {})}
        >
          <Text style={styles.shareIcon}>⤴</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: {
    flex: 1,
    paddingTop: 4,
    paddingHorizontal: 20,
    gap: 12,
  },
  descCard: { padding: 14 },
  eventName: {
    fontFamily: fonts.sans600,
    fontSize: 11.5,
    letterSpacing: 1.15,
    textTransform: 'uppercase',
    color: colors.primary,
    marginBottom: 6,
  },
  headline: { fontFamily: fonts.sora700, fontSize: 17, color: colors.ink },
  photo: { width: '100%', height: 160, borderRadius: 12, marginTop: 10, backgroundColor: colors.insetBg },
  descScroll: { maxHeight: 150, marginTop: 6 },
  descText: {
    fontFamily: fonts.sans400,
    fontSize: 13,
    lineHeight: 18.85,
    color: colors.bodySoft,
  },
  instruction: {
    fontFamily: fonts.sans600,
    fontSize: 13,
    lineHeight: 18.85,
    color: colors.body,
    marginTop: 8,
  },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  sourceTag: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    backgroundColor: colors.amberBg,
    borderRadius: 999,
  },
  sourceTagText: { fontFamily: fonts.sans600, fontSize: 11, color: colors.primaryDeep },

  map: { flex: 1, minHeight: 170 },

  actions: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 15,
    backgroundColor: colors.primary,
    borderRadius: 13,
    alignItems: 'center',
  },
  primaryBtnText: { fontFamily: fonts.sora700, fontSize: 15, color: '#fff' },
  shareBtn: {
    width: 54,
    borderWidth: 1.5,
    borderColor: colors.outlineEmphasis,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareIcon: { fontSize: 17, color: colors.bodySoft },
});
