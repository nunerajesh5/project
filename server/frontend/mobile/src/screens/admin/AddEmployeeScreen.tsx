import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image, Modal, FlatList, TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../api/client';
import { Ionicons } from '@expo/vector-icons';

// Theme colors
const PRIMARY_PURPLE = '#6C5CE7';
const TEXT_DARK = '#333333';

// Floating Label Input Component
interface FloatingLabelInputProps extends TextInputProps {
  label: string;
  required?: boolean;
}

function FloatingLabelInput({ label, required, style, ...rest }: FloatingLabelInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = typeof rest.value === 'string' ? rest.value.trim().length > 0 : !!rest.value;
  const showFloatingLabel = isFocused || hasValue;
  const displayLabel = required ? `${label}*` : label;

  return (
    <View style={styles.floatingContainer}>
      {showFloatingLabel && (
        <Text style={[styles.floatingLabel, styles.floatingLabelActive]}>
          {displayLabel}
        </Text>
      )}
      <TextInput
        {...rest}
        placeholder={showFloatingLabel ? '' : displayLabel}
        placeholderTextColor="#999"
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

// Floating Label Phone Input Component
interface FloatingLabelPhoneInputProps extends TextInputProps {
  label: string;
  required?: boolean;
  phoneCode: string;
  onPhoneCodePress: () => void;
}

function FloatingLabelPhoneInput({ label, required, phoneCode, onPhoneCodePress, style, ...rest }: FloatingLabelPhoneInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = typeof rest.value === 'string' ? rest.value.trim().length > 0 : !!rest.value;
  const showFloatingLabel = isFocused || hasValue;
  const displayLabel = required ? `${label}*` : label;

  return (
    <View style={styles.floatingContainer}>
      {showFloatingLabel && (
        <Text style={[styles.floatingLabel, styles.floatingLabelActive]}>
          {displayLabel}
        </Text>
      )}
      <View style={[
        styles.floatingPhoneWrapper,
        isFocused && styles.floatingInputFocused,
      ]}>
        <TouchableOpacity style={styles.floatingCountryCodeContainer} onPress={onPhoneCodePress}>
          <Text style={styles.floatingCountryCode}>{phoneCode}</Text>
          <Ionicons name="chevron-down" size={16} color="#666" style={{ marginLeft: 4 }} />
        </TouchableOpacity>
        <View style={styles.floatingPhoneDivider} />
        <TextInput
          {...rest}
          placeholder={showFloatingLabel ? '' : displayLabel}
          placeholderTextColor="#999"
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

// Floating Label Dropdown Component
interface FloatingLabelDropdownProps {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  required?: boolean;
}

function FloatingLabelDropdown({ label, value, options, onSelect, required }: FloatingLabelDropdownProps) {
  const [visible, setVisible] = useState(false);
  const hasValue = value && value.trim().length > 0;
  const displayLabel = required ? `${label}*` : label;

  return (
    <>
      <View style={styles.floatingContainer}>
        {hasValue && (
          <Text style={[styles.floatingLabel, styles.floatingLabelActive]}>
            {displayLabel}
          </Text>
        )}
        <TouchableOpacity 
          style={[styles.floatingDropdown, hasValue && styles.floatingDropdownWithLabel]} 
          onPress={() => setVisible(true)}
        >
          <Text style={[styles.floatingDropdownText, !hasValue && styles.floatingDropdownPlaceholder]}>
            {value || displayLabel}
          </Text>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </TouchableOpacity>
      </View>
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalOption, value === item && styles.modalOptionSelected]}
                  onPress={() => {
                    onSelect(item);
                    setVisible(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, value === item && styles.modalOptionTextSelected]}>
                    {item}
                  </Text>
                  {value === item && <Ionicons name="checkmark" size={20} color="#6C5CE7" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// Floating Label Date Input Component
interface FloatingLabelDateInputProps {
  label: string;
  value: Date | null;
  onPress: () => void;
  required?: boolean;
}

function FloatingLabelDateInput({ label, value, onPress, required }: FloatingLabelDateInputProps) {
  const hasValue = !!value;
  const displayLabel = required ? `${label}*` : label;

  return (
    <View style={styles.floatingContainer}>
      {hasValue && (
        <Text style={[styles.floatingLabel, styles.floatingLabelActive]}>
          {displayLabel}
        </Text>
      )}
      <TouchableOpacity 
        style={[styles.floatingDateInput, hasValue && styles.floatingDateInputWithLabel]} 
        onPress={onPress}
      >
        <Text style={[styles.floatingDateText, !hasValue && styles.floatingDropdownPlaceholder]}>
          {value ? value.toLocaleDateString('en-GB') : displayLabel}
        </Text>
        <Ionicons name="calendar-outline" size={20} color={PRIMARY_PURPLE} />
      </TouchableOpacity>
    </View>
  );
}

// Dropdown data
const SALUTATIONS = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.'];

// Country and State types
interface Country {
  country_id: string;
  name: string;
  code: string;
}

interface State {
  state_id: string;
  name: string;
  country_id: string;
}

interface Designation {
  designation_id: string;
  name: string;
  description: string;
}

const PHONE_CODES = [
  { code: '+91', country: 'India' },
  { code: '+1', country: 'USA/Canada' },
  { code: '+44', country: 'UK' },
  { code: '+61', country: 'Australia' },
  { code: '+49', country: 'Germany' },
  { code: '+33', country: 'France' },
  { code: '+65', country: 'Singapore' },
  { code: '+971', country: 'UAE' },
  { code: '+81', country: 'Japan' },
];

export default function AddEmployeeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  const [saving, setSaving] = useState(false);

  // Countries and States from API
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingStates, setLoadingStates] = useState(false);

  // Designations from API
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loadingDesignations, setLoadingDesignations] = useState(true);

  // Personal & Contact Information
  const [salutation, setSalutation] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [showDob, setShowDob] = useState(false);
  const [skill, setSkill] = useState('');
  const [skillId, setSkillId] = useState('');
  const [phoneCode, setPhoneCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [showPhoneCodePicker, setShowPhoneCodePicker] = useState(false);
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [countryId, setCountryId] = useState('');
  const [state, setState] = useState('');
  const [stateId, setStateId] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Fetch countries on mount
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        setLoadingCountries(true);
        const response = await api.get('/api/countries');
        setCountries(response.data?.countries || []);
      } catch (error) {
        console.error('Error fetching countries:', error);
        // Fallback to empty array - countries API might not be available
        setCountries([]);
      } finally {
        setLoadingCountries(false);
      }
    };
    fetchCountries();
  }, []);

  // Fetch designations on mount
  useEffect(() => {
    const fetchDesignations = async () => {
      try {
        setLoadingDesignations(true);
        const response = await api.get('/api/designations');
        setDesignations(response.data?.designations || []);
      } catch (error) {
        console.error('Error fetching designations:', error);
        setDesignations([]);
      } finally {
        setLoadingDesignations(false);
      }
    };
    fetchDesignations();
  }, []);

  // Fetch states when country changes
  useEffect(() => {
    const fetchStates = async () => {
      if (!countryId) {
        setStates([]);
        setState('');
        setStateId('');
        return;
      }
      try {
        setLoadingStates(true);
        const response = await api.get(`/api/countries/${countryId}/states`);
        setStates(response.data?.states || []);
      } catch (error) {
        console.error('Error fetching states:', error);
        setStates([]);
      } finally {
        setLoadingStates(false);
      }
    };
    fetchStates();
  }, [countryId]);

  // Handle country selection
  const handleCountrySelect = (countryName: string) => {
    setCountry(countryName);
    const selectedCountry = countries.find(c => c.name === countryName);
    setCountryId(selectedCountry?.country_id || '');
    // Reset state when country changes
    setState('');
    setStateId('');
  };

  // Handle state selection
  const handleStateSelect = (stateName: string) => {
    setState(stateName);
    const selectedState = states.find(s => s.name === stateName);
    setStateId(selectedState?.state_id || '');
  };

  // Handle designation/skill selection
  const handleSkillSelect = (designationName: string) => {
    setSkill(designationName);
    const selectedDesignation = designations.find(d => d.name === designationName);
    setSkillId(selectedDesignation?.designation_id || '');
  };

  // Attachments
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarFileUri, setAadhaarFileUri] = useState<string | null>(null);

  // Payments
  const [joiningDate, setJoiningDate] = useState<Date | null>(null);
  const [showJoiningDate, setShowJoiningDate] = useState(false);
  const [employeeType, setEmployeeType] = useState<'Full Time' | 'Temporary' | 'Contract'>('Full Time');
  const [payCalculation, setPayCalculation] = useState<'Monthly' | 'Daily' | 'Hourly rate'>('Monthly');
  const [amount, setAmount] = useState('');
  const [overtimeRate, setOvertimeRate] = useState('');

  const validate = () => {
    const errors: string[] = [];
    if (!salutation) errors.push('Salutation');
    if (!firstName.trim()) errors.push('First Name');
    if (!lastName.trim()) errors.push('Last Name');
    if (!skill) errors.push('Designation');
    if (!phone.trim()) errors.push('Phone Number');
    if (!address.trim()) errors.push('Address');
    if (!country) errors.push('Country');
    if (!state) errors.push('State');
    if (!city.trim()) errors.push('City');
    if (!zipCode.trim()) errors.push('Zip Code');
    if (!aadhaarNumber.trim()) errors.push('Aadhaar Number');
    if (!joiningDate) errors.push('Joining Date');
    if (!amount.trim()) errors.push('Amount');
    if (!overtimeRate.trim()) errors.push('Over Time rates');
    if (email && (!email.includes('@') || !email.includes('.'))) errors.push('Valid Email');
    if (errors.length) {
      Alert.alert('Validation Error', `Please provide:\n\n• ${errors.join('\n• ')}`);
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      const employeeId = `EMP-${Date.now()}`;

      const payload: any = {
        employeeId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || undefined,
        phone: `${phoneCode} ${phone.trim()}`,
        salutation: salutation,
        dateOfBirth: dob ? dob.toISOString().split('T')[0] : undefined,
        designationId: skillId || undefined,  // Send designation UUID
        address: address.trim(),
        countryId: countryId || undefined,  // Send country UUID
        stateId: stateId || undefined,      // Send state UUID
        city: city.trim(),
        zipCode: zipCode.trim(),
        aadhaarNumber: aadhaarNumber.trim(),
        joiningDate: joiningDate ? joiningDate.toISOString().split('T')[0] : undefined,
        employmentType: employeeType,
        salaryType: payCalculation === 'Hourly rate' ? 'hourly' : payCalculation.toLowerCase(),
        salaryAmount: Number(amount) || 0,
        overtimeRate: Number(overtimeRate) || 0,
      };

      // Create the employee first
      const createRes = await api.post('/api/employees', payload);
      const newEmployeeId = createRes.data?.employee?.id;

      // If a photo is selected, upload it
      if (newEmployeeId && photoUri) {
        const formData = new FormData();
        const filename = photoUri.split('/').pop() || `employee-${newEmployeeId}.jpg`;
        const file: any = { uri: photoUri, name: filename, type: 'image/jpeg' };
        formData.append('photo', file);
        await api.post(`/api/employees/${newEmployeeId}/photo`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // If an aadhaar image is selected, upload it
      if (newEmployeeId && aadhaarFileUri) {
        const formData = new FormData();
        const filename = aadhaarFileUri.split('/').pop() || `aadhaar-${newEmployeeId}.jpg`;
        const file: any = { uri: aadhaarFileUri, name: filename, type: 'image/jpeg' };
        formData.append('aadhaar', file);
        await api.post(`/api/employees/${newEmployeeId}/aadhaar`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      Alert.alert('Success', 'Employee saved successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (e: any) {
      console.error('Save employee failed:', e);
      let msg = 'Failed to save employee.';
      if (e?.response?.data?.error) msg = e.response.data.error;
      if (e?.response?.data?.details?.length) {
        msg += `\n\n${e.response.data.details.map((d: any) => `• ${d.msg} (${d.path})`).join('\n')}`;
      }
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async (fromCamera: boolean) => {
    if (fromCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow camera access to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo library access to pick a photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    }
  };

  const pickAadhaarImage = async (fromCamera: boolean) => {
    if (fromCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow camera access to take a photo.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAadhaarFileUri(result.assets[0].uri);
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo library access to pick a photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAadhaarFileUri(result.assets[0].uri);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Employee</Text>
        <View style={styles.headerRight}>
          <View style={styles.notificationBadge}>
            <Ionicons name="notifications-outline" size={20} color="#333" />
            <View style={styles.badgeDot} />
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        {/* Personal & Contact Information Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal & Contact Information</Text>

          {/* Salutation */}
          <FloatingLabelDropdown
            label="Salutation"
            value={salutation}
            options={SALUTATIONS}
            onSelect={setSalutation}
            required
          />

          {/* First Name & Last Name */}
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <FloatingLabelInput
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                required
              />
            </View>
            <View style={styles.halfInput}>
              <FloatingLabelInput
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                required
              />
            </View>
          </View>

          {/* Date of Birth */}
          <FloatingLabelDateInput
            label="Date of birth"
            value={dob}
            onPress={() => setShowDob(true)}
          />

          {/* Designation/Skill */}
          {loadingDesignations ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#6C5CE7" />
              <Text style={styles.loadingText}>Loading designations...</Text>
            </View>
          ) : (
            <FloatingLabelDropdown
              label="Designation"
              value={skill}
              options={designations.map(d => d.name)}
              onSelect={handleSkillSelect}
              required
            />
          )}

          {/* Phone Number with Country Code */}
          <FloatingLabelPhoneInput
            label="Phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            phoneCode={phoneCode}
            onPhoneCodePress={() => setShowPhoneCodePicker(true)}
            required
          />

          {/* Email ID */}
          <FloatingLabelInput
            label="Email ID"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Address */}
          <FloatingLabelInput
            label="Address"
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={2}
            style={styles.addressInput}
            required
          />

          {/* Country */}
          {loadingCountries ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#6C5CE7" />
              <Text style={styles.loadingText}>Loading countries...</Text>
            </View>
          ) : (
            <FloatingLabelDropdown
              label="Country"
              value={country}
              options={countries.map(c => c.name)}
              onSelect={handleCountrySelect}
              required
            />
          )}

          {/* State */}
          {loadingStates ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#6C5CE7" />
              <Text style={styles.loadingText}>Loading states...</Text>
            </View>
          ) : (
            <FloatingLabelDropdown
              label="State"
              value={state}
              options={states.map(s => s.name)}
              onSelect={handleStateSelect}
              required
            />
          )}

          {/* City */}
          <FloatingLabelInput
            label="City"
            value={city}
            onChangeText={setCity}
            required
          />

          {/* Zip Code */}
          <FloatingLabelInput
            label="Zip Code"
            value={zipCode}
            onChangeText={setZipCode}
            keyboardType="numeric"
            required
          />

          {/* Upload Photograph */}
          <View style={styles.uploadSection}>
            <Text style={styles.uploadLabel}>Upload your photograph</Text>
            <Text style={styles.uploadHint}>png, jpg, Gif up to 2MB</Text>
            
            {photoUri ? (
              <View style={styles.photoPreviewContainer}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setPhotoUri(null)}>
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.uploadRow}>
                <View style={styles.addFilesContainer}>
                  <Text style={styles.addFilesText}>Add files</Text>
                  <TouchableOpacity style={styles.attachButton} onPress={() => pickImage(false)}>
                    <Text style={styles.attachButtonText}>Attach</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.cameraButton} onPress={() => pickImage(true)}>
                  <Ionicons name="camera" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Attachments Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Attachments</Text>

          {/* Aadhaar Number */}
          <FloatingLabelInput
            label="Aadhaar number"
            value={aadhaarNumber}
            onChangeText={setAadhaarNumber}
            keyboardType="numeric"
            maxLength={12}
            required
          />

          {/* Add Aadhaar File */}
          <View style={styles.uploadSection}>
            <Text style={styles.uploadLabel}>Upload Aadhaar Card</Text>
            <Text style={styles.uploadHint}>png, jpg, Gif up to 2MB</Text>
            
            {aadhaarFileUri ? (
              <View style={styles.photoPreviewContainer}>
                <Image source={{ uri: aadhaarFileUri }} style={styles.photoPreview} />
                <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setAadhaarFileUri(null)}>
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.uploadRow}>
                <View style={styles.addFilesContainer}>
                  <Text style={styles.addFilesText}>Add files</Text>
                  <TouchableOpacity style={styles.attachButton} onPress={() => pickAadhaarImage(false)}>
                    <Text style={styles.attachButtonText}>Attach</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.cameraButton} onPress={() => pickAadhaarImage(true)}>
                  <Ionicons name="camera" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Payments Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payments</Text>

          {/* Joining Date */}
          <FloatingLabelDateInput
            label="Joining Date"
            value={joiningDate}
            onPress={() => setShowJoiningDate(true)}
            required
          />

          {/* Employee Type */}
          <Text style={styles.fieldLabel}>Employee Type</Text>
          <View style={styles.pillsRow}>
            {(['Full Time', 'Temporary', 'Contract'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.pill, employeeType === type && styles.pillSelected]}
                onPress={() => setEmployeeType(type)}
              >
                <Text style={[styles.pillText, employeeType === type && styles.pillTextSelected]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Pay Calculation */}
          <Text style={styles.fieldLabel}>Pay Calculation</Text>
          <View style={styles.pillsRow}>
            {(['Monthly', 'Daily', 'Hourly rate'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.pill, payCalculation === type && styles.pillSelected]}
                onPress={() => setPayCalculation(type)}
              >
                <Text style={[styles.pillText, payCalculation === type && styles.pillTextSelected]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Amount */}
          <FloatingLabelInput
            label="Amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            required
          />

          {/* Over Time rates */}
          <FloatingLabelInput
            label="Over Time rates"
            value={overtimeRate}
            onChangeText={setOvertimeRate}
            keyboardType="numeric"
            required
          />
        </View>

        {/* Add Employee Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Add Employee</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Date Picker for DOB */}
      {showDob && (
        <DateTimePicker
          value={dob || new Date()}
          mode="date"
          display="default"
          onChange={(e, d) => {
            setShowDob(false);
            if (d) setDob(d);
          }}
        />
      )}

      {/* Date Picker for Joining Date */}
      {showJoiningDate && (
        <DateTimePicker
          value={joiningDate || new Date()}
          mode="date"
          display="default"
          onChange={(e, d) => {
            setShowJoiningDate(false);
            if (d) setJoiningDate(d);
          }}
        />
      )}

      {/* Phone Code Picker Modal */}
      <Modal visible={showPhoneCodePicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowPhoneCodePicker(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country Code</Text>
              <TouchableOpacity onPress={() => setShowPhoneCodePicker(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={PHONE_CODES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalOption, phoneCode === item.code && styles.modalOptionSelected]}
                  onPress={() => {
                    setPhoneCode(item.code);
                    setShowPhoneCodePicker(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, phoneCode === item.code && styles.modalOptionTextSelected]}>
                    {item.code} ({item.country})
                  </Text>
                  {phoneCode === item.code && <Ionicons name="checkmark" size={20} color="#6C5CE7" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationBadge: {
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6C5CE7',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  // Floating Label Input Styles
  floatingContainer: {
    position: 'relative',
    paddingTop: 4,
    marginBottom: 12,
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
    color: PRIMARY_PURPLE,
  },
  floatingInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 15,
    color: TEXT_DARK,
    minHeight: 50,
  },
  floatingInputWithLabel: {
    paddingTop: 18,
    paddingBottom: 10,
  },
  floatingInputFocused: {
    borderColor: PRIMARY_PURPLE,
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
  floatingCountryCode: {
    fontSize: 15,
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
    fontSize: 15,
    color: TEXT_DARK,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  floatingPhoneInputWithLabel: {
    paddingTop: 18,
    paddingBottom: 10,
  },
  // Floating Dropdown Styles
  floatingDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    minHeight: 50,
  },
  floatingDropdownWithLabel: {
    paddingTop: 18,
    paddingBottom: 10,
  },
  floatingDropdownText: {
    fontSize: 15,
    color: TEXT_DARK,
  },
  floatingDropdownPlaceholder: {
    color: '#999',
  },
  // Floating Date Input Styles
  floatingDateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    minHeight: 50,
  },
  floatingDateInputWithLabel: {
    paddingTop: 18,
    paddingBottom: 10,
  },
  floatingDateText: {
    fontSize: 15,
    color: TEXT_DARK,
  },
  // Other Styles
  addressInput: {
    height: 70,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  uploadSection: {
    marginTop: 8,
  },
  uploadLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  uploadHint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  uploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addFilesContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 4,
    backgroundColor: '#fff',
  },
  addFilesText: {
    fontSize: 14,
    color: '#999',
  },
  attachButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#6C5CE7',
    borderRadius: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  attachButtonText: {
    fontSize: 14,
    color: '#6C5CE7',
    fontWeight: '500',
  },
  cameraButton: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#6C5CE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoPreviewContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#E5E5E5',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  // Payments styles
  fieldLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    marginTop: 4,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#fff',
  },
  pillSelected: {
    backgroundColor: '#6C5CE7',
    borderColor: '#6C5CE7',
  },
  pillText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  pillTextSelected: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#6C5CE7',
    marginHorizontal: 16,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#B8B5C4',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  modalOptionSelected: {
    backgroundColor: '#F8F7FF',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#333',
  },
  modalOptionTextSelected: {
    color: '#6C5CE7',
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    marginBottom: 12,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#666',
  },
});

