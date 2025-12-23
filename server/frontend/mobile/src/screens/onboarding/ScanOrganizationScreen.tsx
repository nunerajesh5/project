import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import SafeAreaWrapper from '../../components/shared/SafeAreaWrapper';
import AppHeader from '../../components/shared/AppHeader';
import Card from '../../components/shared/Card';
import { joinOrganization, resolveOrganizationByCode } from '../../api/endpoints';

export default function ScanOrganizationScreen({ navigation }: any) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'scan' | 'manual'>('scan'); // 'scan' or 'manual'
  const [code, setCode] = useState('');
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

  // Handle QR code scan
  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return; // Prevent multiple scans
    setScanned(true);
    
    const scannedCode = data.trim();
    setCode(scannedCode);
    
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
    if (!code.trim()) {
      Alert.alert('Validation', 'Please enter the join code');
      return;
    }
    setVerifying(true);
    try {
      const res = await resolveOrganizationByCode(code.trim());
      setOrgName(res.organization?.name || '');
      // Navigate to RegisterScreen with the organization code
      navigation.replace('Auth', {
        screen: 'Register',
        params: { organizationCode: code.trim(), organizationName: res.organization?.name }
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
    setCode('');
    setCodeVerified(false);
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
              setCode('');
              setOrgName('');
            }}
          >
            <Text style={styles.linkText}>Change code</Text>
          </TouchableOpacity>
        </Card>
      );
    }

    return (
      <Card style={styles.card}>
        <Text style={styles.title}>{t('organization.enter_organization_code')}</Text>
        <Text style={styles.subtitle}>
          {mode === 'manual' 
            ? t('organization.scan_to_link')
            : t('organization.enter_organization_code')}
        </Text>
        
        <Text style={styles.label}>{t('organization.organization_code')} *</Text>
        <TextInput 
          style={styles.input} 
          value={code} 
          onChangeText={setCode}
          placeholder={t('organization.organization_code')}
          autoCapitalize="characters"
        />
        
        <TouchableOpacity 
          style={[styles.button, verifying && { opacity: 0.6 }]} 
          onPress={handleVerifyCode} 
          disabled={verifying || !code.trim()}
        >
          <Text style={styles.buttonText}>
            {verifying ? t('common.loading') : t('organization.verify_code')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.switchModeButton} 
          onPress={handleSwitchToScan}
        >
          <Ionicons name="qr-code-outline" size={20} color="#007AFF" />
          <Text style={styles.switchModeText}>{t('organization.scan_qr_code')}</Text>
        </TouchableOpacity>
      </Card>
    );
  };

  return (
    <SafeAreaWrapper>
      <AppHeader
        title="Scan QR Code"
        backgroundColor="#111111"
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
