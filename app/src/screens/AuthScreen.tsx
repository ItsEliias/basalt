import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, mono, CTA, ObInput, SrcNote } from '@basalt/ui';
import { supabase } from '../lib/supabase';

// Sign in / create account — email + password, nothing else. No quiz, no
// paywall, no funnel: onboarding starts after auth and every step of it is
// skippable.

export function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const call =
      mode === 'signin'
        ? supabase.auth.signInWithPassword({ email: email.trim(), password })
        : supabase.auth.signUp({ email: email.trim(), password });
    const { error: e } = await call;
    if (e) setError(e.message);
    setBusy(false);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top + 22, paddingBottom: insets.bottom + 22 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.brand}>BASALT</Text>
      <Text style={styles.lede}>
        {mode === 'signin' ? 'Sign in to your ledger.' : 'Create your ledger.'}
      </Text>

      <View style={{ marginTop: 18 }}>
        <ObInput
          placeholder="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <ObInput
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <CTA
        label={busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        onPress={submit}
        disabled={busy || !email.trim() || password.length < 6}
      />
      <Text
        style={styles.switch}
        onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
      >
        {mode === 'signin' ? 'NEW HERE — CREATE AN ACCOUNT' : 'ALREADY HAVE AN ACCOUNT — SIGN IN'}
      </Text>

      <View style={{ flex: 1 }} />
      <SrcNote>
        Your data is yours — export everything or delete it completely, any time, in Settings.
      </SrcNote>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg, paddingHorizontal: 22 },
  brand: { fontFamily: mono, fontSize: 11, letterSpacing: 2.42, color: color.ink },
  lede: { fontSize: 24, fontWeight: '650' as any, letterSpacing: -0.36, color: color.ink, marginTop: 34 },
  error: { fontSize: 12.5, color: color.fat, marginTop: 12, lineHeight: 18 },
  switch: {
    fontFamily: mono,
    fontSize: 10,
    letterSpacing: 1.2,
    color: color.mute,
    textAlign: 'center',
    marginTop: 18,
    paddingVertical: 6,
  },
});
