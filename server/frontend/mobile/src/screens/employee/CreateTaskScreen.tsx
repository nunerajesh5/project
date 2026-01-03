import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AuthContext } from '../../context/AuthContext';
import { dashboardApi, Project } from '../../api/dashboard';
import { createProjectTask, listEmployees } from '../../api/endpoints';
import Card from '../../components/shared/Card';
import Button from '../../components/shared/Button';
import AppHeader from '../../components/shared/AppHeader';
import SafeAreaWrapper from '../../components/shared/SafeAreaWrapper';
import VoiceToTextButton from '../../components/shared/VoiceToTextButton';

type TaskStatus = 'To Do' | 'Active' | 'Completed' | 'Cancelled' | 'On Hold';

interface TimeEntry {
  id: string;
  userName: string;
  duration: string;
  startTime: string;
  endTime: string;
  date: string;
}

interface NewTask {
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  projectId: string;
  projectName: string;
  timeEntries?: TimeEntry[];
  totalTrackedTime?: string;
}

interface EmployeeItem {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  department?: string;
}

export default function CreateTaskScreen() {
  const navigation = useNavigation<any>();
  const { user } = useContext(AuthContext);
  
  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskStartDate, setTaskStartDate] = useState(new Date());
  const [taskEndDate, setTaskEndDate] = useState(new Date());
  const [showTaskStartDatePicker, setShowTaskStartDatePicker] = useState(false);
  const [showTaskEndDatePicker, setShowTaskEndDatePicker] = useState(false);

  // Assignees state (Manager can assign to multiple employees)
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [showAssigneeModal, setShowAssigneeModal] = useState(false);
  
  // Time tracking state
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [totalTrackedTime, setTotalTrackedTime] = useState('0h 0m');
  const [showTimeTrackingModal, setShowTimeTrackingModal] = useState(false);
  const [timeEntryInput, setTimeEntryInput] = useState('');
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [timeEntryDate, setTimeEntryDate] = useState(new Date());
  const [showTimeEntryDatePicker, setShowTimeEntryDatePicker] = useState(false);
  const [timeEntryStartTime, setTimeEntryStartTime] = useState<Date | null>(null);
  const [timeEntryEndTime, setTimeEntryEndTime] = useState<Date | null>(null);
    const [showStartTimePicker, setShowStartTimePicker] = useState(false);
    const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timerStartTime) {
      interval = setInterval(() => {
        const elapsed = Date.now() - timerStartTime.getTime();
        setTimerElapsed(elapsed);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerStartTime]);
  
  // Load projects on component mount
  useEffect(() => {
    loadProjects();
    // Prefetch employees list for assignment (supports manager multi-assign)
    loadEmployees();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await dashboardApi.getAssignedProjects();
      setProjects(response);
      
      // Auto-select first project if available
      if (response.length > 0) {
        setSelectedProject(response[0]);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      Alert.alert('Error', 'Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const res = await listEmployees({ page: 1, limit: 200, active: 'all' as any });
      // Some endpoints return { employees, pagination }
      const list = (res as any).employees ?? [];
      setEmployees(list);
    } catch (err) {
      console.error('Error loading employees:', err);
    }
  };

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setShowProjectDropdown(false);
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowTaskStartDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setTaskStartDate(selectedDate);
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowTaskEndDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setTaskEndDate(selectedDate);
    }
  };

  const toggleAssignee = (id: string) => {
    setSelectedAssigneeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Time tracking functions
  const calculateTotalTime = (entries: TimeEntry[]): string => {
    let totalMinutes = 0;
    entries.forEach(entry => {
      const match = entry.duration.match(/(\d+)h\s*(\d+)m/);
      if (match) {
        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        totalMinutes += hours * 60 + minutes;
      }
    });
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  };

  const handleOpenTimeTracking = () => {
    setShowTimeTrackingModal(true);
  };

  const handleStartTimer = () => {
    setIsTimerRunning(true);
    setTimerStartTime(new Date());
    setTimerElapsed(0);
  };

  const handleStopTimer = () => {
    if (!timerStartTime) return;
    
    const endTime = new Date();
    const durationMs = endTime.getTime() - timerStartTime.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    const newEntry: TimeEntry = {
      id: Date.now().toString(),
      userName: 'Current User',
      duration: `${hours}h ${minutes}m`,
      startTime: timerStartTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      endTime: endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      date: timeEntryDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    };

    const updatedEntries = [...timeEntries, newEntry];
    setTimeEntries(updatedEntries);
    setTotalTrackedTime(calculateTotalTime(updatedEntries));
    
    setIsTimerRunning(false);
    setTimerStartTime(null);
    setTimerElapsed(0);
  };

  const handleAddManualTime = () => {
    if (!timeEntryInput.trim() || !timeEntryStartTime || !timeEntryEndTime) {
      Alert.alert('Error', 'Please fill in all time entry fields');
      return;
    }

    const match = timeEntryInput.match(/(\d+)h\s*(\d+)m/);
    if (!match) {
      Alert.alert('Error', 'Please enter time in format: Xh Ym (e.g., 2h 30m)');
      return;
    }

    const now = new Date();
    let durationLabel = timeEntryInput.trim();
    if (!durationLabel.includes('h')) durationLabel = '0h ' + durationLabel;
    if (!durationLabel.includes('m')) durationLabel = durationLabel + ' 0m';
    if (!durationLabel) durationLabel = '0h 0m';

    const newEntry: TimeEntry = {
      id: Date.now().toString(),
      userName: 'Current User',
      duration: durationLabel,
      startTime: timeEntryStartTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      endTime: timeEntryEndTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      date: timeEntryDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
    };

    const updatedEntries = [...timeEntries, newEntry];
    setTimeEntries(updatedEntries);
    setTotalTrackedTime(calculateTotalTime(updatedEntries));

    setTimeEntryInput('');
    setTimeEntryStartTime(null);
    setTimeEntryEndTime(null);
  };

  const handleDeleteTimeEntry = (entryId: string) => {
    const updatedEntries = timeEntries.filter(entry => entry.id !== entryId);
    setTimeEntries(updatedEntries);
    setTotalTrackedTime(calculateTotalTime(updatedEntries));
  };

  const validateForm = (): string | null => {
    if (!taskTitle.trim()) {
      return 'Task title is required';
    }
    if (!taskDescription.trim()) {
      return 'Task description is required';
    }
    if (!selectedProject) {
      return 'Please select a project';
    }
    if (taskEndDate < taskStartDate) {
      return 'End date cannot be before start date';
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) {
      Alert.alert('Validation Error', validationError);
      return;
    }

    if (!selectedProject) {
      Alert.alert('Error', 'Please select a project');
      return;
    }

    setSubmitting(true);
    
    try {
      // If manager selected multiple assignees, create one task per assignee (backend is single-assignee)
      const assignees = selectedAssigneeIds.length > 0 ? selectedAssigneeIds : [user?.id || ''];

      // If no user id (edge case) and no selected assignees, create unassigned task
      const makeUnassignedToo = assignees.length === 1 && assignees[0] === '';

      if (makeUnassignedToo) {
        await createProjectTask(selectedProject.id, {
          title: taskTitle.trim(),
          status: 'To Do',
        });
      } else {
        // Filter any empty ids just in case
        const validAssignees = assignees.filter(Boolean);
        await Promise.all(
          validAssignees.map(empId =>
            createProjectTask(selectedProject.id, {
              title: taskTitle.trim(),
              status: 'To Do',
              assignedTo: empId,
            })
          )
        );
      }

      const createdCount = selectedAssigneeIds.length || (makeUnassignedToo ? 1 : 1);
      Alert.alert(
        'Success',
        selectedAssigneeIds.length > 1
          ? `Created ${selectedAssigneeIds.length} tasks (one per assignee) in "${selectedProject.name}"`
          : `Task "${taskTitle}" has been created in project "${selectedProject.name}"`,
        [
          {
            text: 'OK',
            onPress: () => {
              // Reset form
              setTaskTitle('');
              setTaskDescription('');
              setTaskStartDate(new Date());
              setTaskEndDate(new Date());
              setTimeEntries([]);
              setTotalTrackedTime('0h 0m');
              setSelectedAssigneeIds([]);
              setSelectedProject(projects.length > 0 ? projects[0] : null);
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error creating task:', error);
      Alert.alert('Error', 'Failed to create task. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaWrapper>
        <AppHeader />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading projects...</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  if (projects.length === 0) {
    return (
      <SafeAreaWrapper>
        <AppHeader />
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-outline" size={64} color="#8E8E93" />
          <Text style={styles.emptyTitle}>No Projects Available</Text>
          <Text style={styles.emptyMessage}>
            You are not assigned to any projects yet. Please contact your manager to get assigned to a project.
          </Text>
          <Button
            title="Go Back"
            onPress={() => navigation.goBack()}
          />
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper>
      <AppHeader 
        leftAction={{
          icon: '←',
          onPress: () => navigation.goBack(),
          iconStyle: { fontSize: 34 }
        }}
      />
      
      
      <ScrollView style={styles.container}>
        {/* Project Selection */}
        <Card style={styles.card}>
          <Text style={styles.label}>Project *</Text>
          <View>
            <TouchableOpacity
              style={styles.projectSelector}
              onPress={() => {
                console.log('Project dropdown toggled:', !showProjectDropdown);
                setShowProjectDropdown(!showProjectDropdown);
              }}
            >
              <View style={styles.projectInfo}>
                <Text style={styles.projectName}>
                  {selectedProject ? selectedProject.name : 'Select a project'}
                </Text>
                {selectedProject && (
                  <Text style={styles.projectClient}>
                    Client: {selectedProject.client_name}
                  </Text>
                )}
              </View>
              <Ionicons 
                name={showProjectDropdown ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#666" 
              />
            </TouchableOpacity>
            
          </View>
        </Card>

        {/* Assign To (optional, supports multiple) - show for managers only */}
        {user?.role === 'manager' && (
          <Card style={styles.card}>
            <Text style={styles.label}>Assign to</Text>
            {selectedAssigneeIds.length > 0 ? (
              <View style={styles.selectedChipsContainer}>
                {selectedAssigneeIds.map(id => {
                  const emp = employees.find(e => e.id === id);
                  const label = emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown';
                  return (
                    <View key={id} style={styles.chip}>
                      <Text style={styles.chipText}>{label}</Text>
                      <TouchableOpacity onPress={() => toggleAssignee(id)}>
                        <Text style={styles.chipRemove}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.hintText}>No assignees selected</Text>
            )}
            <TouchableOpacity style={styles.selectAssigneesButton} onPress={() => setShowAssigneeModal(true)}>
              <Text style={styles.selectAssigneesButtonText}>
                {selectedAssigneeIds.length > 0 ? 'Edit assignees' : 'Select assignees'}
              </Text>
            </TouchableOpacity>
          </Card>
        )}

        {/* Task Title */}
        <Card style={styles.card}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Task Title *</Text>
            <VoiceToTextButton
              onResult={(text) => setTaskTitle(prev => prev ? `${prev} ${text}` : text)}
              size="small"
            />
          </View>
          <TextInput
            style={styles.textInput}
            value={taskTitle}
            onChangeText={setTaskTitle}
            placeholder="Enter task title..."
            maxLength={100}
          />
          <Text style={styles.characterCount}>{taskTitle.length}/100</Text>
        </Card>

        {/* Task Description */}
        <Card style={styles.card}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Description *</Text>
            <VoiceToTextButton
              onResult={(text) => setTaskDescription(prev => prev ? `${prev} ${text}` : text)}
              size="small"
            />
          </View>
          <TextInput
            style={styles.textArea}
            value={taskDescription}
            onChangeText={setTaskDescription}
            placeholder="Describe the task in detail..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.characterCount}>{taskDescription.length}/500</Text>
        </Card>

        {/* Time Tracking */}
        <Card style={styles.card}>
          <Text style={styles.label}>Time Tracking</Text>
          <TouchableOpacity
            style={styles.timeTrackingButton}
            onPress={handleOpenTimeTracking}
          >
            <View style={styles.timeTrackingButtonLeft}>
              <Text style={styles.timeTrackingIcon}>⏱️</Text>
              <Text style={styles.timeTrackingLabel}>Track Time</Text>
            </View>
            <Text style={styles.timeTrackingValue}>
              {totalTrackedTime}
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Start and End Dates */}
        <Card style={styles.card}>
          <Text style={styles.label}>Dates</Text>
          {/* Start Date */}
          <TouchableOpacity
            style={[styles.dateSelector, { marginBottom: 12 }]}
            onPress={() => setShowTaskStartDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#007AFF" />
            <Text style={styles.dateText}>
              Start: {taskStartDate.toLocaleDateString('en-IN', {
                day: '2-digit', month: '2-digit', year: 'numeric'
              })}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>

          {/* End Date */}
          <TouchableOpacity
            style={styles.dateSelector}
            onPress={() => setShowTaskEndDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#34C759" />
            <Text style={styles.dateText}>
              End: {taskEndDate.toLocaleDateString('en-IN', {
                day: '2-digit', month: '2-digit', year: 'numeric'
              })}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        </Card>

        {/* Submit Button */}
        <View style={styles.submitSection}>
          <Button
            title={submitting ? 'Creating Task...' : 'Create Task'}
            onPress={handleSubmit}
            disabled={submitting}
            loading={submitting}
          />
        </View>
      </ScrollView>

      {/* Assignee Multi-select Modal */}
      <Modal
        visible={showAssigneeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAssigneeModal(false)}
      >
        <View style={styles.assigneeModalOverlay}>
          <View style={styles.assigneeModalContent}>
            <View style={styles.assigneeHeader}>
              <Text style={styles.assigneeTitle}>Select Assignees</Text>
              <TouchableOpacity onPress={() => setShowAssigneeModal(false)}>
                <Text style={styles.assigneeClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.assigneeSearchRow}>
              <Ionicons name="search" size={18} color="#666" />
              <TextInput
                style={styles.assigneeSearchInput}
                placeholder="Search employees..."
                value={assigneeSearch}
                onChangeText={setAssigneeSearch}
              />
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {employees
                .filter(e => {
                  const term = assigneeSearch.trim().toLowerCase();
                  if (!term) return true;
                  const full = `${e.first_name} ${e.last_name}`.toLowerCase();
                  return full.includes(term) || (e.email?.toLowerCase().includes(term) ?? false);
                })
                .map(e => {
                  const checked = selectedAssigneeIds.includes(e.id);
                  return (
                    <TouchableOpacity
                      key={e.id}
                      style={styles.assigneeRow}
                      onPress={() => toggleAssignee(e.id)}
                    >
                      <Text style={styles.assigneeName}>{e.first_name} {e.last_name}</Text>
                      <Text style={[styles.checkbox, checked ? styles.checkboxChecked : undefined]}>
                        {checked ? '✓' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            <View style={styles.assigneeFooter}>
              <TouchableOpacity style={styles.assigneeCancelBtn} onPress={() => setShowAssigneeModal(false)}>
                <Text style={styles.assigneeCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.assigneeApplyBtn} onPress={() => setShowAssigneeModal(false)}>
                <Text style={styles.assigneeApplyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* Project Selection Modal */}
      <Modal
        visible={showProjectDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowProjectDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowProjectDropdown(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Project</Text>
              <TouchableOpacity onPress={() => setShowProjectDropdown(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {projects.map((project) => (
                <TouchableOpacity
                  key={project.id}
                  style={[
                    styles.projectItem,
                    selectedProject?.id === project.id && styles.projectItemSelected
                  ]}
                  onPress={() => handleProjectSelect(project)}
                >
                  <View style={styles.projectItemInfo}>
                    <Text style={styles.projectItemName}>{project.name}</Text>
                    <Text style={styles.projectItemClient}>
                      Client: {project.client_name}
                    </Text>
                    <Text style={styles.projectItemStatus}>
                      Status: {project.status}
                    </Text>
                  </View>
                  {selectedProject?.id === project.id && (
                    <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Task Start Date Picker */}
      {showTaskStartDatePicker && (
        <DateTimePicker
          value={taskStartDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleStartDateChange}
          minimumDate={new Date('2000-01-01')}
        />
      )}

      {/* Task End Date Picker */}
      {showTaskEndDatePicker && (
        <DateTimePicker
          value={taskEndDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleEndDateChange}
          minimumDate={new Date('2000-01-01')}
        />
      )}

      {/* Time Entry Date Picker */}
      {showTimeEntryDatePicker && (
        <DateTimePicker
          value={timeEntryDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowTimeEntryDatePicker(false);
            if (selectedDate) setTimeEntryDate(selectedDate);
          }}
        />
      )}

        {/* Start Time Picker */}
        {showStartTimePicker && (
          <DateTimePicker
            value={timeEntryStartTime || new Date()}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedTime) => {
              setShowStartTimePicker(false);
              if (selectedTime) setTimeEntryStartTime(selectedTime);
            }}
          />
        )}

        {/* End Time Picker */}
        {showEndTimePicker && (
          <DateTimePicker
            value={timeEntryEndTime || new Date()}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(event, selectedTime) => {
              setShowEndTimePicker(false);
              if (selectedTime) setTimeEntryEndTime(selectedTime);
            }}
          />
        )}

      {/* Time Tracking Modal */}
      <Modal
        visible={showTimeTrackingModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTimeTrackingModal(false)}
      >
        <View style={styles.timeModalOverlay}>
          <View style={styles.timeModalContent}>
            <View style={styles.timeModalHeader}>
              <Text style={styles.timeModalTitle}>Track Time</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowTimeTrackingModal(false)}
              >
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.timeModalScrollView}>
              {/* Total Time Display */}
              <View style={styles.totalTimeSection}>
                <Text style={styles.totalTimeLabel}>Total time tracked</Text>
                <Text style={styles.totalTimeValue}>{totalTrackedTime}</Text>
              </View>

              {/* Time Entry Input */}
              <View style={styles.timeInputSection}>
                <View style={styles.timeInputWrapper}>
                  <TextInput
                    style={styles.timeInput}
                    value={isTimerRunning 
                      ? `${Math.floor(timerElapsed / (1000 * 60 * 60))}h ${Math.floor((timerElapsed % (1000 * 60 * 60)) / (1000 * 60))}m`
                      : timeEntryInput}
                    onChangeText={setTimeEntryInput}
                    placeholder="e.g., 2h 30m"
                    placeholderTextColor="#999"
                    editable={!isTimerRunning}
                  />
                  <TouchableOpacity
                    style={styles.timerButton}
                    onPress={isTimerRunning ? handleStopTimer : handleStartTimer}
                  >
                    <Text style={styles.timerButtonIcon}>
                      {isTimerRunning ? '⏸' : '▶'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Date Selection */}
              <TouchableOpacity
                style={styles.timeDetailRow}
                onPress={() => setShowTimeEntryDatePicker(true)}
              >
                <Text style={styles.timeDetailIcon}>📅</Text>
                <Text style={styles.timeDetailText}>Date</Text>
                <Text style={styles.timeDetailInput}>
                  {timeEntryDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </TouchableOpacity>

              {/* Time Range Selection */}
              <View style={styles.timeTrackingRow}>
                <View style={styles.timeInputContainer}>
                  <Text style={styles.timeInputLabel}>Start Time</Text>
                  <TouchableOpacity
                    style={styles.timeChip}
                      onPress={() => setShowStartTimePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.timeChipText}>
                      {timeEntryStartTime
                        ? timeEntryStartTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                        : 'Start time'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.timeInputContainer}>
                  <Text style={styles.timeInputLabel}>End Time</Text>
                  <TouchableOpacity
                    style={styles.timeChip}
                      onPress={() => setShowEndTimePicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.timeChipText}>
                      {timeEntryEndTime
                        ? timeEntryEndTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
                        : 'End time'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={styles.saveTimeButton}
                onPress={handleAddManualTime}
              >
                <Text style={styles.saveTimeButtonText}>Save</Text>
              </TouchableOpacity>

              {/* Time Entries List */}
              {timeEntries.length > 0 && (
                <View style={styles.timeEntriesSection}>
                  <Text style={styles.timeEntriesTitle}>Time Entries</Text>
                  {timeEntries.map((entry) => (
                    <View key={entry.id} style={styles.timeEntryItem}>
                      <View style={styles.timeEntryLeft}>
                        <View style={styles.timeEntryAvatar}>
                          <Text style={styles.timeEntryAvatarText}>
                            {entry.userName.substring(0, 1)}
                          </Text>
                        </View>
                        <View style={styles.timeEntryDetails}>
                          <Text style={styles.timeEntryDuration}>{entry.duration}</Text>
                          <Text style={styles.timeEntryTime}>
                            {entry.startTime} - {entry.endTime}
                          </Text>
                          <Text style={styles.timeEntryDate}>{entry.date}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.timeEntryDeleteButton}
                        onPress={() => handleDeleteTimeEntry(entry.id)}
                      >
                        <Text style={styles.timeEntryDeleteIcon}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  backButton: {
    marginTop: 16,
  },
  card: {
    margin: 16,
    marginBottom: 0,
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
  projectSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  projectInfo: {
    flex: 1,
  },
  projectName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  projectClient: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#f8f9fa',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#f8f9fa',
    minHeight: 100,
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
  },
  priorityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  priorityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: '#f8f9fa',
  },
  priorityButtonSelected: {
    backgroundColor: '#f0f8ff',
  },
  priorityIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  priorityText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  priorityTextSelected: {
    color: '#007AFF',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    marginLeft: 12,
  },
  submitSection: {
    padding: 16,
    paddingBottom: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    margin: 20,
    maxHeight: '80%',
    width: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  modalContent: {
    maxHeight: 400,
  },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  projectItemSelected: {
    backgroundColor: '#f0f8ff',
  },
  projectItemInfo: {
    flex: 1,
  },
  projectItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  projectItemClient: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  projectItemStatus: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  // Time Tracking Button Styles
  timeTrackingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
  },
  timeTrackingButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeTrackingIcon: {
    fontSize: 18,
  },
  timeTrackingLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  timeTrackingValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  // Time Tracking Modal Styles
  timeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  timeModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  timeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  timeModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseIcon: {
    fontSize: 24,
    color: '#666',
    fontWeight: '300',
  },
  timeModalScrollView: {
    padding: 20,
  },
  totalTimeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalTimeLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  totalTimeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  timeInputSection: {
    marginBottom: 20,
  },
  timeInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#fff',
  },
  timerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerButtonIcon: {
    fontSize: 20,
  },
  timeDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
    gap: 12,
  },
  timeDetailIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
  },
  timeDetailText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  timeDetailInput: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
    paddingVertical: 0,
  },
  timeTrackingRow: {
    flexDirection: 'row',
    gap: 12,
  },
  timeInputContainer: {
    flex: 1,
  },
  timeInputLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    marginBottom: 8,
  },
  timeChip: {
    backgroundColor: '#f0f2f5',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  timeChipText: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  saveTimeButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  saveTimeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  timeEntriesSection: {
    marginTop: 20,
  },
  timeEntriesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  timeEntryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
  },
  timeEntryLeft: {
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  timeEntryAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeEntryAvatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  timeEntryDetails: {
    flex: 1,
  },
  timeEntryDuration: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  timeEntryTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  timeEntryDate: {
    fontSize: 12,
    color: '#999',
  },
  timeEntryDeleteButton: {
    padding: 4,
  },
  timeEntryDeleteIcon: {
    fontSize: 20,
  },
  // Assignee UI styles
  selectedChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF2FF',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  chipText: {
    color: '#007AFF',
    fontSize: 13,
    marginRight: 6,
  },
  chipRemove: {
    color: '#007AFF',
    fontWeight: '700',
  },
  selectAssigneesButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  selectAssigneesButtonText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  hintText: {
    color: '#8E8E93',
    fontSize: 13,
    marginTop: 6,
  },
  assigneeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  assigneeModalContent: {
    backgroundColor: '#fff',
    width: '85%',
    maxWidth: 420,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  assigneeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  assigneeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  assigneeClose: {
    fontSize: 18,
    color: '#333',
  },
  assigneeSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  assigneeSearchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111',
  },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  assigneeName: {
    fontSize: 15,
    color: '#111',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    color: '#fff',
  },
  assigneeFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  assigneeCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F2F2F7',
  },
  assigneeCancelText: {
    color: '#111',
    fontWeight: '600',
  },
  assigneeApplyBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  assigneeApplyText: {
    color: '#fff',
    fontWeight: '700',
  },
});
