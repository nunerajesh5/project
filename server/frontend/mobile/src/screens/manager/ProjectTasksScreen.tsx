import React, { useEffect, useState, useContext, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput, Switch } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../api/client';
import DateTimePicker from '@react-native-community/datetimepicker';
import Card from '../../components/shared/Card';
import SafeAreaWrapper from '../../components/shared/SafeAreaWrapper';
import { Ionicons } from '@expo/vector-icons';
import VoiceToTextButton from '../../components/shared/VoiceToTextButton';
import { typography } from '../../design/tokens';

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
  location?: string;
  total_time_minutes?: number;
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
  
  // Form state
  const [highPriority, setHighPriority] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [location, setLocation] = useState('');
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [description, setDescription] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showTeamMemberModal, setShowTeamMemberModal] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  
  // Timer state for task cards
  const [runningTimers, setRunningTimers] = useState<Record<string, { startTime: number; elapsed: number }>>({});
  const timerIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  const loadTeamMembers = async () => {
    try {
      const response = await api.get(`/api/projects/${projectId}/team-members`);
      return response.data?.teamMembers || [];
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
      
      // Calculate totals for each department
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
        
        return {
          department: dept,
          tasks: deptTasks,
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

  const getStatusText = (status: TaskStatus | string) => {
    switch (status) {
      case 'Active': return 'Active';
      case 'To Do': return 'To Do';
      case 'Completed': return 'Completed';
      case 'Cancelled': return 'Cancelled';
      case 'On Hold': return 'On Hold';
      default: return status;
    }
  };

  // Helper functions for task cards
  const getDaysRemaining = (dueDate: string) => {
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const isOverdue = (dueDate: string) => {
    return getDaysRemaining(dueDate) < 0;
  };

  const getAssigneeName = (task: Task) => {
    if (task.assigned_employees && task.assigned_employees.length > 0) {
      const emp = task.assigned_employees[0];
      return `${emp.first_name} ${emp.last_name}`;
    }
    if (task.first_name && task.last_name) {
      return `${task.first_name} ${task.last_name}`;
    }
    return 'Unassigned';
  };

  const getLocation = (task: Task) => {
    return task.location || 'yelahanka';
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}hr ${minutes.toString().padStart(2, '0')}min`;
  };

  const getTimeWorked = (task: Task) => {
    if (runningTimers[task.id]) {
      const totalMs = (task.total_time_minutes || 0) * 60 * 1000 + runningTimers[task.id].elapsed;
      return formatTime(totalMs);
    }
    if (task.total_time_minutes) {
      return formatTime(task.total_time_minutes * 60 * 1000);
    }
    return '00hr 00min';
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timerIntervals.current).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, []);

  const handleEditTask = (taskId: string) => {
    navigation.navigate('TaskView', { taskId, projectId, projectName });
  };

  const handleAttachment = (taskId: string) => {
    Alert.alert('Attachments', 'View attachments functionality coming soon');
  };

  const handleAddTask = (department: string) => {
    setSelectedDepartment(department);
    setShowTaskModal(true);
  };

  const handleCloseModal = () => {
    setShowTaskModal(false);
    // Reset form
    setHighPriority(false);
    setTaskName('');
    setLocation('');
    setSelectedTeamMembers([]);
    setStartDate(new Date());
    setEndDate(new Date());
    setDescription('');
    setAttachments([]);
    setShowProjectDropdown(false);
    setShowLocationDropdown(false);
    setShowTeamMemberModal(false);
  };

  const handleCreateTask = async () => {
    if (!taskName.trim()) {
      Alert.alert('Error', 'Please enter a task name');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    try {
      setSubmitting(true);
      
      // Create task via API
      const assigneeIds = selectedTeamMembers.map(m => m.id);
      await api.post('/api/tasks', {
        project_id: projectId,
        title: taskName,
        status: 'To Do',
        assigned_to: assigneeIds.length > 0 ? assigneeIds[0] : null,
        assigned_employees: assigneeIds,
        due_date: endDate.toISOString().split('T')[0],
        start_date: startDate.toISOString().split('T')[0],
        description: description,
        priority: highPriority ? 'high' : 'normal',
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

  const handleAddTeamMember = (member: any) => {
    if (!selectedTeamMembers.find(m => m.id === member.id)) {
      setSelectedTeamMembers([...selectedTeamMembers, member]);
    }
    setShowTeamMemberModal(false);
  };

  const handleRemoveTeamMember = (memberId: string) => {
    setSelectedTeamMembers(selectedTeamMembers.filter(m => m.id !== memberId));
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
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
    { value: 'To Do', label: 'TO DO', icon: '○', color: '#8E8E93' },
    { value: 'Active', label: 'ACTIVE', icon: '⟳', color: '#877ED2' },
    { value: 'Completed', label: 'COMPLETED', icon: '●', color: '#34C759' },
    { value: 'Cancelled', label: 'CANCELLED', icon: '●', color: '#FF3B30' },
    { value: 'On Hold', label: 'ON HOLD', icon: '●', color: '#FF9500' },
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
              <Text style={styles.title}>{String(projectName || 'Project')}</Text>
              <Text style={styles.subtitle}>{departmentGroups.reduce((sum, g) => sum + g.tasks.length, 0)} tasks</Text>
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
                <Text style={styles.departmentName}>{group.department}</Text>
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
              {group.tasks.map((task, taskIndex) => {
                const overdue = isOverdue(task.due_date);
                const daysRemaining = getDaysRemaining(task.due_date);
                const statusColor = getStatusColor(task.status);

                return (
                  <TouchableOpacity
                    key={task.id}
                    style={styles.taskCard}
                    onPress={() => handleEditTask(task.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.taskCardTop}>
                      {/* Status Badge */}
                      <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                        <Text style={styles.statusBadgeText}>{getStatusText(task.status)}</Text>
                      </View>
                    </View>

                    {/* Assignee and Location */}
                    <Text style={styles.assigneeText}>
                      {getAssigneeName(task)}, {getLocation(task)}
                    </Text>

                    {/* Task Title */}
                    <Text style={styles.taskTitle}>{task.title}</Text>

                    {/* Avatar with Plus */}
                    <View style={styles.avatarContainer}>
                      <View style={styles.avatar}>
                        <Ionicons name="person" size={18} color="#FF9500" />
                      </View>
                      <View style={styles.avatarPlus}>
                        <Text style={styles.avatarPlusText}>+</Text>
                      </View>
                    </View>

                    {/* Dates Section - Three Columns */}
                    <View style={styles.datesContainer}>
                      <View style={styles.dateSection}>
                        <Text style={styles.dateLabel}>Assigned date</Text>
                        <Text style={styles.dateValue}>
                          {new Date(task.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>
                      <View style={styles.dateSection}>
                        <Text style={styles.dateLabel}>Due date</Text>
                        <Text style={styles.dateValue}>
                          {new Date(task.due_date).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>
                      <View style={styles.dateSection}>
                        <View style={styles.overdueRow}>
                          <Text style={styles.dateLabel}>Over due</Text>
                          {overdue ? (
                            <Text style={styles.overdueValue}>{Math.abs(daysRemaining)}d</Text>
                          ) : (
                            <Text style={styles.dateValue}>-</Text>
                          )}
                        </View>
                        {overdue && <View style={styles.overdueBar} />}
                      </View>
                    </View>

                    {/* Bottom Section - Time Worked and Action Buttons */}
                    <View style={styles.bottomSection}>
                      <View style={styles.timeWorkedContainer}>
                        <Text style={styles.timeWorkedLabel}>Time worked</Text>
                        <Text style={styles.timeWorkedValue}>{getTimeWorked(task)}</Text>
                      </View>
                      <View style={styles.actionButtonsContainer}>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.actionButtonEdit]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleEditTask(task.id);
                          }}
                        >
                          <Ionicons name="create-outline" size={16} color="#877ED2" />
                          <Text style={styles.actionButtonTextSecondary}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.actionButtonSecondary]}
                          onPress={(e) => {
                            e.stopPropagation();
                            handleAttachment(task.id);
                          }}
                        >
                          <Ionicons name="attach-outline" size={16} color="#877ED2" />
                          <Text style={styles.actionButtonTextSecondary}>Attach</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      {/* Create Task Modal */}
      <Modal
        visible={showTaskModal}
        animationType="slide"
        transparent={false}
        onRequestClose={handleCloseModal}
      >
        <SafeAreaWrapper>
          <View style={styles.createTaskContainer}>
            {/* Header */}
            <View style={styles.createTaskHeader}>
              <TouchableOpacity onPress={handleCloseModal} style={styles.headerButton}>
                <Ionicons name="arrow-back" size={24} color="#000000" />
              </TouchableOpacity>
              <Text style={styles.createTaskTitle}>Create New Task</Text>
              <TouchableOpacity style={styles.headerButton}>
                <Ionicons name="ellipsis-vertical" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.createTaskScrollView}
              showsVerticalScrollIndicator={false}
            >
              {/* High Priority Toggle */}
              <View style={styles.priorityRow}>
                <Text style={styles.priorityLabel}>High Priority</Text>
                <Switch
                  value={highPriority}
                  onValueChange={setHighPriority}
                  trackColor={{ false: '#E5E5EA', true: '#877ED2' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#E5E5EA"
                />
              </View>

              {/* Select Project */}
              <View style={styles.formFieldNew}>
                <Text style={styles.labelNew}>Select Project*</Text>
                <TouchableOpacity 
                  style={styles.dropdownField}
                  onPress={() => setShowProjectDropdown(!showProjectDropdown)}
                >
                  <Text style={[styles.dropdownText, !projectName && styles.dropdownPlaceholder]}>
                    {projectName || 'Select project'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#8E8E93" />
                </TouchableOpacity>
              </View>

              {/* Task Title */}
              <View style={styles.formFieldNew}>
                <View style={styles.labelRowNew}>
                  <Text style={styles.labelNew}>Task Title</Text>
                  <VoiceToTextButton
                    onResult={(text) => setTaskName(prev => prev ? `${prev} ${text}` : text)}
                    size="small"
                    color="#877ED2"
                  />
                </View>
                <TextInput
                  style={styles.textInputNew}
                  placeholder="Enter task title"
                  value={taskName}
                  onChangeText={setTaskName}
                  placeholderTextColor="#8E8E93"
                />
              </View>

              {/* Description */}
              <View style={styles.formFieldNew}>
                <View style={styles.labelRowNew}>
                  <Text style={styles.labelNew}>Description*</Text>
                  <VoiceToTextButton
                    onResult={(text) => setDescription(prev => prev ? `${prev} ${text}` : text)}
                    size="small"
                    color="#877ED2"
                  />
                </View>
                <TextInput
                  style={styles.textAreaNew}
                  placeholder="Enter description"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  placeholderTextColor="#8E8E93"
                />
              </View>

              {/* Start/End Dates */}
              <View style={styles.datesRow}>
                <View style={[styles.formFieldNew, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.labelNew}>Start*</Text>
                  <TouchableOpacity 
                    style={styles.dateFieldNew}
                    onPress={() => setShowStartDatePicker(true)}
                  >
                    <Text style={styles.dateTextNew}>
                      {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#877ED2" />
                  </TouchableOpacity>
                </View>
                <View style={[styles.formFieldNew, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.labelNew}>End*</Text>
                  <TouchableOpacity 
                    style={styles.dateFieldNew}
                    onPress={() => setShowEndDatePicker(true)}
                  >
                    <Text style={styles.dateTextNew}>
                      {endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <Ionicons name="calendar-outline" size={20} color="#877ED2" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Location */}
              <View style={styles.formFieldNew}>
                <Text style={styles.labelNew}>Location</Text>
                <TouchableOpacity 
                  style={styles.dropdownField}
                  onPress={() => setShowLocationDropdown(!showLocationDropdown)}
                >
                  <Text style={[styles.dropdownText, !location && styles.dropdownPlaceholder]}>
                    {location || 'Select location'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#8E8E93" />
                </TouchableOpacity>
                {showLocationDropdown && (
                  <View style={styles.dropdownMenu}>
                    {['At Site', 'Factory', 'Office'].map((loc) => (
                      <TouchableOpacity
                        key={loc}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setLocation(loc);
                          setShowLocationDropdown(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{loc}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Team Section */}
              <View style={styles.formFieldNew}>
                <View style={styles.teamHeader}>
                  <Text style={styles.teamHeaderText}>Team ({selectedTeamMembers.length})</Text>
                  <TouchableOpacity
                    style={styles.addTeamButton}
                    onPress={() => setShowTeamMemberModal(true)}
                  >
                    <Ionicons name="add" size={24} color="#877ED2" />
                  </TouchableOpacity>
                </View>
                {selectedTeamMembers.map((member) => (
                  <View key={member.id} style={styles.teamMemberRow}>
                    <View style={styles.teamMemberAvatar}>
                      <Text style={styles.teamMemberInitials}>
                        {getInitials(member.first_name || member.firstName || '', member.last_name || member.lastName || '')}
                      </Text>
                    </View>
                    <View style={styles.teamMemberInfo}>
                      <Text style={styles.teamMemberName}>
                        {member.first_name || member.firstName} {member.last_name || member.lastName}
                      </Text>
                      <Text style={styles.teamMemberRole}>
                        {member.jobTitle || member.department || 'Team Member'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.removeMemberButton}
                      onPress={() => handleRemoveTeamMember(member.id)}
                    >
                      <Ionicons name="close" size={20} color="#877ED2" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {/* Attachment Section */}
              <View style={styles.formFieldNew}>
                <Text style={styles.teamHeaderText}>Attachment ({attachments.length})</Text>
                {attachments.length > 0 && (
                  <View style={styles.attachmentsGrid}>
                    {attachments.map((attachment, index) => (
                      <View key={index} style={styles.attachmentThumbnail}>
                        <Text style={styles.attachmentThumbnailText}>Image</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.attachmentInputRow}>
                  <TextInput
                    style={styles.attachmentInput}
                    placeholder="Add files"
                    placeholderTextColor="#8E8E93"
                  />
                  <TouchableOpacity style={styles.attachButton}>
                    <Text style={styles.attachButtonText}>Attach</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Create Button */}
              <TouchableOpacity
                style={[styles.createTaskButton, submitting && styles.createTaskButtonDisabled]}
                onPress={handleCreateTask}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.createTaskButtonText}>Create Task</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SafeAreaWrapper>

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

      {/* Team Member Selection Modal */}
      <Modal
        visible={showTeamMemberModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTeamMemberModal(false)}
      >
        <View style={styles.teamModalOverlay}>
          <View style={styles.teamModalContent}>
            <View style={styles.teamModalHeader}>
              <Text style={styles.teamModalTitle}>Select Team Member</Text>
              <TouchableOpacity onPress={() => setShowTeamMemberModal(false)}>
                <Ionicons name="close" size={24} color="#1C1C1E" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.teamModalList}>
              {teamMembers
                .filter(member => !selectedTeamMembers.find(m => m.id === member.id))
                .map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    style={styles.teamModalItem}
                    onPress={() => handleAddTeamMember(member)}
                  >
                    <View style={styles.teamMemberAvatar}>
                      <Text style={styles.teamMemberInitials}>
                        {getInitials(member.first_name || member.firstName || '', member.last_name || member.lastName || '')}
                      </Text>
                    </View>
                    <View style={styles.teamMemberInfo}>
                      <Text style={styles.teamMemberName}>
                        {member.first_name || member.firstName} {member.last_name || member.lastName}
                      </Text>
                      <Text style={styles.teamMemberRole}>
                        {member.jobTitle || member.department || 'Team Member'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
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
  taskCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },
  taskCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: -14,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    fontFamily: typography.families.semibold,
  },
  assigneeText: {
    fontSize: 13,
    color: '#9CA3AF',
    marginBottom: 4,
    marginTop: 4,
    paddingHorizontal: 12,
    fontFamily: typography.families.regular,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    marginTop: -6,
    paddingHorizontal: 12,
    fontFamily: typography.families.bold,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    position: 'absolute',
    top: 10,
    right: 12,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 16,
    borderColor: '#FF9500',
    borderStyle: 'solid',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 2,
    borderWidth: 1.5,
  },
  avatarPlus: {
    width: 26,
    height: 26,
    borderRadius: 16,
    backgroundColor: '#666666',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 0,
    left: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 1,
  },
  avatarPlusText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: typography.families.bold,
    textAlign: 'center',
    lineHeight: 16,
  },
  datesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  dateSection: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
    fontFamily: typography.families.regular,
  },
  dateValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: typography.families.semibold,
  },
  overdueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overdueValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF3B30',
    fontFamily: typography.families.semibold,
  },
  overdueBar: {
    height: 2,
    backgroundColor: '#FF3B30',
    borderRadius: 1,
    width: '100%',
  },
  bottomSection: {
    backgroundColor: '#F5F6FA',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeWorkedContainer: {
    flexShrink: 0,
  },
  timeWorkedLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
    fontFamily: typography.families.regular,
  },
  timeWorkedValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: typography.families.semibold,
    marginTop: -4,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
    marginLeft: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
    minWidth: 100,
  },
  actionButtonEdit: {
    backgroundColor: '#F0EFFF',
    borderRadius: 40,
    borderWidth: 0,
  },
  actionButtonSecondary: {
    backgroundColor: '#F0EFFF',
    borderRadius: 40,
    borderWidth: 0,
  },
  actionButtonTextSecondary: {
    fontSize: 14,
    fontWeight: '500',
    color: '#877ED2',
    fontFamily: typography.families.medium,
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
  // Create Task Modal Styles
  createTaskContainer: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  createTaskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E6EB',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createTaskTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    fontFamily: typography.families.semibold,
  },
  createTaskScrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  priorityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E6EB',
  },
  priorityLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    fontFamily: typography.families.medium,
  },
  formFieldNew: {
    marginTop: 16,
  },
  labelNew: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: 8,
    fontFamily: typography.families.medium,
  },
  labelRowNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dropdownField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E6EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownText: {
    fontSize: 16,
    color: '#1A1A1A',
    fontFamily: typography.families.regular,
    flex: 1,
  },
  dropdownPlaceholder: {
    color: '#8E8E93',
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E6EB',
    borderRadius: 12,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E6EB',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#1A1A1A',
    fontFamily: typography.families.regular,
  },
  textInputNew: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E6EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A1A',
    fontFamily: typography.families.regular,
  },
  textAreaNew: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E6EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A1A',
    fontFamily: typography.families.regular,
    minHeight: 100,
  },
  datesRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  dateFieldNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E6EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dateTextNew: {
    fontSize: 16,
    color: '#1A1A1A',
    fontFamily: typography.families.regular,
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: typography.families.semibold,
  },
  addTeamButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F0EFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E6EB',
  },
  teamMemberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  teamMemberInitials: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: typography.families.semibold,
  },
  teamMemberInfo: {
    flex: 1,
  },
  teamMemberName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1A1A1A',
    fontFamily: typography.families.medium,
    marginBottom: 2,
  },
  teamMemberRole: {
    fontSize: 14,
    color: '#8E8E93',
    fontFamily: typography.families.regular,
  },
  removeMemberButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
    gap: 8,
  },
  attachmentThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#E5E6EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentThumbnailText: {
    fontSize: 12,
    color: '#8E8E93',
  },
  attachmentInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  attachmentInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E6EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1A1A1A',
    fontFamily: typography.families.regular,
  },
  attachButton: {
    backgroundColor: '#877ED2',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: typography.families.semibold,
  },
  createTaskButton: {
    backgroundColor: '#877ED2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  createTaskButtonDisabled: {
    opacity: 0.5,
  },
  createTaskButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: typography.families.semibold,
  },
  // Team Member Modal Styles
  teamModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  teamModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  teamModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E6EB',
  },
  teamModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: typography.families.semibold,
  },
  teamModalList: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  teamModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E6EB',
  },
});
