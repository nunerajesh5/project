import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  ActivityIndicator, 
  StyleSheet, 
  TouchableOpacity, 
  RefreshControl, 
  TextInput,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { api } from '../../api/client';
import SafeAreaWrapper from '../../components/shared/SafeAreaWrapper';

const PRIMARY_PURPLE = '#877ED2';
const BG_COLOR = '#F0F0F0';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  name?: string;
  department: string;
  is_active: boolean;
  photo_url?: string;
  email?: string;
  phone?: string;
  salary?: number;
  overtime_rate?: number;
  location?: string;
  employment_type?: string;
}

export default function EmployeesScreen() {
  const navigation = useNavigation<any>();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [departments, setDepartments] = useState<string[]>(['All']);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedEmployeeId(expandedEmployeeId === id ? null : id);
  };

  const handleEditEmployee = (employee: Employee) => {
    navigation.navigate('EditEmployee', { id: employee.id });
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    // TODO: Implement delete confirmation and API call
    console.log('Delete employee:', employee.id);
  };

  const loadEmployees = async () => {
    try {
      const res = await api.get('/api/employees', { params: { limit: 100 } });
      const list = Array.isArray(res.data?.employees) ? res.data.employees : [];
      setEmployees(list);
      
      // Extract unique departments
      const depts = ['All', ...new Set(list.map((emp: Employee) => emp.department).filter(Boolean))] as string[];
      setDepartments(depts);
      
      filterEmployees(list, searchQuery, selectedDepartment);
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const filterEmployees = useCallback((empList: Employee[], search: string, dept: string) => {
    let filtered = empList;
    
    // Filter by department
    if (dept !== 'All') {
      filtered = filtered.filter(emp => emp.department === dept);
    }
    
    // Filter by search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(emp => {
        const name = emp.name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
        return name.toLowerCase().includes(searchLower) || 
               emp.department?.toLowerCase().includes(searchLower);
      });
    }
    
    setFilteredEmployees(filtered);
  }, []);

  useEffect(() => {
    loadEmployees().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    filterEmployees(employees, searchQuery, selectedDepartment);
  }, [searchQuery, selectedDepartment, employees, filterEmployees]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEmployees();
    setRefreshing(false);
  };

  const getActiveCount = () => filteredEmployees.filter(emp => emp.is_active).length;
  const getOffDutyCount = () => filteredEmployees.filter(emp => !emp.is_active).length;

  const getInitials = (firstName: string, lastName: string) => {
    const first = firstName?.charAt(0)?.toUpperCase() || '';
    const last = lastName?.charAt(0)?.toUpperCase() || '';
    return first + last;
  };

  const getAvatarColor = (name: string) => {
    const colors = ['#9FB996', '#96B6B9', '#9697B9'];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const EmployeeItem = ({ employee }: { employee: Employee }) => {
    const name = employee.name || `${employee.first_name || ''} ${employee.last_name || ''}`.trim();
    const initials = getInitials(employee.first_name, employee.last_name);
    const avatarColor = getAvatarColor(name);
    const isExpanded = expandedEmployeeId === employee.id;
    
    return (
      <View style={styles.employeeItemContainer}>
        <View style={styles.employeeItem}>
          <TouchableOpacity 
            style={styles.employeeLeft}
            onPress={() => navigation.navigate('EmployeeDetail', { id: employee.id })}
          >
            {employee.photo_url ? (
              <Image source={{ uri: employee.photo_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: avatarColor }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            <View style={styles.employeeInfo}>
              <Text style={styles.employeeName}>{name}</Text>
              <Text style={styles.employeeRole}>{employee.department || 'Employee'}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ paddingLeft: 8, paddingVertical: 8 }}
            onPress={() => toggleExpand(employee.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#6F67CC"
            />
          </TouchableOpacity>
        </View>
        
        {isExpanded && (
          <View style={styles.expandedContent}>
            {/* Status Row */}
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Status:</Text>
              <View style={[styles.statusBadge, employee.is_active ? styles.activeBadge : styles.inactiveBadge]}>
                <Text style={[styles.statusBadgeText, employee.is_active ? styles.activeText : styles.inactiveText]}>
                  {employee.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>
              <View style={styles.employmentTypeBadge}>
                <Text style={styles.employmentTypeText}>
                  {employee.employment_type || 'Full Time'}
                </Text>
              </View>
            </View>

            {/* Salary Row */}
            <View style={styles.detailRow}>
              <View style={styles.detailColumn}>
                <Text style={styles.detailLabel}>Monthly salary:</Text>
                <Text style={styles.detailValue}>₹{employee.salary?.toLocaleString() || '0'}</Text>
              </View>
              <View style={styles.detailColumn}>
                <Text style={styles.detailLabel}>Over time rate:</Text>
                <Text style={styles.detailValue}>₹{employee.overtime_rate || '0'}</Text>
              </View>
            </View>

            {/* Contact Row */}
            <View style={styles.detailRow}>
              <View style={styles.detailColumn}>
                <Text style={styles.detailLabel}>Mobile:</Text>
                <Text style={styles.detailValue}>{employee.phone || 'N/A'}</Text>
              </View>
              <View style={styles.detailColumn}>
                <Text style={styles.detailLabel}>Email:</Text>
                <Text style={styles.detailValue}>{employee.email || 'N/A'}</Text>
              </View>
            </View>

            {/* Location Row */}
            <View style={styles.locationRow}>
              <Text style={styles.detailLabel}>Location: </Text>
              <Text style={styles.detailValue}>{employee.location || 'N/A'}</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => handleEditEmployee(employee)}
              >
                <Ionicons name="create-outline" size={16} color="#6F67CC" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={() => handleDeleteEmployee(employee)}
              >
                <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.viewMoreButton}
                onPress={() => {}}
              >
                <Ionicons name="eye-outline" size={16} color="#6F67CC" />
                <Text style={styles.viewMoreButtonText}>View more</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading && employees.length === 0) {
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
          <Text style={styles.headerTitle}>Employees</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Ionicons name="search" size={20} color={PRIMARY_PURPLE} />
          </View>
        </View>

        {/* Department Filter Label */}
        <Text style={styles.filterLabel}>List by department</Text>

        {/* Department Filter Chips */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {departments.map((dept) => (
            <TouchableOpacity
              key={dept}
              style={[
                styles.filterChip,
                selectedDepartment === dept && styles.filterChipActive,
              ]}
              onPress={() => setSelectedDepartment(dept)}
            >
              <Text style={[
                styles.filterChipText,
                selectedDepartment === dept && styles.filterChipTextActive,
              ]}>
                {dept}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Stats Summary */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsLabel}>Total: </Text>
          <Text style={styles.statsValue}>{filteredEmployees.length}</Text>
          <Text style={styles.statsDivider}>|</Text>
          <Text style={styles.statsActiveLabel}>Active: </Text>
          <Text style={styles.statsActiveValue}>{getActiveCount()}</Text>
          <Text style={styles.statsDivider}>|</Text>
          <Text style={styles.statsOffDutyLabel}>Off Duty: </Text>
          <Text style={styles.statsOffDutyValue}>{getOffDutyCount()}</Text>
        </View>

        {/* Employee List */}
        <View style={styles.listCard}>
          <FlatList
            data={filteredEmployees}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => <EmployeeItem employee={item} />}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No employees found</Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            style={styles.flatList}
          />
        </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  searchContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E8E7ED',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
    color: '#727272',
  },
  filterLabel: {
    fontSize: 12,
    color: '#727272',
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterContainer: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: 8,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    height: 30,
    justifyContent: 'center',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#8F8F8F',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    marginBottom: 4,
  },
  filterChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#7166CB',
    borderRadius: 5,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
    color: '#8F8F8F',
  },
  filterChipTextActive: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statsLabel: {
    fontSize: 14,
    color: '#404040',
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
  },
  statsValue: {
    fontSize: 14,
    color: '#404040',
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  statsDivider: {
    fontSize: 16,
    color: '#8F8F8F',
    marginHorizontal: 8,
  },
  statsActiveLabel: {
    fontSize: 14,
    color: '#877ED2',
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
  },
  statsActiveValue: {
    fontSize: 14,
    color: PRIMARY_PURPLE,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  statsOffDutyLabel: {
    fontSize: 14,
    color: '#877ED2',
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
  },
  statsOffDutyValue: {
    fontSize: 14,
    color: '#877ED2',
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  flatList: {
    flex: 1,
  },
  listCard: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
    marginTop: 12,
  },
  listContent: {
    paddingBottom: 16,
  },
  employeeItemContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  employeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    color: '#8F8F8F',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 25,
    marginRight: 8,
  },
  activeBadge: {
    backgroundColor: '#83B465',
  },
  inactiveBadge: {
    backgroundColor: '#F44336',
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  activeText: {
    color: '#FFFFFF',
  },
  inactiveText: {
    color: '#FFFFFF',
  },
  employmentTypeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 25,
    backgroundColor: '#E8E7ED',
  },
  employmentTypeText: {
    fontSize: 13,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    color: '#404040',
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  detailColumn: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    color: '#8F8F8F',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    color: '#404040',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    height: 30,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: '#6F67CC',
    borderColor: '#6F67CC',
    gap: 6,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    color: '#FFFFFF',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 25,
    backgroundColor: '#6F67CC',
    gap: 6,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    color: '#FFFFFF',
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#6F67CC',
    backgroundColor: '#6F67CC',
    gap: 6,
  },
  viewMoreButtonText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    color: '#FFFFFF',
    marginLeft: 4,
  },
  employeeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  employeeInfo: {
    marginLeft: 12,
    flex: 1,
  },
  employeeName: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    color: '#404040',
  },
  employeeRole: {
    fontSize: 10,
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
    color: '#727272',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});
