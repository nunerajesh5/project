import React, { useEffect, useState, useContext, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  RefreshControl, 
  TouchableOpacity, 
  ActivityIndicator,
  Dimensions,
  Modal,
  Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { translateStatus } from '../../utils/translations';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../api/client';
import { tokens } from '../../design/tokens';
const { colors, spacing, radii, typography } = tokens;

type TaskStatus = 'todo' | 'in_progress' | 'done' | 'overdue';

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
  project_name: string;
  due_date: string;
  created_at: string;
  updated_at: string;
  assigned_employees?: Employee[];
  assigned_to?: string;
  first_name?: string;
  last_name?: string;
  employee_email?: string;
  priority?: string;
  location?: string;
  total_time_minutes?: number;
}

export default function EmployeeAllTasksScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useContext(AuthContext);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'in_progress' | 'todo' | 'done' | 'all'>('in_progress');
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [runningTimers, setRunningTimers] = useState<Record<string, { startTime: number; elapsed: number }>>({});
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const timerIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  // Get week days for date selector
  const getWeekDays = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1)); // Get Monday
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      days.push({
        date: date,
        dateStr: date.toISOString().split('T')[0],
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: date.getDate(),
      });
    }
    return days;
  };

  const weekDays = getWeekDays();
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Check if a date is today
  const isToday = (dateStr: string) => dateStr === todayStr;

  // Get unique projects
  const projects = Array.from(new Set(tasks.map(t => t.project_name))).map(name => ({
    id: name,
    name: name,
  }));

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (selectedFilter !== 'all' && task.status !== selectedFilter) return false;
    if (selectedProject !== 'all' && task.project_name !== selectedProject) return false;
    return true;
  });

  // Count tasks by status
  const taskCounts = {
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    todo: tasks.filter(t => t.status === 'todo').length,
    done: tasks.filter(t => t.status === 'done').length,
    all: tasks.length,
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'done': return '#34C759';
      case 'in_progress': return '#877ED2';
      case 'overdue': return '#FF3B30';
      case 'todo': return '#8E8E93';
      default: return '#8E8E93';
    }
  };

  const getStatusText = (status: TaskStatus) => {
    switch (status) {
      case 'in_progress': return 'In Progress';
      case 'todo': return 'To Do';
      case 'done': return 'Completed';
      case 'overdue': return 'Overdue';
      default: return status;
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      if (!user?.id) {
        setTasks([]);
        return;
      }

      const response = await api.get(`/api/tasks/employee/${user.id}`, { 
        params: { 
          page: 1, 
          limit: 100 
        } 
      });
      
      setTasks(response.data.tasks || []);
    } catch (error) {
      console.error('Error loading employee tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(timerIntervals.current).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Timer functions
  const startTimer = (taskId: string) => {
    if (runningTimers[taskId]) return;
    
    const startTime = Date.now();
    setRunningTimers(prev => ({
      ...prev,
      [taskId]: { startTime, elapsed: 0 }
    }));

    timerIntervals.current[taskId] = setInterval(() => {
      setRunningTimers(prev => {
        if (prev[taskId]) {
          return {
            ...prev,
            [taskId]: {
              ...prev[taskId],
              elapsed: Date.now() - prev[taskId].startTime
            }
          };
        }
        return prev;
      });
    }, 1000);
  };

  const stopTimer = (taskId: string) => {
    if (timerIntervals.current[taskId]) {
      clearInterval(timerIntervals.current[taskId]);
      delete timerIntervals.current[taskId];
    }
    setRunningTimers(prev => {
      const updated = { ...prev };
      delete updated[taskId];
      return updated;
    });
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return {
      hours: hours.toString().padStart(2, '0'),
      minutes: minutes.toString().padStart(2, '0')
    };
  };

  const getTimeWorked = (task: Task) => {
    if (runningTimers[task.id]) {
      const totalMs = (task.total_time_minutes || 0) * 60 * 1000 + runningTimers[task.id].elapsed;
      return formatTime(totalMs);
    }
    if (task.total_time_minutes) {
      return formatTime(task.total_time_minutes * 60 * 1000);
    }
    return { hours: '00', minutes: '00' };
  };

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

  const handleTaskPress = (task: Task) => {
    navigation.navigate('TaskDetails', { taskId: task.id });
  };

  const handleTakePhoto = (task: Task) => {
    navigation.navigate('TaskUpload', { taskId: task.id });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primaryPurple} />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Task</Text>
        <View style={styles.headerSpacer} />
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="ellipsis-vertical" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Date Selector */}
        <View style={styles.dateSelector}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateSelectorContent}
          >
          {weekDays.map((day) => {
            const isTodayDate = isToday(day.dateStr);
            const isSelected = day.dateStr === selectedDate;
            const isSelectedButNotToday = isSelected && !isTodayDate;
            
            return (
              <TouchableOpacity
                key={day.dateStr}
                style={[
                  styles.dateItem, 
                  isTodayDate && styles.dateItemToday,
                  isSelectedButNotToday && styles.dateItemSelected
                ]}
                onPress={() => setSelectedDate(day.dateStr)}
              >
                <Text style={[
                  styles.dateNumber, 
                  isTodayDate ? styles.dateNumberToday : (isSelectedButNotToday ? styles.dateNumberSelected : null)
                ]}>
                  {day.dayNum}
                </Text>
                <Text style={[
                  styles.dateDay, 
                  isTodayDate ? styles.dateDayToday : (isSelectedButNotToday ? styles.dateDaySelected : null)
                ]}>
                  {day.dayName}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity 
            style={styles.calendarIcon}
            onPress={() => {
              const today = new Date();
              setCalendarDate(today);
              setShowCalendarPicker(true);
            }}
          >
            <View style={styles.calendarIconContainer}>
              <Ionicons name="calendar-outline" size={20} color={colors.primaryPurple} />
              <View style={styles.clockOverlay}>
                <Ionicons name="time-outline" size={10} color={colors.primaryPurple} />
              </View>
            </View>
          </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Task Category Filters */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
            <TouchableOpacity
              style={[styles.filterTab, selectedFilter === 'in_progress' && styles.filterTabActive]}
              onPress={() => setSelectedFilter('in_progress')}
            >
              <Text style={[styles.filterText, selectedFilter === 'in_progress' && styles.filterTextActive]}>
                In Progress ({taskCounts.in_progress})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, selectedFilter === 'todo' && styles.filterTabActive]}
              onPress={() => setSelectedFilter('todo')}
            >
              <Text style={[styles.filterText, selectedFilter === 'todo' && styles.filterTextActive]}>
                To Do ({taskCounts.todo})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, selectedFilter === 'done' && styles.filterTabActive]}
              onPress={() => setSelectedFilter('done')}
            >
              <Text style={[styles.filterText, selectedFilter === 'done' && styles.filterTextActive]}>
                Completed ({taskCounts.done})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, selectedFilter === 'all' && styles.filterTabActive]}
              onPress={() => setSelectedFilter('all')}
            >
              <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>
                All ({taskCounts.all})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Projects Filter */}
        <View style={styles.projectFilterContainer}>
          <Text style={styles.projectFilterLabel}>Projects</Text>
          <View>
            <TouchableOpacity 
              style={styles.projectFilterDropdown}
              onPress={() => setShowProjectDropdown(!showProjectDropdown)}
            >
              <Text style={styles.projectFilterText}>
                {selectedProject === 'all' ? 'All' : selectedProject}
              </Text>
              <Ionicons name={showProjectDropdown ? "chevron-up" : "chevron-down"} size={18} color="#9CA3AF" />
            </TouchableOpacity>
            {showProjectDropdown && (
              <View style={styles.projectDropdownMenu}>
                <TouchableOpacity
                  style={styles.projectDropdownItem}
                  onPress={() => {
                    setSelectedProject('all');
                    setShowProjectDropdown(false);
                  }}
                >
                  <Text style={styles.projectDropdownText}>All</Text>
                </TouchableOpacity>
                {projects.map((project) => (
                  <TouchableOpacity
                    key={project.id}
                    style={styles.projectDropdownItem}
                    onPress={() => {
                      setSelectedProject(project.name);
                      setShowProjectDropdown(false);
                    }}
                  >
                    <Text style={styles.projectDropdownText}>{project.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Task Cards */}
        <View style={styles.tasksContainer}>
          {filteredTasks.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No Tasks Found</Text>
              <Text style={styles.emptySubtitle}>No tasks match your current filters.</Text>
            </View>
          ) : (
            filteredTasks.map((task) => {
              const isTimerRunning = !!runningTimers[task.id];
              const overdue = isOverdue(task.due_date);
              const daysRemaining = getDaysRemaining(task.due_date);
              const statusColor = getStatusColor(task.status);

              return (
                <TouchableOpacity
                  key={task.id}
                  style={styles.taskCard}
                  onPress={() => handleTaskPress(task)}
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
                      <Ionicons name="person" size={16} color="#fff" />
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
                      <View style={styles.timeWorkedRow}>
                        <Text style={styles.timeWorkedNumber}>{getTimeWorked(task).hours}</Text>
                        <Text style={styles.timeWorkedUnit}>hr </Text>
                        <Text style={styles.timeWorkedNumber}>{getTimeWorked(task).minutes}</Text>
                        <Text style={styles.timeWorkedUnit}>min</Text>
                      </View>
                    </View>
                    <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        isTimerRunning ? styles.actionButtonPrimary : styles.actionButtonStartTimer
                      ]}
                      onPress={() => {
                        if (isTimerRunning) {
                          stopTimer(task.id);
                        } else {
                          startTimer(task.id);
                        }
                      }}
                    >
                      <Ionicons 
                        name={isTimerRunning ? "stop-circle" : "time-outline"} 
                        size={16} 
                        color="#fff"
                      />
                      <Text style={styles.actionButtonText}>
                        {isTimerRunning ? 'Stop Timer' : 'Start Timer'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.actionButtonSecondary]}
                      onPress={() => handleTakePhoto(task)}
                    >
                      <Ionicons name="camera-outline" size={16} color="#877ED2" />
                      <Text style={styles.actionButtonTextSecondary}>Status</Text>
                    </TouchableOpacity>
                  </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Calendar Picker Modal */}
      {Platform.OS === 'ios' && showCalendarPicker && (
        <Modal
          visible={showCalendarPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowCalendarPicker(false)}
        >
          <View style={styles.calendarModalOverlay}>
            <View style={styles.calendarModalContent}>
              <View style={styles.calendarModalHeader}>
                <Text style={styles.calendarModalTitle}>Select Date</Text>
                <TouchableOpacity onPress={() => setShowCalendarPicker(false)}>
                  <Ionicons name="close" size={24} color="#1A1A1A" />
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={calendarDate}
                mode="date"
                display="spinner"
                onChange={(event, date) => {
                  if (date) {
                    setCalendarDate(date);
                  }
                  if (event.type === 'dismissed') {
                    setShowCalendarPicker(false);
                  }
                }}
              />
              <TouchableOpacity
                style={styles.calendarConfirmButton}
                onPress={() => {
                  setSelectedDate(calendarDate.toISOString().split('T')[0]);
                  setShowCalendarPicker(false);
                }}
              >
                <Text style={styles.calendarConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      {Platform.OS === 'android' && showCalendarPicker && (
        <DateTimePicker
          value={calendarDate}
          mode="date"
          display="default"
          onChange={(event, date) => {
            setShowCalendarPicker(false);
            if (date && event.type === 'set') {
              setCalendarDate(date);
              setSelectedDate(date.toISOString().split('T')[0]);
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F6FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    //paddingHorizontal: 16,
    paddingTop: 24,
    backgroundColor: '#F5F5F5',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: typography.families.semibold,
    marginLeft: 8,
  },
  headerSpacer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  dateSelector: {
    backgroundColor: '#F5F5F5',
    paddingTop: 12,
    height: 80,
  },
  dateSelectorContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    height: 56,
  },
  dateItem: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#E8E7ED',
    minWidth: 48,
    width: 58,
    height: 56,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dateItemToday: {
    backgroundColor: '#877ED2',
    borderColor: '#877ED2',
  },
  dateItemSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#877ED2',
    borderWidth: 2,
  },
  dateNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: typography.families.semibold,
    marginBottom: 2,
  },
  dateNumberToday: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  dateNumberSelected: {
    color: '#877ED2',
    fontWeight: '700',
  },
  dateDay: {
    fontSize: 11,
    color: '#888888',
    fontFamily: typography.families.regular,
  },
  dateDayToday: {
    color: '#FFFFFF',
    fontWeight: '500',
  },
  dateDaySelected: {
    color: '#877ED2',
    fontWeight: '500',
  },
  calendarIcon: {
    marginLeft: 4,
    height: 52,
    justifyContent: 'center',
  },
  calendarIconContainer: {
    width: 48,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  clockOverlay: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primaryPurple,
  },
  calendarModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  calendarModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  calendarModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E6EB',
  },
  calendarModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    fontFamily: typography.families.semibold,
  },
  calendarConfirmButton: {
    backgroundColor: colors.primaryPurple,
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  calendarConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: typography.families.semibold,
  },
  filterContainer: {
    backgroundColor: 'transparent',
    paddingTop: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E6EB',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  filterTab: {
    marginRight: 20,
    paddingBottom: 6,
    position: 'relative',
  },
  filterTabActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#877ED2',
    borderStyle: 'solid',
    marginBottom: -1,
  },
  filterText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontFamily: typography.families.regular,
    fontWeight: '400',
  },
  filterTextActive: {
    color: '#1A1A1A',
    fontWeight: '600',
    fontFamily: typography.families.semibold,
  },
  projectFilterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E6EB',
  },
  projectFilterLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6A6D73',
    marginRight: 16,
    fontFamily: typography.families.medium,
  },
  projectFilterDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E6EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 300,
  },
  projectFilterText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontFamily: typography.families.regular,
    flex: 1,
  },
  projectDropdownMenu: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E6EB',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
    minWidth: 150,
    zIndex: 1000,
  },
  projectDropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E6EB',
  },
  projectDropdownText: {
    fontSize: 14,
    color: '#1A1A1A',
    fontFamily: typography.families.regular,
  },
  tasksContainer: {
    padding: 16,
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
    height: 220,
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
    width: 250,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#404040',
    marginBottom: 8,
    marginTop: -6,
    paddingHorizontal: 12,
    fontFamily: 'Inter_500Medium',
  },
  avatarContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 40,
    right: 12,
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 18,
    backgroundColor: '#FF9500',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 8,
    left: 10,
    zIndex: 1,
    marginLeft: -30,
    marginTop: -10,
  },
  avatarPlus: {
    width: 32,
    height: 32,
    borderRadius: 20,
    backgroundColor: '#666666',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 5,
    right: 8,
    borderWidth: 2,
    borderColor: '#fff',
    zIndex: 2,
  },
  avatarPlusText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
    lineHeight: 14,
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
    fontSize: 10,
    color: '#727272',
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
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
    //marginBottom: 4,
  },
  overdueValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF3B30',
    fontFamily: typography.families.semibold,
  },
  overdueBar: {
    height: 4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    width: '100%',
    marginTop: 4,
  },
  bottomSection: {
    backgroundColor: '#E8E7ED99',
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
    fontSize: 10,
    color: '#727272',
    fontWeight: '400',
    marginBottom: 4,
    fontFamily: typography.families.regular,
  },
  timeWorkedRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: -4,
  },
  timeWorkedNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    fontFamily: typography.families.bold,
  },
  timeWorkedUnit: {
    fontSize: 12,
    fontWeight: '400',
    color: '#6B7280',
    fontFamily: typography.families.regular,
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
  actionButtonPrimary: {
    backgroundColor: '#877ED2',
  },
  actionButtonStartTimer: {
    backgroundColor: '#6F67CC',
    borderRadius: 40,
  },
  actionButtonSecondary: {
    backgroundColor: '#F0EFFF',
    borderRadius: 40,
    borderWidth: 0,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: typography.families.regular,
  },
  actionButtonTextPrimary: {
    color: '#FFFFFF',
  },
  actionButtonTextSecondary: {
    fontSize: 14,
    fontWeight: '500',
    color: '#877ED2',
    fontFamily: typography.families.medium,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    fontFamily: typography.families.semibold,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontFamily: typography.families.regular,
  },
});
