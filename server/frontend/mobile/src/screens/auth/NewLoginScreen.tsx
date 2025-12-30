import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInputProps,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { MOCK_DATA, User } from '../../data/mockData';
import SafeAreaWrapper from '../../components/shared/SafeAreaWrapper';
import otpService from '../../services/otpService';

type LoginMethod = 'email' | 'phone';

// Floating Label Input Component
interface FloatingLabelInputProps extends TextInputProps {
  label: string;
}

function FloatingLabelInput({ label, style, ...rest }: FloatingLabelInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = typeof rest.value === 'string' ? rest.value.trim().length > 0 : !!rest.value;
  const showFloatingLabel = isFocused || hasValue;
  const basePlaceholder = (rest.placeholder as string) || label;
  const placeholderColor = rest.placeholderTextColor ?? '#727272';

  return (
    <View style={styles.floatingContainer}>
      {showFloatingLabel && (
        <Text style={[styles.floatingLabel, styles.floatingLabelActive]}>
          {label}
        </Text>
      )}
      <TextInput
        {...rest}
        placeholder={showFloatingLabel ? '' : basePlaceholder}
        placeholderTextColor={placeholderColor}
        style={[
          styles.floatingInput,
          showFloatingLabel && styles.floatingInputWithLabel,
          isFocused && styles.floatingInputFocused,
          style,
        ]}
        onFocus={(e) => {
          setIsFocused(true);
          rest.onFocus && rest.onFocus(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          rest.onBlur && rest.onBlur(e);
        }}
      />
    </View>
  );
}

// Floating Label Password Input Component
interface FloatingLabelPasswordInputProps extends TextInputProps {
  label: string;
  showPassword: boolean;
  onTogglePassword: () => void;
}

function FloatingLabelPasswordInput({ 
  label, 
  showPassword, 
  onTogglePassword, 
  style, 
  ...rest 
}: FloatingLabelPasswordInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = typeof rest.value === 'string' ? rest.value.trim().length > 0 : !!rest.value;
  const showFloatingLabel = isFocused || hasValue;
  const basePlaceholder = (rest.placeholder as string) || label;
  const placeholderColor = rest.placeholderTextColor ?? '#727272';

  return (
    <View style={styles.floatingContainer}>
      {showFloatingLabel && (
        <Text style={[styles.floatingLabel, styles.floatingLabelActive]}>
          {label}
        </Text>
      )}
      <View style={[
        styles.floatingPasswordWrapper,
        isFocused && styles.floatingInputFocused,
      ]}>
        <TextInput
          {...rest}
          placeholder={showFloatingLabel ? '' : basePlaceholder}
          placeholderTextColor={placeholderColor}
          secureTextEntry={!showPassword}
          style={[
            styles.floatingPasswordInput,
            showFloatingLabel && styles.floatingPasswordInputWithLabel,
            style,
          ]}
          onFocus={(e) => {
            setIsFocused(true);
            rest.onFocus && rest.onFocus(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            rest.onBlur && rest.onBlur(e);
          }}
        />
        <TouchableOpacity
          style={styles.floatingPasswordToggle}
          onPress={onTogglePassword}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons 
            name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
            size={22} 
            color="#877ED2" 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Floating Label Phone Input Component
interface FloatingLabelPhoneInputProps extends TextInputProps {
  label: string;
}

function FloatingLabelPhoneInput({ label, style, ...rest }: FloatingLabelPhoneInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = typeof rest.value === 'string' ? rest.value.trim().length > 0 : !!rest.value;
  const showFloatingLabel = isFocused || hasValue;
  const basePlaceholder = (rest.placeholder as string) || label;
  const placeholderColor = rest.placeholderTextColor ?? '#727272';

  return (
    <View style={styles.floatingContainer}>
      {showFloatingLabel && (
        <Text style={[styles.floatingLabel, styles.floatingLabelActive]}>
          {label}
        </Text>
      )}
      <View style={[
        styles.floatingPhoneWrapper,
        isFocused && styles.floatingInputFocused,
      ]}>
        <View style={styles.floatingCountryCodeContainer}>
          <Text style={styles.floatingFlagIcon}>🇮🇳</Text>
          <Text style={styles.floatingCountryCode}>+91</Text>
        </View>
        <View style={styles.floatingPhoneDivider} />
        <TextInput
          {...rest}
          placeholder={showFloatingLabel ? '' : basePlaceholder}
          placeholderTextColor={placeholderColor}
          style={[
            styles.floatingPhoneInput,
            showFloatingLabel && styles.floatingPhoneInputWithLabel,
            style,
          ]}
          onFocus={(e) => {
            setIsFocused(true);
            rest.onFocus && rest.onFocus(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            rest.onBlur && rest.onBlur(e);
          }}
        />
      </View>
    </View>
  );
}

// Theme colors
const PRIMARY_PURPLE = '#7C6AC8';
const LIGHT_PURPLE = '#877ED2';
const BG_PURPLE = '#F0EEF8';
const TEXT_DARK = '#333333';
const TEXT_MUTED = '#8E8E93';

export default function NewLoginScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { loginWithUser, login } = useContext(AuthContext);
  
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  
  // Email/Password form data
  const [emailForm, setEmailForm] = useState({
    email: '',
    password: '',
  });
  
  // Phone/OTP form data
  const [phoneForm, setPhoneForm] = useState({
    phoneNumber: '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateEmailForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!emailForm.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(emailForm.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!emailForm.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (emailForm.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePhoneForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!phoneForm.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone number is required';
    } else {
      const validation = otpService.validatePhoneNumber(phoneForm.phoneNumber);
      if (!validation.isValid) {
        newErrors.phoneNumber = validation.error || 'Invalid phone number';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleEmailLogin = async () => {
    console.log('handleEmailLogin called');
    if (!validateEmailForm()) {
      console.log('Form validation failed');
      return;
    }

    setLoading(true);
    try {
      const email = emailForm.email.trim().toLowerCase();
      const password = emailForm.password;
      console.log('Attempting login for:', email);

      // Check against mock credentials
      if (email === 'rajesh@company.com' && password === 'rajesh123') {
        console.log('Using mock credentials for Rajesh');
        const u = MOCK_DATA.users.find(u => u.id === 'user2') as User | undefined;
        await loginWithUser((u || { id: 'user2', name: 'Rajesh (Manager)', role: 'manager' }) as any);
        return;
      }

      if (email === 'alice@company.com' && password === 'alice123') {
        console.log('Using mock credentials for Alice');
        const u = MOCK_DATA.users.find(u => u.id === 'user3') as User | undefined;
        await loginWithUser((u || { id: 'user3', name: 'Alice Johnson (Employee)', role: 'employee' }) as any);
        return;
      }

      if (email === 'bob@company.com' && password === 'bob123') {
        console.log('Using mock credentials for Bob');
        const u = MOCK_DATA.users.find(u => u.id === 'user4') as User | undefined;
        await loginWithUser((u || { id: 'user4', name: 'Bob Williams (Employee)', role: 'employee' }) as any);
        return;
      }

      if (email === 'charlie@company.com' && password === 'charlie123') {
        console.log('Using mock credentials for Charlie');
        const u = MOCK_DATA.users.find(u => u.id === 'user5') as User | undefined;
        await loginWithUser((u || { id: 'user5', name: 'Charlie Davis (Employee)', role: 'employee' }) as any);
        return;
      }

      // Real backend login via AuthContext (handles token + navigation)
      console.log('Attempting real backend login');
      await login(email, password);
      console.log('Login successful');
      return;
    } catch (e: any) {
      console.error('Login error details:', e);
      console.error('Error response:', e.response);
      console.error('Error message:', e.message);
      console.error('Error code:', e.code);
      
      let errorMessage = 'Login failed. Please try again.';
      
      if (e.response?.data?.error) {
        errorMessage = e.response.data.error;
      } else if (e.message) {
        if (e.message.includes('Network Error') || e.message.includes('ERR_NETWORK')) {
          errorMessage = 'Cannot connect to server. Please make sure the backend is running on http://localhost:5000';
        } else {
          errorMessage = e.message;
        }
      } else if (e.code === 'ERR_NETWORK' || e.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check if the backend server is running.';
      }
      
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin = async () => {
    if (!validatePhoneForm()) return;

    setOtpLoading(true);
    try {
      // Clean the phone number before sending (remove spaces and formatting)
      const cleanPhoneNumber = phoneForm.phoneNumber.replace(/\D/g, '');
      
      const result = await otpService.sendOTP(cleanPhoneNumber);
      
      if (result.success) {
        // Navigate to OTP verification screen with formatted phone number
        navigation.navigate('OTPVerification', {
          phoneNumber: phoneForm.phoneNumber, // Keep formatted for display
          userRole: 'employee' // Default role, can be determined based on phone number
        });
      } else {
        Alert.alert('Failed', result.message);
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      Alert.alert('Error', 'Failed to send OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };


  const formatPhoneNumber = (text: string) => {
    // Remove all non-digit characters
    const cleaned = text.replace(/\D/g, '');
    
    // Format as XXXXX XXXXX (5 digits space 5 digits)
    if (cleaned.length <= 5) {
      return cleaned;
    } else {
      return `${cleaned.slice(0, 5)} ${cleaned.slice(5, 10)}`;
    }
  };

  const handlePhoneChange = (text: string) => {
    // Remove all non-digit characters first
    const cleaned = text.replace(/\D/g, '');
    
    // Limit to 10 digits
    const limited = cleaned.slice(0, 10);
    
    // Format as XXXXX XXXXX
    const formatted = limited.length <= 5 
      ? limited 
      : `${limited.slice(0, 5)} ${limited.slice(5)}`;
    
    setPhoneForm({ phoneNumber: formatted });
  };


  return (
    <SafeAreaWrapper backgroundColor={BG_PURPLE}>
      <KeyboardAvoidingView 
        style={styles.keyboardContainer} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Header with Logo */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Ionicons name="checkmark" size={40} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.appName}>Taskly</Text>
            <Text style={styles.welcomeText}>Welcome to Taskly!</Text>
            <Text style={styles.appTagline}>Plan tasks. Track time. Work better</Text>
          </View>

          {/* Login Method Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                loginMethod === 'email' && styles.toggleButtonActive
              ]}
              onPress={() => setLoginMethod('email')}
            >
              <Ionicons 
                name="mail-outline" 
                size={20} 
                color={loginMethod === 'email' ? '#FFFFFF' : '#007AFF'} 
              />
              <Text style={[
                styles.toggleButtonText,
                loginMethod === 'email' && styles.toggleButtonTextActive
              ]}>
                Email
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.toggleButton,
                loginMethod === 'phone' && styles.toggleButtonActive
              ]}
              onPress={() => setLoginMethod('phone')}
            >
              <Ionicons 
                name="phone-portrait-outline" 
                size={20} 
                color={loginMethod === 'phone' ? '#FFFFFF' : '#007AFF'} 
              />
              <Text style={[
                styles.toggleButtonText,
                loginMethod === 'phone' && styles.toggleButtonTextActive
              ]}>
                Phone
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email/Password Form */}
          {loginMethod === 'email' && (
            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <FloatingLabelInput
                  label="Email"
                  placeholder="Email"
                  placeholderTextColor='#727272'
                  value={emailForm.email}
                  onChangeText={(text) => setEmailForm({ ...emailForm, email: text })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              <View style={styles.inputContainer}>
                <FloatingLabelPasswordInput
                  label="Password"
                  placeholder="Password"
                  placeholderTextColor='#727272'
                  value={emailForm.password}
                  onChangeText={(text) => setEmailForm({ ...emailForm, password: text })}
                  showPassword={showPassword}
                  onTogglePassword={() => setShowPassword(prev => !prev)}
                  autoCapitalize="none"
                />
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>

              {/* Remember me & Forgot password row */}
              <View style={styles.optionsRow}>
                <TouchableOpacity 
                  style={styles.rememberMeContainer}
                  onPress={() => setRememberMe(prev => !prev)}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                  </View>
                  <Text style={styles.rememberMeText}>Remember me</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => Alert.alert('Forgot Password', 'Password reset functionality coming soon!')}>
                  <Text style={styles.forgotPasswordText}>Forgot password</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleEmailLogin}
                disabled={loading}
              >
                <Text style={styles.loginButtonText}>
                  {loading ? 'Signing in...' : 'Login'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Phone/OTP Form */}
          {loginMethod === 'phone' && (
            <View style={styles.formContainer}>
              <View style={styles.inputContainer}>
                <FloatingLabelPhoneInput
                  label="Phone Number"
                  placeholder="Phone Number"
                  placeholderTextColor={TEXT_MUTED}
                  value={phoneForm.phoneNumber}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  maxLength={11}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
              </View>

              <TouchableOpacity
                style={[styles.loginButton, otpLoading && styles.loginButtonDisabled]}
                onPress={handlePhoneLogin}
                disabled={otpLoading}
              >
                <Text style={styles.loginButtonText}>
                  {otpLoading ? 'Sending...' : 'Send OTP'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.otpInfo}>
                A verification code will be sent to your phone
              </Text>
            </View>
          )}

          {/* Sign Up Link */}
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.signUpLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  // Floating Label Input Styles
  floatingContainer: {
    position: 'relative',
    paddingTop: 4,
  },
  floatingLabel: {
    position: 'absolute',
    left: 12,
    top: 14,
    fontSize: 14,
    color: '#9CA3AF',
    zIndex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 4,
  },
  floatingLabelActive: {
    top: -6,
    fontSize: 11,
    color: '#877ED2',
  },
  floatingInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 16,
    color: TEXT_DARK,
    minHeight: 50,
  },
  floatingInputWithLabel: {
    paddingTop: 18,
    paddingBottom: 10,
  },
  floatingInputFocused: {
    borderColor: '#877ED2',
  },
  // Floating Password Input Styles
  floatingPasswordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingRight: 12,
    minHeight: 50,
  },
  floatingPasswordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 16,
    color: TEXT_DARK,
  },
  floatingPasswordInputWithLabel: {
    paddingTop: 18,
    paddingBottom: 10,
  },
  floatingPasswordToggle: {
    padding: 4,
  },
  // Floating Phone Input Styles
  floatingPhoneWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    overflow: 'hidden',
    minHeight: 50,
  },
  floatingCountryCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#F8F9FA',
  },
  floatingFlagIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  floatingCountryCode: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  floatingPhoneDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E5EA',
  },
  floatingPhoneInput: {
    flex: 1,
    fontSize: 16,
    color: TEXT_DARK,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  floatingPhoneInputWithLabel: {
    paddingTop: 18,
    paddingBottom: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 70,
  },
  logoContainer: {
    marginBottom: 8,
  },
  logoIcon: {
    width: 70,
    height: 70,
    borderRadius: 16,
    backgroundColor: PRIMARY_PURPLE,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: PRIMARY_PURPLE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  appName: {
    fontSize: 36,
    fontWeight: '700',
    color: PRIMARY_PURPLE,
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  welcomeText: {
    fontSize: 25,
    fontWeight: '600',
    color: "#000000",
    fontFamily: 'Inter_600SemiBold',
  },
  appTagline: {
    fontSize: 14,
    color: '#6256C4',
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  toggleButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#007AFF',
    marginLeft: 8,
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  formContainer: {
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: TEXT_DARK,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: TEXT_DARK,
  },
  passwordToggle: {
    padding: 4,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 4,
  },
  rememberMeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: LIGHT_PURPLE,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: LIGHT_PURPLE,
    borderColor: LIGHT_PURPLE,
  },
  rememberMeText: {
    fontSize: 14,
    color: '#8F8F8F',
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#877ED2',
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  loginButton: {
    backgroundColor: '#877ED2',
    borderRadius: 8,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#877ED2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginTop: 48,
    height: 50,
    width: 371,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    overflow: 'hidden',
  },
  countryCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#F8F9FA',
  },
  flagIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_DARK,
  },
  phoneInputDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E5E5EA',
  },
  phoneTextInput: {
    flex: 1,
    fontSize: 16,
    color: TEXT_DARK,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  errorText: {
    fontSize: 13,
    color: '#FF3B30',
    marginTop: 6,
    marginLeft: 4,
  },
  otpInfo: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: 'center',
    marginTop: 16,
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 20,
  },
  signUpText: {
    fontSize: 15,
    color: TEXT_MUTED,
  },
  signUpLink: {
    fontSize: 15,
    color: LIGHT_PURPLE,
    fontWeight: '600',
  },
});
