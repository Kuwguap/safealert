import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { EmergencyContact, Role, useAuth } from '../state/AuthContext';
import { colors, fonts } from '../theme';

// Login / signup — local demo accounts (see AuthContext). Signup collects
// emergency contacts: they're dialed / notified in-app when your SOS fires.
export default function AuthScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [asAdmin, setAsAdmin] = useState(false);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addContact = () => {
    if (!cName.trim() || !cPhone.trim()) {
      setError('A contact needs at least a name and phone number.');
      return;
    }
    setError(null);
    setContacts((c) => [...c, { name: cName.trim(), phone: cPhone.trim(), email: cEmail.trim().toLowerCase() }].slice(0, 3));
    setCName('');
    setCPhone('');
    setCEmail('');
  };

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const role: Role = asAdmin ? 'admin' : 'user';
    // Fold in a contact the user typed but didn't tap "Add" on, so signup
    // doesn't wrongly claim there are no contacts.
    let effectiveContacts = contacts;
    if (mode === 'signup' && cName.trim() && cPhone.trim()) {
      effectiveContacts = [
        ...contacts,
        { name: cName.trim(), phone: cPhone.trim(), email: cEmail.trim().toLowerCase() },
      ].slice(0, 3);
      setContacts(effectiveContacts);
      setCName('');
      setCPhone('');
      setCEmail('');
    }
    const err =
      mode === 'login'
        ? await auth.signIn(email, password)
        : await auth.signUp(name, email, password, role, effectiveContacts);
    if (err) setError(err);
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Brand */}
        <View style={styles.brand}>
          <View style={styles.logoMark}>
            <View style={styles.logoDot} />
          </View>
          <Text style={styles.logoText}>SafeAlert</Text>
        </View>
        <Text style={styles.tagline}>Every second counts. Every alert matters.</Text>

        <View style={styles.card}>
          {/* Mode switch */}
          <View style={styles.segmentRow}>
            {(['login', 'signup'] as const).map((m) => (
              <Pressable
                key={m}
                style={[styles.segment, mode === m && styles.segmentActive]}
                onPress={() => {
                  setMode(m);
                  setError(null);
                }}
              >
                <Text style={[styles.segmentText, mode === m && styles.segmentTextActive]}>
                  {m === 'login' ? 'Log in' : 'Sign up'}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === 'signup' ? (
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor={colors.faint}
              autoCapitalize="words"
            />
          ) : null}
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.faint}
            secureTextEntry
          />

          {mode === 'signup' ? (
            <View style={styles.contactsBlock}>
              <Text style={styles.contactsTitle}>Emergency contacts</Text>
              <Text style={styles.contactsMeta}>
                Dialed and notified when your SOS goes off. Fill in one below — include their SafeAlert email so
                they get in-app alerts. Tap "Add" only to include more than one.
              </Text>
              {contacts.map((c, i) => (
                <View key={`${c.phone}-${i}`} style={styles.contactChip}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{c.name} · {c.phone}</Text>
                    {c.email ? <Text style={styles.contactEmail}>{c.email}</Text> : null}
                  </View>
                  <Pressable onPress={() => setContacts((list) => list.filter((_, j) => j !== i))} hitSlop={8}>
                    <Text style={styles.contactRemove}>✕</Text>
                  </Pressable>
                </View>
              ))}
              {contacts.length < 3 ? (
                <>
                  <View style={styles.contactRow}>
                    <TextInput
                      style={[styles.input, styles.contactInput]}
                      value={cName}
                      onChangeText={setCName}
                      placeholder="Name"
                      placeholderTextColor={colors.faint}
                    />
                    <TextInput
                      style={[styles.input, styles.contactInput]}
                      value={cPhone}
                      onChangeText={setCPhone}
                      placeholder="Phone"
                      placeholderTextColor={colors.faint}
                      keyboardType="phone-pad"
                    />
                  </View>
                  <View style={styles.contactRow}>
                    <TextInput
                      style={[styles.input, styles.contactInput]}
                      value={cEmail}
                      onChangeText={setCEmail}
                      placeholder="SafeAlert email (optional)"
                      placeholderTextColor={colors.faint}
                      autoCapitalize="none"
                      keyboardType="email-address"
                    />
                    <Pressable style={styles.contactAdd} onPress={addContact}>
                      <Text style={styles.contactAddText}>Add</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          {mode === 'signup' ? (
            <View style={styles.adminRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminTitle}>Admin account</Text>
                <Text style={styles.adminMeta}>Publish bulletins & run smoke tests (demo)</Text>
              </View>
              <Switch
                value={asAdmin}
                onValueChange={setAsAdmin}
                trackColor={{ true: colors.primary, false: colors.inactiveIcon }}
                thumbColor="#fff"
              />
            </View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.submit} onPress={submit}>
            {busy ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitText}>{mode === 'login' ? 'Log in' : 'Create account'}</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footnote}>
          Accounts are stored on this device for the demo — production uses the proposal's Firebase auth.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  body: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.logoDot },
  logoText: { fontFamily: fonts.sora700, fontSize: 24, color: colors.ink },
  tagline: {
    fontFamily: fonts.sans400,
    fontSize: 12.5,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.insetBg,
    borderRadius: 11,
    padding: 4,
    marginBottom: 4,
  },
  segment: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { fontFamily: fonts.sans600, fontSize: 13, color: colors.bodySoft },
  segmentTextActive: { color: '#fff' },
  input: {
    paddingVertical: 12,
    paddingHorizontal: 13,
    backgroundColor: colors.insetBg,
    borderRadius: 11,
    fontFamily: fonts.sans400,
    fontSize: 14,
    color: colors.ink,
  },
  contactsBlock: {
    gap: 8,
    padding: 12,
    backgroundColor: colors.insetBg,
    borderRadius: 13,
  },
  contactsTitle: { fontFamily: fonts.sans600, fontSize: 13, color: colors.ink },
  contactsMeta: { fontFamily: fonts.sans400, fontSize: 11, lineHeight: 15.4, color: colors.muted },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 11,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
  },
  contactName: { fontFamily: fonts.sans600, fontSize: 12.5, color: colors.ink },
  contactEmail: { fontFamily: fonts.sans400, fontSize: 11, color: colors.muted },
  contactRemove: { fontSize: 13, color: colors.sos },
  contactRow: { flexDirection: 'row', gap: 8 },
  contactInput: { flex: 1, backgroundColor: colors.card },
  contactAdd: {
    paddingHorizontal: 18,
    backgroundColor: colors.primary,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAddText: { fontFamily: fonts.sans600, fontSize: 13, color: '#fff' },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  adminTitle: { fontFamily: fonts.sans600, fontSize: 13, color: colors.ink },
  adminMeta: { fontFamily: fonts.sans400, fontSize: 11, color: colors.muted },
  error: { fontFamily: fonts.sans500, fontSize: 12.5, color: colors.sos },
  submit: {
    marginTop: 4,
    paddingVertical: 15,
    backgroundColor: colors.primary,
    borderRadius: 13,
    alignItems: 'center',
  },
  submitText: { fontFamily: fonts.sora700, fontSize: 15, color: '#fff' },
  footnote: { fontFamily: fonts.sans400, fontSize: 11, color: colors.faint, textAlign: 'center' },
});
