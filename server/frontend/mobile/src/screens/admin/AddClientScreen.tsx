import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { api } from '../../api/client';
import Card from '../../components/shared/Card';
import Button from '../../components/shared/Button';
import AppHeader from '../../components/shared/AppHeader';
import VoiceToTextButton from '../../components/shared/VoiceToTextButton';

const SALUTATIONS = ['Mr.', 'Ms.', 'Mrs.', 'Dr.', 'Prof.'];

export default function AddClientScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    salutation: '',
    firstName: '',
    lastName: '',
    gst: '',
    email: '',
    phone: '',
    address: '',
  });
  const [showSalutationPicker, setShowSalutationPicker] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [addedProjects, setAddedProjects] = useState<any[]>([]);

  // Reload projects when returning from Add Project screen
  useFocusEffect(
    React.useCallback(() => {
      if (clientId) {
        loadClientProjects();
      }
    }, [clientId])
  );

  const loadClientProjects = async () => {
    if (!clientId) return;
    
    try {
      // Prefer the dedicated endpoint
      try {
        const res = await api.get(`/api/clients/${clientId}/projects`, { params: { page: 1, limit: 100 } });
        const projects = res.data?.projects || [];
        setAddedProjects(projects);
        return;
      } catch (e) {
        // Fallback to generic endpoint with correct param name
        const fallback = await api.get('/api/projects', { params: { page: 1, limit: 100, clientId } });
        const projects = fallback.data?.projects || [];
        setAddedProjects(projects);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = () => {
    // First Name - Required
    if (!formData.firstName.trim()) {
      Alert.alert('Validation Error', 'First name is required');
      return false;
    }
    
    // Last Name - Required
    if (!formData.lastName.trim()) {
      Alert.alert('Validation Error', 'Last name is required');
      return false;
    }
    
    // Email - Required with validation
    if (!formData.email.trim()) {
      Alert.alert('Validation Error', 'Email address is required');
      return false;
    }
    
    if (!formData.email.includes('@') || !formData.email.includes('.')) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return false;
    }
    
    // Phone - Required
    if (!formData.phone.trim()) {
      Alert.alert('Validation Error', 'Phone number is required');
      return false;
    }
    
    // Address - Required
    if (!formData.address.trim()) {
      Alert.alert('Validation Error', 'Address is required');
      return false;
    }
    
    // GST Number - Optional but validate format if provided
    if (formData.gst.trim()) {
      const gst = formData.gst.trim();
      if (gst.length !== 15) {
        Alert.alert('Validation Error', 'GST number must be exactly 15 characters');
        return false;
      }
      // Validate GSTIN format: 2 digit state code + 10 char PAN + 1 entity code + Z + 1 checksum
      const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
      if (!gstRegex.test(gst)) {
        Alert.alert('Validation Error', 'Invalid GST number format.\n\nFormat: State Code(2) + PAN(10) + Entity(1) + Z + Checksum(1)\n\nExample: 27ABCDE1234F1Z5');
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      console.log('Creating new client:', formData);
      const payload = {
        salutation: formData.salutation.trim() || null,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        gstNumber: formData.gst.trim() || null,
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
      } as any;

      let savedClientId = clientId;
      if (clientId) {
        // Update existing client (created earlier via Add Projects)
        const res = await api.put(`/api/clients/${clientId}`, payload);
        console.log('Client updated successfully:', res.data);
        savedClientId = res.data?.client?.id || clientId;
      } else {
        // Create new client now
        const res = await api.post('/api/clients', payload);
        console.log('Client created successfully:', res.data);
        savedClientId = res.data?.client?.id;
        setClientId(savedClientId);
      }
      
      Alert.alert(
        'Success',
        clientId ? 'Client updated successfully!' : 'Client added successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate back to clients screen
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error creating client:', error);
      
      let errorMessage = 'Failed to add client. Please try again.';
      
      if (error.response?.status === 409) {
        errorMessage = 'A client with this email already exists.';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (formData.firstName || formData.lastName || formData.email || formData.phone || formData.address) {
      Alert.alert(
        'Discard Changes',
        'Are you sure you want to discard your changes?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Card style={styles.formCard}>
          <View style={styles.form}>
            {/* Salutation */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Salutation</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowSalutationPicker(true)}
              >
                <Text style={[styles.pickerButtonText, !formData.salutation && styles.placeholder]}>
                  {formData.salutation || 'Select salutation (e.g., Mr., Ms., Dr.)'}
                </Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* First Name */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{t('auth.first_name')} *</Text>
                <VoiceToTextButton
                  onResult={(text) => handleInputChange('firstName', text)}
                  size="small"
                />
              </View>
              <TextInput
                style={styles.input}
                value={formData.firstName}
                onChangeText={(value) => handleInputChange('firstName', value)}
                placeholder={t('auth.first_name')}
                placeholderTextColor="#999"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Last Name */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>{t('auth.last_name')} *</Text>
                <VoiceToTextButton
                  onResult={(text) => handleInputChange('lastName', text)}
                  size="small"
                />
              </View>
              <TextInput
                style={styles.input}
                value={formData.lastName}
                onChangeText={(value) => handleInputChange('lastName', value)}
                placeholder={t('auth.last_name')}
                placeholderTextColor="#999"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* GST */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>GST Number</Text>
              <Text style={styles.sampleText}>Format: 27ABCDE1234F1Z5 (15 characters)</Text>
              <TextInput
                style={styles.input}
                value={formData.gst}
                onChangeText={(value) => handleInputChange('gst', value.toUpperCase())}
                placeholder="e.g. 27ABCDE1234F1Z5"
                placeholderTextColor="#999"
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={15}
              />
            </View>

            {/* Email */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('auth.email')} *</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(value) => handleInputChange('email', value)}
                placeholder={t('auth.enter_email')}
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Phone */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('auth.phone_number')} *</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(value) => handleInputChange('phone', value)}
                placeholder={t('auth.enter_phone')}
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                autoCorrect={false}
              />
            </View>

            {/* Address */}
            <View style={styles.inputGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Address *</Text>
                <VoiceToTextButton
                  onResult={(text) => handleInputChange('address', formData.address ? `${formData.address} ${text}` : text)}
                  size="small"
                />
              </View>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.address}
                onChangeText={(value) => handleInputChange('address', value)}
                placeholder="Enter full street address, city, state, zip/post code"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        </Card>

        {/* Salutation Picker Modal */}
        <Modal
          visible={showSalutationPicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSalutationPicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeaderRow}>
                <Text style={styles.modalTitle}>Select Salutation</Text>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setShowSalutationPicker(false)}
                >
                  <Text style={styles.modalCloseIcon}>✕</Text>
                </TouchableOpacity>
              </View>
              {SALUTATIONS.map((salutation) => {
                const selected = formData.salutation === salutation;
                return (
                  <TouchableOpacity
                    key={salutation}
                    style={[styles.modalOptionRow, selected && styles.modalOptionRowSelected]}
                    activeOpacity={0.8}
                    onPress={() => {
                      handleInputChange('salutation', salutation);
                      setShowSalutationPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalOptionText,
                        selected && styles.modalOptionTextSelected,
                      ]}
                    >
                      {salutation}
                    </Text>
                    <View style={[styles.modalRadioOuter, selected && styles.modalRadioOuterActive]}>
                      {selected && <View style={styles.modalRadioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Modal>

        {/* Add Projects Button */}
        <View style={styles.addProjectsContainer}>
          <View style={styles.addProjectsHeader}>
            <Text style={styles.addProjectsTitle}>Projects</Text>
            <TouchableOpacity
              style={styles.addProjectsButton}
              onPress={async () => {
                try {
                  // Ensure all required client fields entered first
                  if (!validateForm()) return;

                  let currentClientId = clientId;
                  if (!currentClientId) {
                    setLoading(true);
                    const res = await api.post('/api/clients', {
                      salutation: formData.salutation.trim() || null,
                      firstName: formData.firstName.trim(),
                      lastName: formData.lastName.trim(),
                      gstNumber: formData.gst.trim() || null,
                      email: formData.email.trim(),
                      phone: formData.phone.trim(),
                      address: formData.address.trim(),
                    });
                    currentClientId = res.data?.client?.id;
                    setClientId(currentClientId);
                  }

                  const clientName = `${formData.firstName} ${formData.lastName}`.trim();
                  navigation.navigate('AddProject', {
                    clientId: currentClientId,
                    clientName,
                    onProjectAdded: (project: any) => {
                      setAddedProjects(prev => [...prev, project]);
                    },
                  });
                } catch (error: any) {
                  let errorMessage = 'Failed to add client before creating projects.';
                  if (error.response?.status === 409) {
                    errorMessage = 'A client with this email already exists.';
                  } else if (error.response?.data?.error) {
                    errorMessage = error.response.data.error;
                  }
                  Alert.alert('Error', errorMessage);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
            <Text style={styles.addProjectsButtonText}>➕ Add Projects</Text>
          </TouchableOpacity>
          </View>

          {/* Display Added Projects */}
          {addedProjects.length > 0 && (
            <View style={styles.projectsList}>
              {addedProjects.map((project, index) => (
                <View key={index} style={styles.projectCard}>
                  <Text style={styles.projectName}>{project.name}</Text>
                  <Text style={styles.projectDetails}>
                    Budget: ${project.budget?.toLocaleString() || 'N/A'}
                  </Text>
                  {project.description && (
                    <Text style={styles.projectDescription} numberOfLines={2}>
                      {project.description}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>{t('clients.add_client')}</Text>
            )}
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  formCard: {
    margin: 16,
    padding: 20,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  sampleText: {
    fontSize: 12,
    color: '#007AFF',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    paddingBottom: 32,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#1a1a1a',
    flex: 1,
  },
  placeholder: {
    color: '#999',
  },
  pickerArrow: {
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
      padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  modalTitle: {
      fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
      flex: 1,
      textAlign: 'center',
      marginRight: -32,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
  },
  modalCloseIcon: {
    fontSize: 20,
    color: '#666',
    fontWeight: '300',
  },
  modalOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  modalOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#1a1a1a',
    textAlign: 'left',
  },
  modalOptionTextSelected: {
    fontWeight: '700',
    color: '#0b63ff',
  },
  modalOptionRowSelected: {
    backgroundColor: '#f5f9ff',
  },
  modalRadioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#c7d7fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalRadioOuterActive: {
    borderColor: '#0b63ff',
    backgroundColor: '#e8f0ff',
  },
  modalRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0b63ff',
  },
  addProjectsContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  addProjectsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addProjectsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  addProjectsButton: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addProjectsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  projectsList: {
    gap: 12,
  },
  projectCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  projectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  projectDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  projectDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 6,
  },
});
