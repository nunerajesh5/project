import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import SafeAreaWrapper from '../../components/shared/SafeAreaWrapper';
import AppHeader from '../../components/shared/AppHeader';

// Onboarding landing screen redesigned to match the provided mock
export default function OnboardingChoiceScreen({ navigation }: any) {
  return (
    <SafeAreaWrapper>
      <AppHeader
        hideLogo
        backgroundColor="#FFFFFF"
        showLanguageSwitcher
        renderLanguageTrigger={(open) => (
          <TouchableOpacity onPress={open} style={styles.menuButton} activeOpacity={0.8}>
            <Text style={styles.menuDots}>⋮</Text>
          </TouchableOpacity>
        )}
      />
      <View style={styles.container}>
        <View style={styles.headerBlock}>
          <Text style={styles.welcome}>Welcome</Text>
          <Text style={styles.tagline}>Plan tasks. Track time. Work better</Text>
          <Text style={styles.lead}>
            Get started by setting up your organization
            {'\n'}
            or connecting to an existing one.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Are you an organization owner?</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('RegisterOrganization')}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryButtonText}>Create Organization</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.orText}>Or</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Are you a team member?</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('ScanOrganization')}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryButtonText}>Scan QR to Join Your Organization</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => navigation.replace('Auth')} activeOpacity={0.8}>
            <Text style={styles.loginLink}>Log in</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaWrapper>
  );
}

const PRIMARY = '#7A6AC8';
const TEXT = '#333333';
const MUTED = '#666666';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    justifyContent: 'flex-start',
  },
  headerBlock: {
    alignItems: 'center',
    marginTop: 22,
  },
  welcome: {
    fontSize: 40,
    fontWeight: '800',
    color: '#574ABF',
    textAlign: 'center',
    fontFamily: 'Inter_800ExtraBold',
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    color: '#6256C4',
    marginTop: 2,
    textAlign: 'center',
  },
  lead: {
    fontSize: 14,
    color: '#404040',
    marginTop: 14,
    marginBottom: 80,
    lineHeight: 20,
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  section: {
    alignItems: 'center',
    width: '100%',
  },
  sectionLabel: {
    fontSize: 14,
    color: '#404040',
    marginBottom: 12,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#877ED2',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '500',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  orText: {
    textAlign: 'center',
    color: '#404040',
    fontWeight: '400',
    fontSize: 14,
    fontFamily: 'Inter_400Medium',
    marginVertical: 10,
  },
  footer: {
    alignItems: 'center',
    marginTop: 100,
  },
  footerText: {
    color: '#404040',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    marginBottom: 6,
  },
  loginLink: {
    color: '#877ED2',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  menuButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  menuDots: {
    fontSize: 22,
    color: '#111',
    fontWeight: '700',
    marginTop: -2,
  },
});
