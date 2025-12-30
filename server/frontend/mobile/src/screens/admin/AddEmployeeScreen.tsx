import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image, Modal, FlatList } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../api/client';
import { Ionicons } from '@expo/vector-icons';

// Dropdown data
const SALUTATIONS = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.'];
const SKILLS = ['Developer', 'Designer', 'Manager', 'Analyst', 'Engineer', 'Consultant', 'Architect', 'QA Engineer', 'DevOps', 'Data Scientist'];
const COUNTRIES = ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Singapore', 'UAE', 'Japan'];
const STATES: { [key: string]: string[] } = {
  'India': ['Andhra Pradesh', 'Karnataka', 'Tamil Nadu', 'Maharashtra', 'Delhi', 'Gujarat', 'Rajasthan', 'West Bengal', 'Kerala', 'Telangana'],
  'United States': ['California', 'Texas', 'New York', 'Florida', 'Illinois', 'Pennsylvania', 'Ohio', 'Georgia', 'Michigan', 'Washington'],
  'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  'Canada': ['Ontario', 'Quebec', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan'],
  'Australia': ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia'],
  'Germany': ['Bavaria', 'Berlin', 'Hamburg', 'Hesse', 'North Rhine-Westphalia'],
  'France': ['Île-de-France', 'Provence-Alpes-Côte d\'Azur', 'Occitanie', 'Nouvelle-Aquitaine'],
  'Singapore': ['Central Region', 'East Region', 'North Region', 'North-East Region', 'West Region'],
  'UAE': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Fujairah'],
  'Japan': ['Tokyo', 'Osaka', 'Kyoto', 'Hokkaido', 'Fukuoka'],
};
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

interface DropdownProps {
  placeholder: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  required?: boolean;
}

const Dropdown: React.FC<DropdownProps> = ({ placeholder, value, options, onSelect, required }) => {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity style={styles.dropdown} onPress={() => setVisible(true)}>
        <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}>
          {value || placeholder}{required ? '*' : ''}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#666" />
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{placeholder}</Text>
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
};

