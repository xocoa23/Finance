import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { PinPad } from '../components/PinPad';
import { Icon } from '../components/Icon';
import { useAuth } from '../hooks/useAuth';
import { COLORS, RADIUS, SPACING } from '../types';

type Mode = 'choice' | 'pin' | 'setup-create' | 'setup-confirm';

export function LockScreen() {
  const auth = useAuth();
  const isSetup = auth.state === 'setup';
  const [mode, setMode] = useState<Mode>(isSetup ? 'setup-create' : 'choice');
  const [setupPin, setSetupPin] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [resetSignal, setResetSignal] = useState(0);

  useEffect(() => {
    if (
      !isSetup &&
      mode === 'choice' &&
      auth.biometricAvailable &&
      auth.biometricEnabled
    ) {
      auth.unlockWithBiometric().catch(() => {});
    }
  }, [isSetup, mode, auth.biometricAvailable, auth.biometricEnabled]);

  const handlePinComplete = async (pin: string) => {
    if (mode === 'pin') {
      const ok = await auth.unlockWithPin(pin);
      if (!ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setError('PIN incorreto');
        setResetSignal((s) => s + 1);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } else if (mode === 'setup-create') {
      setSetupPin(pin);
      setMode('setup-confirm');
      setResetSignal((s) => s + 1);
    } else if (mode === 'setup-confirm') {
      if (pin !== setupPin) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        setError('Os PINs não coincidem');
        setSetupPin('');
        setMode('setup-create');
        setResetSignal((s) => s + 1);
      } else {
        await auth.setupPin(pin, auth.biometricAvailable);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }
  };

  const tryBiometric = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const ok = await auth.unlockWithBiometric();
    if (!ok) setError('Biometria não autorizada');
  };

  if (isSetup) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.logoCircle}>
            <Icon name="wallet" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.appName}>Finanças</Text>
          <View style={styles.pinArea}>
            <PinPad
              title={mode === 'setup-create' ? 'Crie seu PIN' : 'Confirme seu PIN'}
              subtitle={
                mode === 'setup-create'
                  ? '4 dígitos. Você precisará dele toda vez.'
                  : 'Digite o mesmo PIN novamente'
              }
              errorMessage={error}
              resetSignal={resetSignal}
              onComplete={handlePinComplete}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.logoCircle}>
          <Icon name="wallet" size={36} color={COLORS.primary} />
        </View>
        <Text style={styles.appName}>Finanças</Text>
        <Text style={styles.tagline}>Seus dados, só seus.</Text>

        <View style={styles.pinArea}>
          {mode === 'pin' ? (
            <PinPad
              title="Digite seu PIN"
              errorMessage={error}
              resetSignal={resetSignal}
              onComplete={handlePinComplete}
            />
          ) : (
            <View style={styles.choiceArea}>
              {auth.biometricAvailable && auth.biometricEnabled ? (
                <TouchableOpacity style={styles.bigBtn} onPress={tryBiometric} activeOpacity={0.85}>
                  <Icon name="finger-print" size={20} color="#0a0a0b" />
                  <Text style={styles.bigBtnText}>Entrar com {auth.biometricLabel}</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => { setError(''); setMode('pin'); }}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryBtnText}>Usar PIN</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: SPACING.xl },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primarySoft,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  appName: { color: COLORS.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  tagline: { color: COLORS.textSecondary, fontSize: 14, marginTop: 4, marginBottom: SPACING.lg },
  pinArea: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  choiceArea: { width: '100%', alignItems: 'center', gap: SPACING.md },
  bigBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.lg, paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.lg,
    width: '100%',
  },
  bigBtnText: { color: '#0a0a0b', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.lg },
  secondaryBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: '600' },
});
