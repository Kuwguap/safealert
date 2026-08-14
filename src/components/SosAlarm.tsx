import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer } from 'expo-audio';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Linking, Modal, Platform, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { ActivityEvent } from '../api/community';
import { colors, fonts } from '../theme';
import { timeAgo } from '../util/geo';

// Full-screen SOS alarm shown to emergency contacts: red pulsing screen with
// a looping siren + vibration that continues until "Stop alarm" is pressed.

const USE_NATIVE = Platform.OS !== 'web';

function PulseCircle() {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(t, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE })
    );
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <Animated.View
      style={[
        styles.pulse,
        {
          opacity: t.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.7, 0] }),
          transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2.1] }) }],
        },
      ]}
    />
  );
}

export default function SosAlarm({ event, onDismiss }: { event: ActivityEvent; onDismiss: () => void }) {
  const player = useAudioPlayer(require('../../assets/sos-beep.wav'));

  useEffect(() => {
    try {
      player.loop = true;
      player.volume = 1;
      player.play(); // web may block autoplay without a gesture — visual + vibration still fire
    } catch {}
    if (Platform.OS !== 'web') Vibration.vibrate([600, 400], true);
    return () => {
      try {
        player.pause();
      } catch {}
      if (Platform.OS !== 'web') Vibration.cancel();
    };
  }, [player]);

  const openLocation = () => {
    Linking.openURL(`https://maps.google.com/?q=${event.lat.toFixed(5)},${event.lon.toFixed(5)}`).catch(() => {});
  };

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.screen}>
        <View style={styles.center}>
          <View style={styles.iconWrap}>
            <PulseCircle />
            <PulseCircle />
            <View style={styles.iconCircle}>
              <Ionicons name="alert" size={44} color="#fff" />
            </View>
          </View>
          <Text style={styles.title}>SOS</Text>
          <Text style={styles.who}>{event.user} needs help</Text>
          <Text style={styles.meta}>
            {event.locationLabel || 'Location shared'} · {timeAgo(event.ts)}
          </Text>
          {event.detail ? <Text style={styles.detail}>{event.detail}</Text> : null}
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.mapBtn} onPress={openLocation}>
            <Ionicons name="location" size={18} color="#fff" />
            <Text style={styles.mapBtnText}>Open live location in Maps</Text>
          </Pressable>
          <Pressable style={styles.stopBtn} onPress={onDismiss}>
            <Text style={styles.stopBtnText}>Stop alarm</Text>
          </Pressable>
          <Text style={styles.hint}>The alarm keeps sounding until you stop it.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#8f1710',
    justifyContent: 'space-between',
    padding: 28,
    paddingTop: 80,
    paddingBottom: 44,
  },
  center: { alignItems: 'center', gap: 6 },
  iconWrap: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  pulse: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#ffb4ab',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.sos,
    borderWidth: 3,
    borderColor: '#ffd9d5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: fonts.sora800, fontSize: 40, color: '#fff', letterSpacing: 4 },
  who: { fontFamily: fonts.sora700, fontSize: 20, color: '#ffe9e7', textAlign: 'center' },
  meta: { fontFamily: fonts.sans500, fontSize: 13.5, color: '#ffc9c4', textAlign: 'center', marginTop: 2 },
  detail: { fontFamily: fonts.sans400, fontSize: 12.5, color: '#ffb4ab', textAlign: 'center', marginTop: 8 },
  actions: { gap: 12 },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 15,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 14,
  },
  mapBtnText: { fontFamily: fonts.sora600, fontSize: 15, color: '#fff' },
  stopBtn: {
    paddingVertical: 17,
    backgroundColor: '#fff',
    borderRadius: 14,
    alignItems: 'center',
  },
  stopBtnText: { fontFamily: fonts.sora700, fontSize: 16, color: colors.sos },
  hint: { fontFamily: fonts.sans400, fontSize: 11.5, color: '#ffb4ab', textAlign: 'center' },
});
