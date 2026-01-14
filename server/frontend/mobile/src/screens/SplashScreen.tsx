import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface SplashScreenProps {
  onFinish: () => void;
  onLayout?: () => void;
}

export default function SplashScreen({ onFinish, onLayout }: SplashScreenProps) {
  useEffect(() => {
    // Show splash for 2 seconds then proceed
    const timer = setTimeout(() => {
      onFinish();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <LinearGradient
      colors={['#A294E0', '#8B7DD1', '#7A6DC5']}
      style={styles.container}
      onLayout={onLayout}
    >
      {/* Checkmark Icon */}
      <View style={styles.iconContainer}>
        <View style={styles.iconBackground}>
          <Text style={styles.checkmark}>✓</Text>
        </View>
      </View>

      {/* App Name */}
      <Text style={styles.appName}>Taskly</Text>

      {/* Tagline */}
      <Text style={styles.tagline}>Plan tasks. Track time. Work better</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 10,
  },
  iconBackground: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#6B5CA5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  checkmark: {
    fontSize: 45,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  appName: {
    fontSize: 52,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 5,
    fontFamily: 'Inter_700Bold',
  },
  tagline: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 15,
    opacity: 0.9,
    fontFamily: 'Inter_400Regular',
  },
});