export default function AddEmployeeScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  const [saving, setSaving] = useState(false);

  // Personal & Contact Information
  const [salutation, setSalutation] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [showDob, setShowDob] = useState(false);
  const [skill, setSkill] = useState('');
  const [phoneCode, setPhoneCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [showPhoneCodePicker, setShowPhoneCodePicker] = useState(false);
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Attachments
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [aadhaarFileUri, setAadhaarFileUri] = useState<string | null>(null);

  // Payments
  const [joiningDate, setJoiningDate] = useState<Date | null>(null);
  const [showJoiningDate, setShowJoiningDate] = useState(false);
  const [employeeType, setEmployeeType] = useState<'Full Time' | 'Temporary' | 'Contract'>('Full Time');
  const [payCalculation, setPayCalculation] = useState<'Monthly' | 'Daily' | 'Hourly rate'>('Monthly');
  const [amount, setAmount] = useState('');

  const validate = () => {
    const errors: string[] = [];
    if (!salutation) errors.push('Salutation');
    if (!firstName.trim()) errors.push('First Name');
    if (!lastName.trim()) errors.push('Last Name');
    if (!skill) errors.push('Skill');
    if (!phone.trim()) errors.push('Phone Number');
    if (!address.trim()) errors.push('Address');
    if (!country) errors.push('Country');
    if (!state) errors.push('State');
    if (!city.trim()) errors.push('City');
    if (!zipCode.trim()) errors.push('Zip Code');
    if (!aadhaarNumber.trim()) errors.push('Aadhaar Number');
    if (!joiningDate) errors.push('Joining Date');
    if (!amount.trim()) errors.push('Amount');
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
        skill: skill,
        address: address.trim(),
        country: country,
        state: state,
        city: city.trim(),
        zipCode: zipCode.trim(),
        aadhaarNumber: aadhaarNumber.trim(),
        joiningDate: joiningDate ? joiningDate.toISOString().split('T')[0] : undefined,
        employmentType: employeeType,
        salaryType: payCalculation.toLowerCase().replace(' ', '_'),
        salaryAmount: Number(amount) || 0,
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
          <Dropdown
            placeholder="Salutation"
            value={salutation}
            options={SALUTATIONS}
            onSelect={setSalutation}
            required
          />

          {/* First Name & Last Name */}
          <View style={styles.row}>
            <View style={styles.halfInput}>
              <TextInput
                style={styles.input}
                placeholder="First name*"
                placeholderTextColor="#999"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View style={styles.halfInput}>
              <TextInput
                style={styles.input}
                placeholder="Last name*"
                placeholderTextColor="#999"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          {/* Date of Birth */}
          <TouchableOpacity style={styles.dateInput} onPress={() => setShowDob(true)}>
            <Text style={[styles.dateText, !dob && styles.placeholderText]}>
              {dob ? dob.toLocaleDateString('en-GB') : 'Date of birth'}
            </Text>
            <Ionicons name="calendar-outline" size={20} color="#6C5CE7" />
          </TouchableOpacity>

          {/* Skill */}
          <Dropdown
            placeholder="Skill"
            value={skill}
            options={SKILLS}
            onSelect={setSkill}
            required
          />

          {/* Phone Number with Country Code */}
          <TouchableOpacity style={styles.dropdown} onPress={() => setShowPhoneCodePicker(true)}>
            <View style={styles.phoneInputContainer}>
              <Text style={styles.phoneCode}>{phoneCode}</Text>
              <TextInput
                style={styles.phoneInput}
                placeholder="Phone number*"
                placeholderTextColor="#999"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>

          {/* Email ID */}
          <View style={styles.dropdown}>
            <TextInput
              style={styles.inputNoBorder}
              placeholder="Email ID"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Ionicons name="chevron-down" size={20} color="#666" />
          </View>

          {/* Address */}
          <TextInput
            style={[styles.input, styles.addressInput]}
            placeholder="Address*"
            placeholderTextColor="#999"
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={2}
          />

          {/* Country */}
          <Dropdown
            placeholder="Country"
            value={country}
            options={COUNTRIES}
            onSelect={(val) => {
              setCountry(val);
              setState(''); // Reset state when country changes
            }}
            required
          />

          {/* State */}
          <Dropdown
            placeholder="State"
            value={state}
            options={country ? (STATES[country] || []) : []}
            onSelect={setState}
            required
          />

          {/* City */}
          <TextInput
            style={styles.input}
            placeholder="City*"
            placeholderTextColor="#999"
            value={city}
            onChangeText={setCity}
          />

          {/* Zip Code */}
          <TextInput
            style={styles.input}
            placeholder="Zip Code*"
            placeholderTextColor="#999"
            value={zipCode}
            onChangeText={setZipCode}
            keyboardType="numeric"
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
          <TextInput
            style={styles.input}
            placeholder="Aadhaar number*"
            placeholderTextColor="#999"
            value={aadhaarNumber}
            onChangeText={setAadhaarNumber}
            keyboardType="numeric"
            maxLength={12}
          />

          {/* Add Aadhaar File */}
          <View style={styles.attachFileRow}>
            <Text style={styles.attachFileText}>
              {aadhaarFileUri ? 'Aadhaar file added' : 'Add Aadhaar file'}
            </Text>
            <TouchableOpacity
              onPress={async () => {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                  Alert.alert('Permission required', 'Please allow photo library access.');
                  return;
                }
                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.All,
                  quality: 0.8,
                });
                if (!result.canceled && result.assets && result.assets.length > 0) {
                  setAadhaarFileUri(result.assets[0].uri);
                }
              }}
            >
              <Text style={styles.attachLinkText}>Attach</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Payments Card */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payments</Text>

          {/* Joining Date */}
          <TouchableOpacity style={styles.dateInput} onPress={() => setShowJoiningDate(true)}>
            <Text style={[styles.dateText, !joiningDate && styles.placeholderText]}>
              {joiningDate ? joiningDate.toLocaleDateString('en-GB') : 'Joining Date'}
            </Text>
            <Ionicons name="calendar-outline" size={20} color="#6C5CE7" />
          </TouchableOpacity>

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
          <TextInput
            style={styles.input}
            placeholder="Amount*"
            placeholderTextColor="#999"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
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
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  inputNoBorder: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 0,
  },
  addressInput: {
    height: 60,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  halfInput: {
    flex: 1,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  dropdownText: {
    fontSize: 15,
    color: '#333',
  },
  dropdownPlaceholder: {
    color: '#999',
  },
  dateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    marginBottom: 12,
  },
  dateText: {
    fontSize: 15,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  phoneCode: {
    fontSize: 15,
    color: '#333',
    marginRight: 8,
    fontWeight: '500',
  },
  phoneInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    paddingVertical: 0,
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
  // Attachments styles
  attachFileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
  },
  attachFileText: {
    fontSize: 15,
    color: '#999',
  },
  attachLinkText: {
    fontSize: 15,
    color: '#6C5CE7',
    fontWeight: '500',
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
});

