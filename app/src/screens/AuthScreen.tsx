import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mono, CTA, ObInput, ObChipLabel, SrcNote, useTheme, ScaledText as Text } from '@basalt/ui';
import { supabase } from '../lib/supabase';

// Sign in / create account — email + password, nothing else. No quiz, no
// paywall, no funnel: onboarding starts after auth and every step of it is
// skippable.

export function AuthScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
      style={[styles.root, { backgroundColor: theme.surfaces.bg, paddingTop: insets.top + 22, paddingBottom: insets.bottom + 22 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={[styles.brand, { color: theme.text.ink }]}>BASALT</Text>
      <Text style={[styles.lede, { color: theme.text.ink }]}>
        {mode === 'signin' ? 'Sign in to your ledger.' : 'Create your ledger.'}
      </Text>

      <View style={{ marginTop: 18 }}>
        <ObChipLabel>Email</ObChipLabel>
        <ObInput
          placeholder="you@example.com"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={(t) => { setEmail(t); setError(null); }}
        />
        <View style={styles.pwRow}>
          <ObChipLabel>Password</ObChipLabel>
          <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={10}>
            <Text style={[styles.pwToggle, { color: theme.text.mute }]}>{showPassword ? 'HIDE' : 'SHOW'}</Text>
          </Pressable>
        </View>
        <ObInput
          placeholder="At least 6 characters"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          value={password}
          onChangeText={(t) => { setPassword(t); setError(null); }}
        />
      </View>

      {error ? <Text style={[styles.error, { color: theme.text.fat }]}>{error}</Text> : null}

      <CTA
        label={busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        onPress={submit}
        disabled={busy || !email.trim() || password.length < 6}
      />
      <Text
        style={[styles.switch, { color: theme.text.mute }]}
        onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
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
  root: { flex: 1, paddingHorizontal: 22 },
  brand: { fontFamily: mono, fontSize: 11, letterSpacing: 2.42 },
  lede: { fontSize: 24, fontWeight: '650' as any, letterSpacing: -0.36, marginTop: 34 },
  error: { fontSize: 12.5, marginTop: 12, lineHeight: 18 },
  pwRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  pwToggle: { fontFamily: mono, fontSize: 11, letterSpacing: 0.9, paddingVertical: 4 },
  switch: {
    fontFamily: mono,
    fontSize: 11,
    letterSpacing: 1.2,
    textAlign: 'center',
    marginTop: 18,
    paddingVertical: 6,
  },
});
