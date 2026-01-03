import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { translateStatus, translatePriority } from '../../utils/translations';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../api/client';
import DateTimePicker from '@react-native-community/datetimepicker';
import Card from '../../components/shared/Card';
import SafeAreaWrapper from '../../components/shared/SafeAreaWrapper';
import { Ionicons } from '@expo/vector-icons';
import VoiceToTextButton from '../../components/shared/VoiceToTextButton';

// Admin Project Tasks Screen - Updated

type TaskStatus = 'To Do' | 'Active' | 'Completed' | 'Cancelled' | 'On Hold';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
}

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  project_id: string;
  assigned_to: string;
  assigned_employees: Employee[];
  first_name: string;
  last_name: string;
  department: string;
  employee_email: string;
  due_date: string;
  created_at: string;
  updated_at: string;
  // Optional aggregated metrics
  total_time_minutes?: number;
  total_cost?: number;
}

interface DepartmentGroup {
  department: string;
  tasks: Task[];
  totalHours: number;
  totalCost: number;
}

export default function ProjectTasksScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { t } = useTranslation();
  const { projectId, projectName } = route.params || {};
  const { user } = useContext(AuthContext);

  const [departmentGroups, setDepartmentGroups] = useState<DepartmentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Task creation modal state
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  
  // Status picker modal state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusSearch, setStatusSearch] = useState('');
  
  // Assignee selection modal state
  const [showAssigneeModal, setShowAssigneeModal] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  
  // Form state
  const [taskName, setTaskName] = useState('');
  const [location, setLocation] = useState('at_site');
  const [assignedTo, setAssignedTo] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadTeamMembers = async () => {
    try {
      console.log('Loading team members for project:', projectId);
      const response = await api.get(`/api/projects/${projectId}/team`);
      console.log('Team members response:', response.data);
      const members = response.data?.teamMembers || [];
      console.log('Loaded team members count:', members.length);
      return members;
    } catch (error) {
      console.error('Error loading team members:', error);
      return [];
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      if (!projectId) {
        setDepartmentGroups([]);
        return;
      }
      
      // Load tasks for this project with employee info
      console.log('🔍 Fetching tasks for project:', projectId);
      const response = await api.get(`/api/tasks?projectId=${projectId}&page=1&limit=100`);
      
      console.log('📊 API Response:', JSON.stringify(response.data, null, 2));
      
      const tasks: Task[] = response.data.tasks || [];
      
      console.log('📋 Loaded tasks from API:', tasks.length);
      console.log('📋 Sample task data:', tasks[0]);
      
      if (tasks.length === 0) {
        console.warn('⚠️ No tasks found for this project');
      }
      
      // Load team members for department mapping
      const members = await loadTeamMembers();
      setTeamMembers(members);
      
      // Load time entries to calculate hours and cost per department
      const entriesResponse = await api.get('/api/time-entries', {
        params: { projectId, page: 1, limit: 1000 }
      });
      const timeEntries = entriesResponse.data?.timeEntries || [];
      
      // Debug: Log time entries to check cost values
      console.log('📊 Time entries loaded:', timeEntries.length);
      if (timeEntries.length > 0) {
        console.log('Sample time entry:', {
          id: timeEntries[0].id,
          task_id: timeEntries[0].task_id,
          duration_minutes: timeEntries[0].duration_minutes,
          cost: timeEntries[0].cost,
          costType: typeof timeEntries[0].cost
        });
      }
      
      // Group tasks by assigned employee's department
      // If a task has multiple assignees from different departments,
      // create a separate task entry for each department showing only that department's assignees
      const departmentMap = new Map<string, Task[]>();
      
      for (const task of tasks) {
        // If task has multiple assignees, split by department
        if (task.assigned_employees && task.assigned_employees.length > 0) {
          // Group assignees by their department
          const assigneesByDept = new Map<string, Employee[]>();
          
          task.assigned_employees.forEach(emp => {
            if (!assigneesByDept.has(emp.department)) {
              assigneesByDept.set(emp.department, []);
            }
            assigneesByDept.get(emp.department)!.push(emp);
          });
          
          // Create a separate task entry for each department
          assigneesByDept.forEach((deptAssignees, dept) => {
            if (!departmentMap.has(dept)) {
              departmentMap.set(dept, []);
            }
            
            // Create a new task object with only this department's assignees
            const taskForDept = {
              ...task,
              assigned_employees: deptAssignees
            };
            
            departmentMap.get(dept)!.push(taskForDept);
          });
        } else {
          // No assignees - put in Unassigned
          const dept = 'Unassigned';
          if (!departmentMap.has(dept)) {
            departmentMap.set(dept, []);
          }
          departmentMap.get(dept)!.push(task);
        }
      }
      
      console.log('📊 Department groups created:', Array.from(departmentMap.keys()));
      
      // Calculate totals for each department and per task
      const groups: DepartmentGroup[] = Array.from(departmentMap.entries()).map(([dept, deptTasks]) => {
        const deptEmployeeIds = deptTasks.map(t => t.assigned_to).filter(Boolean);
        
        // Calculate hours and cost for this department
        const deptEntries = timeEntries.filter((entry: any) => 
          deptEmployeeIds.includes(entry.employee_id)
        );
        
        const totalMinutes = deptEntries.reduce((sum: number, entry: any) => 
          sum + (entry.duration_minutes || 0), 0
        );
        const totalCost = deptEntries.reduce((sum: number, entry: any) => 
          sum + (entry.cost || 0), 0
        );
        
        // Calculate totals for each task
        const tasksWithTotals = deptTasks.map(task => {
          // Get time entries for this specific task
          const taskEntries = timeEntries.filter((entry: any) => 
            entry.task_id === task.id
          );
          
          const taskTotalMinutes = taskEntries.reduce((sum: number, entry: any) => 
            sum + (parseInt(entry.duration_minutes) || 0), 0
          );
          const taskTotalCost = taskEntries.reduce((sum: number, entry: any) => {
            // Handle both string and number cost values from PostgreSQL
            const cost = entry.cost != null ? parseFloat(String(entry.cost)) : 0;
            if (isNaN(cost)) {
              console.warn(`Invalid cost value for entry ${entry.id}:`, entry.cost);
              return sum;
            }
            return sum + cost;
          }, 0);
          
          return {
            ...task,
            total_time_minutes: taskTotalMinutes,
            total_cost: Math.round(taskTotalCost * 100) / 100,
          };
        });
        
        return {
          department: dept,
          tasks: tasksWithTotals,
          totalHours: Math.round((totalMinutes / 60) * 10) / 10,
          totalCost: Math.round(totalCost * 100) / 100,
        };
      });
      
      setDepartmentGroups(groups);
      console.log('✅ Final department groups:', groups.length, 'with', groups.reduce((sum, g) => sum + g.tasks.length, 0), 'total tasks');
    } catch (error) {
      console.error('❌ Error loading project tasks:', error);
      setDepartmentGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getStatusColor = (status: TaskStatus | string) => {
    switch (status) {
      case 'Completed': return '#34C759';
      case 'Active': return '#877ED2';
      case 'Cancelled': return '#FF3B30';
      case 'On Hold': return '#FF9500';
      case 'To Do': return '#8E8E93';
      default: return '#8E8E93';
    }
  };

  const handleEditTask = (taskId: string) => {
    navigation.navigate('TaskView', { taskId, projectId, projectName });
  };

  const handleAttachment = (taskId: string) => {
    Alert.alert('Attachments', 'View attachments functionality coming soon');
  };

  const handleAddTask = async (department: string) => {
    setSelectedDepartment(department);
    setShowTaskModal(true);
    // Load team members for the project
    const members = await loadTeamMembers();
    setTeamMembers(members);
  };

  const handleCloseModal = () => {
    setShowTaskModal(false);
    // Reset form
    setTaskName('');
    setLocation('at_site');
    setAssignedTo('');
    setStartDate(new Date());
    setEndDate(new Date());
    setDescription('');
  };

  const handleCreateTask = async () => {
    if (!taskName.trim()) {
      Alert.alert('Error', 'Please enter a task name');
      return;
    }

    try {
      setSubmitting(true);
      
      // Create task via API
      await api.post('/api/tasks', {
        project_id: projectId,
        title: taskName,
        status: 'todo',
        assigned_to: assignedTo || null,
        due_date: endDate.toISOString().split('T')[0],
        description: description,
        // Add location as metadata
        metadata: {
          location,
          department: selectedDepartment,
        }
      });

      Alert.alert('Success', 'Task created successfully');
      handleCloseModal();
      loadData(); // Refresh tasks
    } catch (error: any) {
      console.error('Error creating task:', error);
      Alert.alert('Error', 'Failed to create task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusClick = (task: Task) => {
    setSelectedTask(task);
    setStatusSearch('');
    setShowStatusModal(true);
  };

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!selectedTask) return;

    try {
      await api.patch(`/api/tasks/${selectedTask.id}`, {
        status: newStatus
      });

      Alert.alert('Success', 'Task status updated successfully');
      setShowStatusModal(false);
      setSelectedTask(null);
      loadData(); // Refresh tasks
      
      // Navigate back and pass refresh flag
      console.log('✅ Navigating back with refresh flag...');
      navigation.navigate('ProjectDetails', { 
        id: projectId,
        refresh: Date.now() // Use timestamp to force refresh
      });
      
    } catch (error: any) {
      console.error('Error updating task status:', error);
      Alert.alert('Error', 'Failed to update task status. Please try again.');
    }
  };

  // Map UI-friendly labels to backend-supported TaskStatus values
  const statusOptions: { value: TaskStatus; label: string; icon: string; color: string }[] = [
    { value: 'To Do', label: t('status.todo', 'TO DO').toUpperCase(), icon: '○', color: '#8E8E93' },
    { value: 'Active', label: t('status.active', 'ACTIVE').toUpperCase(), icon: '⟳', color: '#877ED2' },
    { value: 'Completed', label: t('status.completed', 'COMPLETED').toUpperCase(), icon: '●', color: '#34C759' },
    { value: 'Cancelled', label: t('status.cancelled', 'CANCELLED').toUpperCase(), icon: '●', color: '#FF3B30' },
    { value: 'On Hold', label: t('status.on_hold', 'ON HOLD').toUpperCase(), icon: '●', color: '#FF9500' },
  ];

  const filteredStatusOptions = statusOptions.filter(option =>
    option.label.toLowerCase().includes(statusSearch.toLowerCase())
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading tasks...</Text>
      </View>
    );
  }

  return (
    <SafeAreaWrapper>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.projectLabel}>PROJECT NAME</Text>
              <Text style={styles.title}>{String(projectName || 'Project')}</Text>
              {/* <Text style={styles.subtitle}>{departmentGroups.reduce((sum, g) => sum + g.tasks.length, 0)} tasks</Text> */}
            </View>
            <TouchableOpacity
              style={styles.headerAddButton}
              onPress={() => handleAddTask('')}
            >
              <Text style={styles.headerAddButtonText}>+ Add Task</Text>
            </TouchableOpacity>
          </View>
        </View>

        {departmentGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No tasks</Text>
            <Text style={styles.emptySubtitle}>Pull to refresh to load tasks.</Text>
          </View>
        ) : (
          departmentGroups.map((group, groupIndex) => (
            <View key={groupIndex} style={styles.departmentSection}>
              {/* Department Header */}
              <View style={styles.departmentHeader}>
                <View>
                  <Text style={styles.departmentLabel}>DEPARTMENT</Text>
                  <Text style={styles.departmentName}>{group.department}</Text>
                </View>
              </View>

              {/* Department Summary */}
              <View style={styles.summaryCards}>
                <Card style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{group.totalHours}h</Text>
                  <Text style={styles.summaryLabel}>Total Hours</Text>
                </Card>
                <Card style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>₹{group.totalCost.toLocaleString('en-IN')}</Text>
                  <Text style={styles.summaryLabel}>Total Cost</Text>
                </Card>
              </View>

              {/* Task List */}
              {group.tasks.map((task, taskIndex) => (
                <TouchableOpacity
                  key={task.id}
                  style={styles.taskItem}
                  onPress={() => handleEditTask(task.id)}
                >
                  <View style={styles.taskContent}>
                    <View>
                      <Text style={styles.taskLabel}>TASK</Text>
                      <Text style={styles.taskName}>{task.title}</Text>
                    </View>
                    <View style={styles.taskDetails}>
                      <View style={styles.taskDetail}>
                        <Text style={styles.taskDetailLabel}>Assigned to</Text>
                        <Text style={styles.taskDetailValue}>
                          {task.assigned_employees && task.assigned_employees.length > 0
                            ? task.assigned_employees.map(emp => `${emp.first_name} ${emp.last_name}`).join(', ')
                            : 'Unassigned'}
                        </Text>
                      </View>
                      
                      <TouchableOpacity 
                        style={styles.taskDetail}
                        onPress={() => handleStatusClick(task)}
                      >
                        <Text style={styles.taskDetailLabel}>Status</Text>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(task.status) }]} />
                        <Text style={styles.taskDetailValue}>{translateStatus(task.status, t).toUpperCase()}</Text>
                        <Text style={styles.statusArrow}> ▼</Text>
                      </TouchableOpacity>
                      
                      <View style={styles.taskDetail}>
                        <Text style={styles.taskDetailLabel}>Due by</Text>
                        <Text style={styles.taskDetailValue}>
                          {task.due_date 
                            ? new Date(task.due_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : 'No due date'}
                        </Text>
                      </View>
                      <View style={styles.taskDetail}>
                        <Text style={styles.fieldLabel}>Total Hours:</Text>
                        <Text style={styles.fieldValue}>
                          {task.total_time_minutes 
                            ? `${Math.floor(task.total_time_minutes / 60)}h ${task.total_time_minutes % 60}m`
                            : '0h'}
                        </Text>
                      </View>
                      <View style={[styles.taskDetail, { marginTop: 0 }]}> 
                        <Text style={styles.fieldLabel}>Total Cost:</Text>
                        <Text style={styles.fieldValue}>
                          ₹{task.total_cost ? task.total_cost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {/* Task Actions */}
                  <View style={styles.taskActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleEditTask(task.id)}
                    >
                      <Ionicons name="create-outline" size={18} color="#007AFF" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleAttachment(task.id)}
                    >
                      <Ionicons name="attach-outline" size={18} color="#007AFF" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>

      {/* Create Task Modal */}
      <Modal
        visible={showTaskModal}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Task create</Text>
                <TouchableOpacity onPress={handleCloseModal}>
                  <Ionicons name="close" size={24} color="#1C1C1E" />
                </TouchableOpacity>
              </View>

              {/* Project Name (read-only) */}
              <View style={styles.formField}>
                <Text style={styles.label}>Project</Text>
                <View style={styles.readOnlyField}>
                  <Text style={styles.readOnlyText}>{projectName}</Text>
                </View>
              </View>

              {/* Due Date */}
              <View style={styles.formField}>
                <Text style={styles.label}>Due by</Text>
                <TouchableOpacity 
                  style={styles.dateButton}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Text style={styles.dateText}>
                    {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
              </View>

              {/* Task Name */}
              <View style={styles.formField}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Task name</Text>
                  <VoiceToTextButton
                    onResult={(text) => setTaskName(prev => prev ? `${prev} ${text}` : text)}
                    size="small"
                  />
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter task name"
                  value={taskName}
                  onChangeText={setTaskName}
                  placeholderTextColor="#8E8E93"
                />
              </View>

              {/* Location */}
              <View style={styles.formField}>
                <Text style={styles.label}>Location</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity 
                    style={styles.radioOption}
                    onPress={() => setLocation('at_site')}
                  >
                    <View style={[styles.radioButton, location === 'at_site' && styles.radioButtonSelected]}>
                      {location === 'at_site' && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text style={styles.radioLabel}>At site</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.radioOption}
                    onPress={() => setLocation('factory')}
                  >
                    <View style={[styles.radioButton, location === 'factory' && styles.radioButtonSelected]}>
                      {location === 'factory' && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text style={styles.radioLabel}>Factory</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.radioOption}
                    onPress={() => setLocation('office')}
                  >
                    <View style={[styles.radioButton, location === 'office' && styles.radioButtonSelected]}>
                      {location === 'office' && <View style={styles.radioButtonInner} />}
                    </View>
                    <Text style={styles.radioLabel}>Office</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Assign to */}
              <View style={styles.formField}>
                <Text style={styles.label}>Assign to</Text>
                <View style={styles.assignToContainer}>
                  <Text style={styles.assignToPlaceholder}>
                    {selectedAssignees.length > 0 
                      ? `${selectedAssignees.length} assignee${selectedAssignees.length > 1 ? 's' : ''} selected`
                      : 'No assignees selected'}
                  </Text>
                  <TouchableOpacity
                    style={styles.selectAssigneesButton}
                    onPress={() => setShowAssigneeModal(true)}
                  >
                    <Text style={styles.selectAssigneesButtonText}>Select assignees</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Start Date */}
              <View style={styles.formField}>
                <Text style={styles.label}>Start date</Text>
                <TouchableOpacity 
                  style={styles.dateButton}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <Text style={styles.dateText}>
                    {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
              </View>

              {/* End Date */}
              <View style={styles.formField}>
                <Text style={styles.label}>End date</Text>
                <TouchableOpacity 
                  style={styles.dateButton}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Text style={styles.dateText}>
                    {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color="#007AFF" />
                </TouchableOpacity>
              </View>

              {/* Attachments - Placeholder */}
              <View style={styles.formField}>
                <Text style={styles.label}>Attachments</Text>
                <TouchableOpacity style={styles.attachmentButton}>
                  <Ionicons name="attach-outline" size={20} color="#007AFF" />
                  <Text style={styles.attachmentText}>Add attachments (coming soon)</Text>
                </TouchableOpacity>
              </View>

              {/* Description */}
              <View style={[styles.formField, { marginBottom: 8 }]}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Description / Instructions</Text>
                  <VoiceToTextButton
                    onResult={(text) => setDescription(prev => prev ? `${prev} ${text}` : text)}
                    size="small"
                  />
                </View>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Enter task description or instructions"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor="#8E8E93"
                />
              </View>

              {/* Form Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={handleCloseModal}
                  disabled={submitting}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.createButton, submitting && styles.createButtonDisabled]}
                  onPress={handleCreateTask}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.createButtonText}>Create Task</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Date Pickers */}
        {showStartDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowStartDatePicker(false);
              if (selectedDate) setStartDate(selectedDate);
            }}
          />
        )}
        {showEndDatePicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
              setShowEndDatePicker(false);
              if (selectedDate) setEndDate(selectedDate);
            }}
          />
        )}
      </Modal>

      {/* Status Picker Modal */}
      <Modal
        visible={showStatusModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowStatusModal(false)}
      >
        <TouchableOpacity
          style={styles.statusModalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusModal(false)}
        >
          <View style={styles.statusModalContent}>
            {/* Search Input */}
            <View style={styles.statusSearchContainer}>
              <TextInput
                style={styles.statusSearchInput}
                placeholder="Search..."
                value={statusSearch}
                onChangeText={setStatusSearch}
                placeholderTextColor="#8E8E93"
              />
            </View>

            {/* Statuses Section */}
            <View style={styles.statusesSection}>
              

              <ScrollView style={styles.statusList}>
                {filteredStatusOptions.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.statusOption,
                      selectedTask?.status === option.value && styles.statusOptionActive
                    ]}
                    onPress={() => handleStatusChange(option.value as TaskStatus)}
                  >
                    <View style={styles.statusOptionLeft}>
                      <Text style={[styles.statusOptionIcon, { color: option.color }]}>
                        {option.icon}
                      </Text>
                      <Text style={styles.statusOptionLabel}>{option.label}</Text>
                    </View>
                    {selectedTask?.status === option.value && (
                      <Text style={styles.statusOptionCheck}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Assignee Selection Modal */}
      <Modal
        visible={showAssigneeModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAssigneeModal(false)}
      >
        <View style={styles.assigneeModalOverlay}>
          <View style={styles.assigneeModalContent}>
            {/* Header */}
            <View style={styles.assigneeModalHeader}>
              <Text style={styles.assigneeModalTitle}>Select Assignees</Text>
              <TouchableOpacity onPress={() => setShowAssigneeModal(false)}>
                <Ionicons name="close" size={24} color="#1C1C1E" />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.assigneeSearchContainer}>
              <Ionicons name="search" size={20} color="#8E8E93" style={styles.assigneeSearchIcon} />
              <TextInput
                style={styles.assigneeSearchInput}
                placeholder="Search employees..."
                value={assigneeSearch}
                onChangeText={setAssigneeSearch}
                placeholderTextColor="#8E8E93"
              />
            </View>

            {/* Employee List */}
            <ScrollView style={styles.assigneeList} nestedScrollEnabled={true} showsVerticalScrollIndicator={true}>
              {teamMembers
                .filter(member => 
                  `${member.first_name} ${member.last_name}`.toLowerCase().includes(assigneeSearch.toLowerCase())
                )
                .map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    style={styles.assigneeOption}
                    onPress={() => {
                      setSelectedAssignees(prev => 
                        prev.includes(member.id)
                          ? prev.filter(id => id !== member.id)
                          : [...prev, member.id]
                      );
                    }}
                  >
                    <Text style={styles.assigneeName}>
                      {member.first_name} {member.last_name}
                    </Text>
                    <View style={[
                      styles.assigneeCheckbox,
                      selectedAssignees.includes(member.id) && styles.assigneeCheckboxChecked
                    ]}>
                      {selectedAssignees.includes(member.id) && (
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Footer Buttons */}
            <View style={styles.assigneeModalFooter}>
              <TouchableOpacity
                style={styles.assigneeCancelButton}
                onPress={() => setShowAssigneeModal(false)}
              >
                <Text style={styles.assigneeCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.assigneeApplyButton}
                onPress={() => setShowAssigneeModal(false)}
              >
                <Text style={styles.assigneeApplyButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#8E8E93',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerAddButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  headerAddButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  projectLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
  },
  departmentSection: {
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  departmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  departmentLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
    marginBottom: -2,
  },
  departmentName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  addTaskButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addTaskButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  taskItem: {
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  taskContent: {
    flex: 1,
    marginRight: 12,
  },
  taskLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  taskName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  taskDetails: {
    gap: 8,
  },
  taskDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginRight: 8,
  },
  fieldValue: {
    fontSize: 13,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  taskDetailLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
    minWidth: 80,
  },
  taskDetailValue: {
    fontSize: 12,
    color: '#1C1C1E',
    fontWeight: '600',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  taskActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    backgroundColor: '#F2F2F7',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  formField: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    flex: 1,
  },
  textInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1C1C1E',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  readOnlyField: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
  },
  readOnlyText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  dateButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#007AFF',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    backgroundColor: '#007AFF',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  radioLabel: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  peopleList: {
    maxHeight: 150,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 8,
  },
  personOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  personOptionSelected: {
    backgroundColor: '#E5F4FF',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  personName: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  noPeopleText: {
    fontSize: 14,
    color: '#8E8E93',
    padding: 12,
    textAlign: 'center',
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  attachmentText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    paddingBottom: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  createButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusArrow: {
    fontSize: 10,
    color: '#8E8E93',
    marginLeft: 4,
  },
  // Status Modal Styles
  statusModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  statusModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '75%',
    maxWidth: 260,
    maxHeight: '65%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statusModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  statusModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  statusModalHeaderRight: {
    flexDirection: 'row',
    gap: 16,
  },
  statusModalPlayIcon: {
    fontSize: 18,
    color: '#8E8E93',
  },
  statusModalCheckIcon: {
    fontSize: 18,
    color: '#8E8E93',
  },
  statusSearchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  statusSearchInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1C1C1E',
  },
  statusesSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statusesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusesSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
  },
  statusesSectionMore: {
    fontSize: 20,
    color: '#8E8E93',
  },
  statusList: {
    maxHeight: 400,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  statusOptionActive: {
    backgroundColor: '#E8E8E8',
  },
  statusOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusOptionIcon: {
    fontSize: 18,
    fontWeight: '600',
  },
  statusOptionLabel: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '500',
  },
  statusOptionCheck: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '600',
  },
  // Assign to section styles
  assignToContainer: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 16,
  },
  assignToPlaceholder: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
  },
  selectAssigneesButton: {
    backgroundColor: '#E5F4FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectAssigneesButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Assignee Modal styles
  assigneeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  assigneeModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    width: '100%',
    maxHeight: '80%',
    padding: 20,
  },
  assigneeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  assigneeModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  assigneeSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  assigneeSearchIcon: {
    marginRight: 8,
  },
  assigneeSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
  },
  assigneeList: {
    maxHeight: 400,
  },
  assigneeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  assigneeName: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  assigneeCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D1D6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assigneeCheckboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  assigneeModalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  assigneeCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  assigneeCancelButtonText: {
    fontSize: 16,
    color: '#1C1C1E',
    fontWeight: '600',
  },
  assigneeApplyButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  assigneeApplyButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
