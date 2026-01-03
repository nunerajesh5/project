import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  ActivityIndicator, 
  Alert, 
  TouchableOpacity,
  Switch,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import SafeAreaWrapper from '../../components/shared/SafeAreaWrapper';
import { dashboardApi } from '../../api/dashboard';

const PRIMARY_PURPLE = '#877ED2';
const LIGHT_PURPLE = '#E8E7ED';
const BG_COLOR = '#F5F5F8';

type Role = 'manager' | 'employee';
type PermissionAction = 'view' | 'add' | 'edit' | 'delete';

interface Employee {
  id: string;
  name: string;
  role: string;
}

interface PermissionCategory {
  id: string;
  name: string;
  permissions: {
    view: boolean;
    add: boolean;
    edit: boolean;
    delete: boolean;
  };
}

export default function AdminPermissionsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'role' | 'individual'>('individual');
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  
  // Permission categories matching the design
  const [permissionCategories, setPermissionCategories] = useState<PermissionCategory[]>([
    {
      id: 'manage_client',
      name: 'Manage Client',
      permissions: { view: false, add: false, edit: false, delete: false },
    },
    {
      id: 'manage_project',
      name: 'Manage Project',
      permissions: { view: false, add: false, edit: false, delete: false },
    },
    {
      id: 'manage_task',
      name: 'Manage Task',
      permissions: { view: true, add: true, edit: true, delete: false },
    },
    {
      id: 'manage_employee',
      name: 'Manage Employee',
      permissions: { view: true, add: false, edit: true, delete: false },
    },
    {
      id: 'manage_attachments',
      name: 'Manage Attachments',
      permissions: { view: true, add: true, edit: true, delete: true },
    },
  ]);

  const [expensePermissions, setExpensePermissions] = useState({
    view: true,
    approve: true,
  });

  const [attendancePermissions, setAttendancePermissions] = useState({
    view: true,
    approve: true,
  });

  const [otherPermissions, setOtherPermissions] = useState({
    setTaskPriority: true,
    approveAttendance: true,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Load employees for the dropdown
      const employeesData = await dashboardApi.getEmployees();
      console.log('Employees API response:', employeesData);
      if (employeesData?.employees && Array.isArray(employeesData.employees)) {
        const mappedEmployees = employeesData.employees.map((emp: any) => ({
          id: String(emp.id),
          name: emp.name || emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
          role: emp.role || emp.department || emp.position || 'Employee',
        }));
        console.log('Mapped employees:', mappedEmployees);
        setEmployees(mappedEmployees);
      } else if (Array.isArray(employeesData)) {
        // Handle case where API returns array directly
        const mappedEmployees = employeesData.map((emp: any) => ({
          id: String(emp.id),
          name: emp.name || emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
          role: emp.role || emp.department || emp.position || 'Employee',
        }));
        console.log('Mapped employees (array):', mappedEmployees);
        setEmployees(mappedEmployees);
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (categoryId: string, action: PermissionAction) => {
    setPermissionCategories(prev => 
      prev.map(cat => 
        cat.id === categoryId 
          ? { 
              ...cat, 
              permissions: { 
                ...cat.permissions, 
                [action]: !cat.permissions[action] 
              } 
            }
          : cat
      )
    );
  };

  const toggleExpensePermission = (action: 'view' | 'approve') => {
    setExpensePermissions(prev => ({
      ...prev,
      [action]: !prev[action],
    }));
  };

  const toggleAttendancePermission = (action: 'view' | 'approve') => {
    setAttendancePermissions(prev => ({
      ...prev,
      [action]: !prev[action],
    }));
  };

  const toggleOtherPermission = (action: 'setTaskPriority' | 'approveAttendance') => {
    setOtherPermissions(prev => ({
      ...prev,
      [action]: !prev[action],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save permissions logic here
      Alert.alert('Success', 'Permissions updated successfully');
    } catch (err: any) {
      Alert.alert('Error', 'Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaWrapper backgroundColor={BG_COLOR}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_PURPLE} />
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper backgroundColor={BG_COLOR}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={24} color="#101010" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Permission</Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'role' && styles.tabActive]}
            onPress={() => setActiveTab('role')}
          >
            <Text style={[styles.tabText, activeTab === 'role' && styles.tabTextActive]}>
              By Role
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'individual' && styles.tabActive]}
            onPress={() => setActiveTab('individual')}
          >
            <Text style={[styles.tabText, activeTab === 'individual' && styles.tabTextActive]}>
              By Individual
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dropdown Selector */}
        {activeTab === 'role' ? (
          <TouchableOpacity 
            style={styles.dropdown}
            onPress={() => setShowRoleDropdown(true)}
          >
            <Text style={[styles.dropdownText, !selectedRole && styles.dropdownPlaceholder]}>
              {selectedRole ? selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1) : 'Select Role'}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.dropdown}
            onPress={() => setShowEmployeeDropdown(true)}
          >
            <Text style={[styles.dropdownText, !selectedEmployee && styles.dropdownPlaceholder]}>
              {selectedEmployee?.name || 'Select Employee'}
            </Text>
            <Ionicons name="chevron-down" size={22} color="#8F8F8F" />
          </TouchableOpacity>
        )}

        {/* Permissions Table */}
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Main Permissions Card */}
          <View style={styles.card}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <View style={styles.tableHeaderEmpty} />
              <Text style={styles.tableHeaderText}>View</Text>
              <Text style={styles.tableHeaderText}>Add</Text>
              <Text style={styles.tableHeaderText}>Edit</Text>
              <Text style={styles.tableHeaderText}>Delete</Text>
            </View>

            {/* Permission Rows */}
            {permissionCategories.map((category) => (
              <View key={category.id} style={styles.permissionRow}>
                <Text style={styles.permissionName}>{category.name}</Text>
                <View style={styles.togglesRow}>
                  <Switch
                    value={category.permissions.view}
                    onValueChange={() => togglePermission(category.id, 'view')}
                    trackColor={{ false: '#E0E0E0', true: PRIMARY_PURPLE }}
                    thumbColor="#fff"
                    style={styles.switch}
                  />
                  <Switch
                    value={category.permissions.add}
                    onValueChange={() => togglePermission(category.id, 'add')}
                    trackColor={{ false: '#E0E0E0', true: PRIMARY_PURPLE }}
                    thumbColor="#fff"
                    style={styles.switch}
                  />
                  <Switch
                    value={category.permissions.edit}
                    onValueChange={() => togglePermission(category.id, 'edit')}
                    trackColor={{ false: '#E0E0E0', true: PRIMARY_PURPLE }}
                    thumbColor="#fff"
                    style={styles.switch}
                  />
                  <Switch
                    value={category.permissions.delete}
                    onValueChange={() => togglePermission(category.id, 'delete')}
                    trackColor={{ false: '#E0E0E0', true: PRIMARY_PURPLE }}
                    thumbColor="#fff"
                    style={styles.switch}
                  />
                </View>
              </View>
            ))}

            {/* Expenses Row - Special case with View and Approve */}
            <View style={styles.permissionRow}>
            <Text style={styles.permissionName}>Expenses</Text>
            <View style={styles.expenseTogglesRow}>
              <View style={styles.expenseToggle}>
                <Text style={styles.expenseLabel}>View</Text>
                <Switch
                  value={expensePermissions.view}
                  onValueChange={() => toggleExpensePermission('view')}
                  trackColor={{ false: '#E0E0E0', true: PRIMARY_PURPLE }}
                  thumbColor="#fff"
                  style={styles.expenseSwitch}
                />
              </View>
              <View style={styles.expenseToggle}>
                <Text style={styles.expenseLabel}>Approve</Text>
                <Switch
                  value={expensePermissions.approve}
                  onValueChange={() => toggleExpensePermission('approve')}
                  trackColor={{ false: '#E0E0E0', true: PRIMARY_PURPLE }}
                  thumbColor="#fff"
                  style={styles.expenseSwitch}
                />
              </View>
            </View>
          </View>

            {/* Attendance Row - with View and Approve */}
            <View style={styles.permissionRow}>
              <Text style={styles.permissionName}>Attendance</Text>
              <View style={styles.expenseTogglesRow}>
                <View style={styles.expenseToggle}>
                  <Text style={styles.expenseLabel}>View</Text>
                  <Switch
                    value={attendancePermissions.view}
                    onValueChange={() => toggleAttendancePermission('view')}
                    trackColor={{ false: '#E0E0E0', true: PRIMARY_PURPLE }}
                    thumbColor="#fff"
                    style={styles.expenseSwitch}
                  />
                </View>
                <View style={styles.expenseToggle}>
                  <Text style={styles.expenseLabel}>Approve</Text>
                  <Switch
                    value={attendancePermissions.approve}
                    onValueChange={() => toggleAttendancePermission('approve')}
                    trackColor={{ false: '#E0E0E0', true: PRIMARY_PURPLE }}
                    thumbColor="#fff"
                    style={styles.expenseSwitch}
                  />
                </View>
              </View>
            </View>

            {/* Set task priority */}
            <View style={styles.singlePermissionRow}>
              <Text style={styles.permissionName}>Set task priority</Text>
              <Switch
                value={otherPermissions.setTaskPriority}
                onValueChange={() => toggleOtherPermission('setTaskPriority')}
                trackColor={{ false: '#E0E0E0', true: PRIMARY_PURPLE }}
                thumbColor="#fff"
                style={styles.switch}
              />
            </View>

            {/* Approve attendance */}
            <View style={styles.singlePermissionRowLast}>
              <Text style={styles.permissionName}>Approve attendance</Text>
              <Switch
                value={otherPermissions.approveAttendance}
                onValueChange={() => toggleOtherPermission('approveAttendance')}
                trackColor={{ false: '#E0E0E0', true: PRIMARY_PURPLE }}
                thumbColor="#fff"
                style={styles.switch}
              />
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Permission Settings'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Role Dropdown Modal */}
        <Modal
          visible={showRoleDropdown}
          transparent
          animationType="fade"
          onRequestClose={() => setShowRoleDropdown(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowRoleDropdown(false)}
          >
            <View style={styles.dropdownModal}>
              {(['manager', 'employee'] as Role[]).map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.dropdownItem,
                    selectedRole === role && styles.dropdownItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedRole(role);
                    setShowRoleDropdown(false);
                  }}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    selectedRole === role && styles.dropdownItemTextSelected,
                  ]}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </Text>
                  {selectedRole === role && (
                    <Ionicons name="checkmark" size={20} color={PRIMARY_PURPLE} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Employee Dropdown Modal */}
        <Modal
          visible={showEmployeeDropdown}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEmployeeDropdown(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowEmployeeDropdown(false)}
          >
            <TouchableOpacity 
              style={styles.dropdownModal}
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              <FlatList
                data={employees}
                keyExtractor={(item) => item.id}
                ListEmptyComponent={
                  <View style={styles.emptyListContainer}>
                    <Text style={styles.emptyListText}>No employees found</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.dropdownItem,
                      selectedEmployee?.id === item.id && styles.dropdownItemSelected,
                    ]}
                    onPress={() => {
                      setSelectedEmployee(item);
                      setShowEmployeeDropdown(false);
                    }}
                  >
                    <View>
                      <Text style={[
                        styles.dropdownItemText,
                        selectedEmployee?.id === item.id && styles.dropdownItemTextSelected,
                      ]}>
                        {item.name}
                      </Text>
                      <Text style={styles.dropdownItemRole}>{item.role}</Text>
                    </View>
                    {selectedEmployee?.id === item.id && (
                      <Ionicons name="checkmark" size={20} color={PRIMARY_PURPLE} />
                    )}
                  </TouchableOpacity>
                )}
                style={styles.employeeList}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 12,
    backgroundColor: BG_COLOR,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
    color: '#000000',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginRight: 24,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  tabText: {
    fontSize: 16,
    color: '#8F8F8F',
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
  },
  tabTextActive: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 24,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dropdownText: {
    fontSize: 14,
    color: '#000',
  },
  dropdownPlaceholder: {
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
    color: '#727272',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E7ED',
  },
  tableHeaderEmpty: {
    width: 10,
  },
  tableHeaderText: {
    width: 88,
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    color: '#404040',
    textAlign: 'center',
  },
  permissionRow: {
    paddingTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E7ED',
  },
  permissionName: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    color: '#404040',

  },
  togglesRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: -6,
    paddingRight: 8,
  },
  switch: {
    width: 88,
    transform: [{ scaleX: 1.0 }, { scaleY: 1.0 }],
  },
  expenseTogglesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 80,
    paddingRight: 10,
  },
  expenseToggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 2,
  },
  expenseSwitch: {
    transform: [{ scaleX: 1.0 }, { scaleY: 1.0 }],
  },
  singlePermissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E7ED',
    paddingRight: 10,
  },
  singlePermissionRowLast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 1,
    paddingRight: 10,
  },
  saveButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: BG_COLOR,
  },
  saveButton: {
    backgroundColor: PRIMARY_PURPLE,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '80%',
    maxHeight: 300,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  dropdownItemSelected: {
    backgroundColor: LIGHT_PURPLE,
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#000',
  },
  dropdownItemTextSelected: {
    color: PRIMARY_PURPLE,
    fontWeight: '500',
  },
  dropdownItemRole: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  employeeList: {
    maxHeight: 280,
  },
  emptyListContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 14,
    color: '#888',
  },
});


