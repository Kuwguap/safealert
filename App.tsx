import {
  InstrumentSans_400Regular,
  InstrumentSans_500Medium,
  InstrumentSans_600SemiBold,
} from '@expo-google-fonts/instrument-sans';
import { Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold, useFonts } from '@expo-google-fonts/sora';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import TabBar, { TabName } from './src/components/TabBar';
import AdminScreen from './src/screens/AdminScreen';
import AmberDetailScreen from './src/screens/AmberDetailScreen';
import AuthScreen from './src/screens/AuthScreen';
import EmergencyScreen from './src/screens/EmergencyScreen';
import FloodDetailScreen from './src/screens/FloodDetailScreen';
import HomeScreen from './src/screens/HomeScreen';
import MapScreen from './src/screens/MapScreen';
import PlacesScreen from './src/screens/PlacesScreen';
import PostAlertScreen from './src/screens/PostAlertScreen';
import ReportSightingScreen from './src/screens/ReportSightingScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { AppProvider, useApp } from './src/state/AppContext';
import { AuthProvider, useAuth } from './src/state/AuthContext';
import { colors, fonts } from './src/theme';

type Route =
  | { name: 'emergency' }
  | { name: 'alertDetail'; alertId: string }
  | { name: 'report' }
  | { name: 'post' }
  | { name: 'admin' };

// Web-only: keep the admin dashboard addressable at /admin
const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';
function syncAdminPath(stack: Route[]) {
  if (!isWeb) return;
  const wantsAdmin = stack.some((r) => r.name === 'admin');
  const path = wantsAdmin ? '/admin' : '/';
  if (window.location.pathname !== path) window.history.replaceState({}, '', path);
}

