import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Keyboard } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import SafeAreaWrapper from '../../components/shared/SafeAreaWrapper';
import AppHeader from '../../components/shared/AppHeader';
import Card from '../../components/shared/Card';
import { joinOrganization, resolveOrganizationByCode } from '../../api/endpoints';

const CODE_LENGTH = 6;

export default function ScanOrganizationScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'scan' | 'manual'>('scan'); // 'scan' or 'manual'
  const [codeDigits, setCodeDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [orgName, setOrgName] = useState('');
  const [codeVerified, setCodeVerified] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  
  // Refs for digit inputs
  const inputRefs = useRef<(TextInput | null)[]>([]);
  
  // Get full code from digits
  const code = codeDigits.join('');
  
  // Handle digit input change
  const handleDigitChange = (text: string, index: number) => {
    // Only allow numbers
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    
    const newDigits = [...codeDigits];
    newDigits[index] = digit;
    setCodeDigits(newDigits);
    
    // Auto-focus next input
    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };
  
  // Handle backspace
  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle QR code scan
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return; // Prevent multiple scans
    setScanned(true);
    
    const scannedCode = data.trim();
    // Set digits from scanned code
    const digits = scannedCode.slice(0, CODE_LENGTH).split('');
    setCodeDigits([...digits, ...Array(CODE_LENGTH - digits.length).fill('')]);
    
    // Automatically verify the scanned code
    setVerifying(true);
    try {
      const res = await resolveOrganizationByCode(scannedCode);
      setOrgName(res.organization?.name || '');
      // Navigate directly to RegisterScreen with the organization code
      navigation.replace('Auth', {
        screen: 'Register',
        params: { organizationCode: scannedCode, organizationName: res.organization?.name }
      });
    } catch (err: any) {
      Alert.alert('Invalid QR Code', 'The scanned code does not match any organization. Please try again or enter the code manually.');
      setScanned(false); // Allow scanning again
    } finally {
      setVerifying(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== CODE_LENGTH) {
      Alert.alert('Validation', 'Please enter the complete 6-digit code');
      return;
    }
    Keyboard.dismiss();
    setVerifying(true);
    try {
      const res = await resolveOrganizationByCode(code);
      setOrgName(res.organization?.name || '');
      // Navigate to RegisterScreen with the organization code
      navigation.replace('Auth', {
        screen: 'Register',
        params: { organizationCode: code, organizationName: res.organization?.name }
      });
    } catch {
      Alert.alert('Invalid Code', 'We could not find an organization for this code.');
    } finally {
      setVerifying(false);
    }
  };

  const handleJoin = async () => {
    if (!code) { 
      Alert.alert('Error', 'Please enter a valid code'); 
      return; 
    }
    if (!firstName.trim()) { 
      Alert.alert('Validation', 'Please enter your name'); 
      return; 
    }
    setSubmitting(true);
    try {
      await joinOrganization({ 
        code, 
        first_name: firstName.trim(), 
        last_name: lastName.trim(), 
        email: email.trim(), 
        phone: phone.trim() 
      });
      Alert.alert('Success', 'You have been linked to the organization.', [ 
        { text: 'OK', onPress: () => navigation.replace('Auth') } 
      ]);
    } catch (err: any) {
      console.error('Join org error:', err);
      const message = err.response?.data?.error || 'Failed to join organization';
      Alert.alert('Error', message);
    } finally { 
      setSubmitting(false); 
    }
  };

  // Request camera permission on mount if in scan mode
  useEffect(() => {
    if (mode === 'scan' && permission && !permission.granted && !permission.canAskAgain) {
      Alert.alert(
        'Camera Permission Required',
        'Please enable camera permission in your device settings to scan QR codes.',
        [{ text: 'OK' }]
      );
    }
  }, [mode, permission]);

  // Request permission when switching to scan mode
  const handleSwitchToScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to scan QR codes. Please enable it in your device settings.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    setMode('scan');
    setScanned(false);
    setCodeDigits(Array(CODE_LENGTH).fill(''));
    setCodeVerified(false);
  };
  
  // Clear all digits
  const handleClearCode = () => {
    setCodeDigits(Array(CODE_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
  };

  // Render QR Scanner View
  const renderScanner = () => {
    if (!permission) {
      return (
        <View style={styles.scannerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Checking camera permission...</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.scannerContainer}>
          <Ionicons name="camera-outline" size={64} color="#999" />
          <Text style={styles.permissionText}>Camera permission is required</Text>
          <Text style={styles.permissionSubtext}>Please grant camera access to scan QR codes</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.switchModeButton} 
            onPress={() => setMode('manual')}
          >
            <Text style={styles.switchModeText}>Enter Code Manually</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.scannerContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
        >
          <View style={styles.scannerOverlay}>
            {/* Top overlay */}
            <View style={styles.overlayTop} />
            
            {/* Middle section with scanning frame */}
            <View style={styles.overlayMiddle}>
              <View style={styles.overlaySide} />
              <View style={styles.scanFrame}>
                <View style={[styles.corner, styles.topLeft]} />
                <View style={[styles.corner, styles.topRight]} />
                <View style={[styles.corner, styles.bottomLeft]} />
                <View style={[styles.corner, styles.bottomRight]} />
              </View>
              <View style={styles.overlaySide} />
            </View>
            
            {/* Bottom overlay */}
            <View style={styles.overlayBottom}>
              <Text style={styles.scanInstruction}>{t('organization.position_qr_frame')}</Text>
              {scanned && (
                <View style={styles.scannedIndicator}>
                  <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                  <Text style={styles.scannedText}>{t('organization.code_scanned')}</Text>
                </View>
              )}
            </View>
          </View>
        </CameraView>
        
        <View style={styles.scannerControls}>
          <Text style={styles.scannerOrText}>or</Text>
          <TouchableOpacity 
            style={styles.scannerPrimaryButton} 
            onPress={() => {
              setMode('manual');
              setScanned(false);
              setCodeDigits(Array(CODE_LENGTH).fill(''));
            }}
          >
            <Text style={styles.scannerPrimaryButtonText}>Enter Code Manually</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Render Manual Entry View
  const renderManualEntry = () => {
    if (codeVerified) {
      return (
        <Card style={styles.card}>
          <Text style={styles.title}>Link to Organization</Text>
          <Text style={styles.subtitle}>Organization: {orgName || 'Unknown'}</Text>
          
          <Text style={styles.label}>First Name *</Text>
          <TextInput 
            style={styles.input} 
            value={firstName} 
            onChangeText={setFirstName}
            placeholder="Enter your first name"
          />
          
          <Text style={styles.label}>Last Name</Text>
          <TextInput 
            style={styles.input} 
            value={lastName} 
            onChangeText={setLastName}
            placeholder="Enter your last name"
          />
          
          <Text style={styles.label}>Email</Text>
          <TextInput 
            style={styles.input} 
            value={email} 
            onChangeText={setEmail}
            keyboardType="email-address"
            placeholder="Enter your email"
            autoCapitalize="none"
          />
          
          <Text style={styles.label}>Phone</Text>
          <TextInput 
            style={styles.input} 
            value={phone} 
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="Enter your phone number"
          />

          <TouchableOpacity 
            style={[styles.button, submitting && { opacity: 0.6 }]} 
            onPress={handleJoin} 
            disabled={submitting}
          >
            <Text style={styles.buttonText}>
              {submitting ? 'Linking...' : 'Link to Organization'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.link} 
            onPress={() => {
              setCodeVerified(false);
              setCodeDigits(Array(CODE_LENGTH).fill(''));
              setOrgName('');
            }}
          >
            <Text style={styles.linkText}>Change code</Text>
          </TouchableOpacity>
        </Card>
      );
    }

    return (
      <View style={styles.manualEntryContainer}>
        {/* Top empty area with dismiss button */}
        <View style={styles.topArea}>
          <TouchableOpacity 
            style={styles.dismissButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={24} color="#999" />
          </TouchableOpacity>
        </View>
        
        {/* Bottom card with code entry */}
        <View style={styles.codeEntryCard}>
          <Text style={styles.codeEntryTitle}>Enter Organization Code</Text>
          <Text style={styles.codeEntrySubtitle}>Code valid for 12 hours</Text>
          
          {/* OTP-style digit inputs */}
          <View style={styles.digitContainer}>
            {codeDigits.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                style={[
                  styles.digitInput,
                  digit ? styles.digitInputFilled : {},
                  index === codeDigits.findIndex(d => d === '') ? styles.digitInputActive : {}
                ]}
                value={digit}
                onChangeText={(text) => handleDigitChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>
          
          {/* Verify Code Button */}
          <TouchableOpacity 
            style={[
              styles.verifyButton, 
              (verifying || code.length !== CODE_LENGTH) && styles.verifyButtonDisabled
            ]} 
            onPress={handleVerifyCode} 
            disabled={verifying || code.length !== CODE_LENGTH}
          >
            <Text style={styles.verifyButtonText}>
              {verifying ? 'Verifying...' : 'Verify Code'}
            </Text>
          </TouchableOpacity>

          {/* Scan QR Code Button */}
          <TouchableOpacity 
            style={styles.scanQRButton} 
            onPress={handleSwitchToScan}
          >
            <Text style={styles.scanQRButtonText}>Scan QR Code</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaWrapper>
      <AppHeader
        title={mode === 'manual' ? 'Create Account' : 'Scan QR Code'}
        backgroundColor="#877ED2"
        leftAction={{
          icon: '‹',
          onPress: () => navigation.goBack(),
        }}
        rightAction={{
          iconName: 'ellipsis-vertical',
          iconColor: '#FFFFFF',
          onPress: () => {},
        }}
      />
      <View style={styles.container}>
        {mode === 'scan' ? renderScanner() : renderManualEntry()}
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  // Manual Entry OTP-style styles
  manualEntryContainer: {
    flex: 1,
    backgroundColor: '#f5f5f8',
  },
  topArea: {
    flex: 1,
    backgroundColor: '#f5f5f8',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingRight: 20,
    paddingBottom: 20,
  },
  dismissButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  codeEntryCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  codeEntryTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  codeEntrySubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 32,
  },
  digitContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  digitInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f8f8f8',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: '#333',
  },
  digitInputFilled: {
    borderColor: '#877ED2',
    backgroundColor: '#fff',
  },
  digitInputActive: {
    borderColor: '#877ED2',
    borderWidth: 2,
    backgroundColor: '#fff',
  },
  verifyButton: {
    backgroundColor: '#877ED2',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  verifyButtonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  scanQRButton: {
    borderWidth: 1,
    borderColor: '#877ED2',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  scanQRButtonText: {
    color: '#877ED2',
    fontWeight: '600',
    fontSize: 16,
  },
  card: {
    margin: 16,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: '#333',
    marginTop: 10,
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  link: {
    alignItems: 'center',
    marginTop: 12,
  },
  linkText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  // Scanner styles
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: 250,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scanFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#007AFF',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  scanInstruction: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  scannedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
  },
  scannedText: {
    color: '#34C759',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  scannerControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  scannerOrText: {
    color: '#FFFFFF',
    fontSize: 12,
    marginBottom: 8,
  },
  scannerPrimaryButton: {
    width: '100%',
    backgroundColor: '#877ED2',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerPrimaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  switchModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  switchModeText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  rescanText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  permissionSubtext: {
    color: '#ccc',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 24,
  },
  permissionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },
});