// Slide-down toast for anything that arrives: alerts, broadcasts, SOS notices
function AlertToast({ onOpen }: { onOpen: (id: string) => void }) {
  const app = useApp();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const notice = app.incoming;

  useEffect(() => {
    if (!notice) return;
    Animated.spring(slide, { toValue: 1, friction: 8, tension: 60, useNativeDriver: Platform.OS !== 'web' }).start();
    const timer = setTimeout(
      () => {
        Animated.timing(slide, { toValue: 0, duration: 250, useNativeDriver: Platform.OS !== 'web' }).start(() =>
          app.dismissIncoming()
        );
      },
      notice.tone === 'sos' ? 12000 : 6000 // SOS notices linger longer
    );
    return () => clearTimeout(timer);
  }, [notice]);

  if (!notice) return null;
  const palette =
    notice.tone === 'sos'
      ? { border: colors.sos, dot: colors.sos }
      : notice.tone === 'amber'
        ? { border: colors.amberBorder, dot: colors.amberDot }
        : { border: colors.floodBorder, dot: colors.flood };
  return (
    <Animated.View
      style={[
        styles.toast,
        {
          top: insets.top + 8,
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-70, 0] }) }],
        },
      ]}
    >
      <Pressable
        style={[styles.toastInner, { borderColor: palette.border }]}
        onPress={() => {
          app.dismissIncoming();
          if (notice.alertId) onOpen(notice.alertId);
        }}
      >
        <View style={[styles.toastDot, { backgroundColor: palette.dot }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.toastTitle} numberOfLines={1}>
            {notice.title}
          </Text>
          <Text style={styles.toastMeta} numberOfLines={2}>
            {notice.body}
          </Text>
        </View>
        {notice.alertId ? <Text style={styles.toastChevron}>›</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

function Root() {
  const insets = useSafeAreaInsets();
  const app = useApp();
  const auth = useAuth();
  const [tab, setTab] = useState<TabName>('alerts');
  // deep link: opening the web app at /admin lands admins on the dashboard
  const [stack, setStack] = useState<Route[]>(() =>
    isWeb && window.location.pathname === '/admin' ? [{ name: 'admin' }] : []
  );

  const setStackSynced = (updater: (s: Route[]) => Route[]) =>
    setStack((s) => {
      const next = updater(s);
      syncAdminPath(next);
      return next;
    });
  const push = (route: Route) => setStackSynced((s) => [...s, route]);
  const pop = () => setStackSynced((s) => s.slice(0, -1));
  const openAlert = (alertId: string) => push({ name: 'alertDetail', alertId });

  const top = stack[stack.length - 1];

  let content: React.ReactNode;
  let showTabBar = false;
  if (!top) {
    showTabBar = true;
    switch (tab) {
      case 'alerts':
        content = <HomeScreen onOpenAlert={openAlert} onPost={() => push({ name: 'post' })} />;
        break;
      case 'map':
        content = <MapScreen onOpenAlert={openAlert} />;
        break;
      case 'places':
        content = <PlacesScreen />;
        break;
      case 'settings':
        content = <SettingsScreen onOpenAdmin={() => push({ name: 'admin' })} />;
        break;
    }
  } else if (top.name === 'emergency') {
    showTabBar = true;
    content = <EmergencyScreen />;
  } else if (top.name === 'admin') {
    content =
      auth.user?.role === 'admin' ? (
        <AdminScreen onBack={pop} />
      ) : (
        <View style={styles.adminDenied}>
          <Text style={styles.adminDeniedTitle}>Admins only</Text>
          <Text style={styles.adminDeniedText}>Sign in with an admin account to open the dashboard.</Text>
          <Pressable onPress={pop} hitSlop={8}>
            <Text style={styles.adminDeniedLink}>Go back</Text>
          </Pressable>
        </View>
      );
  } else if (top.name === 'post') {
    content = <PostAlertScreen onBack={pop} />;
  } else if (top.name === 'alertDetail') {
    const alert = app.alerts.find((a) => a.id === top.alertId);
    if (!alert) {
      content = null;
      setTimeout(pop, 0);
    } else if (alert.type === 'amber') {
      content = <AmberDetailScreen alert={alert} onBack={pop} onReport={() => push({ name: 'report' })} />;
    } else {
      content = <FloodDetailScreen alert={alert} onBack={pop} />;
    }
  } else {
    content = <ReportSightingScreen onBack={pop} />;
  }

  const emergencyOpen = top?.name === 'emergency';

  return (
    <View style={[styles.app, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 10) }]}>
      {content}
      {showTabBar ? (
        <TabBar
          active={emergencyOpen ? null : tab}
          onTab={(t) => {
            setStackSynced(() => []);
            setTab(t);
          }}
          onSos={() => {
            if (!emergencyOpen) setStackSynced(() => [{ name: 'emergency' }]);
          }}
        />
      ) : null}
      <AlertToast onOpen={openAlert} />
    </View>
  );
}

function Gate() {
  const auth = useAuth();
  if (!auth.ready) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }
  if (!auth.user) {
    return <AuthScreen />;
  }
  return (
    <AppProvider>
      <Root />
    </AppProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Sora_600SemiBold,
    Sora_700Bold,
    Sora_800ExtraBold,
    InstrumentSans_400Regular,
    InstrumentSans_500Medium,
    InstrumentSans_600SemiBold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  toastDot: { width: 9, height: 9, borderRadius: 5 },
  toastTitle: { fontFamily: fonts.sora600, fontSize: 13.5, color: colors.ink },
  toastMeta: { fontFamily: fonts.sans400, fontSize: 11.5, color: colors.muted, marginTop: 1 },
  toastChevron: { fontSize: 16, color: colors.primary },
  adminDenied: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 30 },
  adminDeniedTitle: { fontFamily: fonts.sora700, fontSize: 18, color: colors.ink },
  adminDeniedText: { fontFamily: fonts.sans400, fontSize: 13, color: colors.muted, textAlign: 'center' },
  adminDeniedLink: { fontFamily: fonts.sans600, fontSize: 13, color: colors.primary, marginTop: 6 },
});
