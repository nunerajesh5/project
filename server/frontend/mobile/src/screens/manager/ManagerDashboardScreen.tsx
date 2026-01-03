import React, { useEffect, useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { translateStatus, translatePriority } from '../../utils/translations';
import { tokens } from '../../design/tokens';
const { colors, spacing, radii, typography } = tokens;
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import { dashboardApi, dashboardHelpers, Project, TimeEntry } from '../../api/dashboard';
import { getEmployeeTasks } from '../../api/endpoints';
import Card from '../../components/shared/Card';

// Task types
type TaskStatus = 'To Do' | 'Active' | 'Completed' | 'Cancelled' | 'On Hold';

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  project_id: string;
  project_name: string;
  due_date: string;
  created_at: string;
  updated_at: string;
  assigned_employees?: any[];
  priority?: string;
  location?: string;
}

export default function ManagerDashboardScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useContext(AuthContext);
  
  // Manager Dashboard State
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [weekTimeEntries, setWeekTimeEntries] = useState<TimeEntry[]>([]);
  const [allTimeEntries, setAllTimeEntries] = useState<TimeEntry[]>([]);
  const [teamTasks, setTeamTasks] = useState<Task[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable sorting helpers
  const sortProjects = (projects: Project[]): Project[] => {
    return [...projects].sort((a, b) => {
      const byName = (a.name || '').localeCompare(b.name || '');
      if (byName !== 0) return byName;
      const aCreated = (a as any).created_at || '';
      const bCreated = (b as any).created_at || '';
      return String(aCreated).localeCompare(String(bCreated));
    });
  };

  const sortTimeEntries = (entries: TimeEntry[]): TimeEntry[] => {
    return [...entries].sort((a, b) => {
      const aTime = new Date(a.start_time || (a as any).created_at || 0).getTime();
      const bTime = new Date(b.start_time || (b as any).created_at || 0).getTime();
      return bTime - aTime; // newest first
    });
  };

  const loadManagerData = async () => {
    try {
      console.log('Loading manager dashboard data for user:', user?.id);
      
      if (!user?.id) {
        setError('User not authenticated. Please log in again.');
        return;
      }
      
      setError(null);
      
      // Load dashboard overview
      console.log('Fetching dashboard overview...');
      try {
        const overviewData = await dashboardApi.getOverview();
        setOverview(overviewData.overview);
      } catch (overviewError) {
        console.error('Error fetching overview:', overviewError);
        setOverview(null);
      }
      
      // Load all projects (manager sees all projects)
      console.log('Fetching all projects...');
      const projectsData = await dashboardApi.getProjects({ limit: 100 });
      console.log('Projects data:', projectsData);
      const stableProjects = sortProjects(projectsData?.projects || []);
      setAllProjects(stableProjects);
      
      // Load all time entries for team productivity
      console.log('Fetching team time entries...');
      const timeEntriesData = await dashboardApi.getTimeEntries({ limit: 500 });
      console.log('Time entries data:', timeEntriesData);
      const stableEntries = sortTimeEntries(timeEntriesData?.timeEntries || []);
      setAllTimeEntries(stableEntries);
      
      // Get this week's data (starting from Sunday)
      const todayDate = new Date();
      const sunday = new Date(todayDate);
      sunday.setDate(todayDate.getDate() - todayDate.getDay());
      const sundayStr = sunday.toISOString().split('T')[0];
      
      const weekEntries = dashboardHelpers.getTimeEntriesForWeek(stableEntries, sundayStr);
      setWeekTimeEntries(weekEntries);

      // Load tasks assigned to manager
      console.log('Fetching manager tasks for user:', user.id);
      try {
        const tasksData = await getEmployeeTasks(user.id, 1, 50);
        console.log('Manager tasks data:', tasksData);
        setTeamTasks(tasksData.tasks || []);
      } catch (taskError) {
        console.error('Error fetching manager tasks:', taskError);
        setTeamTasks([]);
      }

      console.log('Manager dashboard data loaded successfully');
      
    } catch (error) {
      console.error('Error loading manager dashboard data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to load data. Please try again.';
      setError(errorMessage);
    }
  };

  useEffect(() => {
    loadManagerData().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadManagerData();
    setRefreshing(false);
  };

  // Utility functions
  const getWeekTotalHours = () => {
    const hours = dashboardHelpers.calculateTotalHours(weekTimeEntries);
    return Math.round(hours);
  };

  const getWeekDateRange = () => {
    const today = new Date();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - today.getDay());
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    
    const formatDate = (date: Date) => {
      const day = date.getDate();
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      return `${day} ${month}`;
    };
    
    return `${formatDate(sunday)} - ${formatDate(saturday)}`;
  };

  const getTaskStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'Completed': return '#34C759';
      case 'Active': return '#877ED2';
      case 'Cancelled': return '#FF3B30';
      case 'On Hold': return '#FF9500';
      case 'To Do': return '#8E8E93';
      default: return '#8E8E93';
    }
  };

  const getTaskStatusText = (status: TaskStatus) => {
    return translateStatus(status, t);
  };

  const formatTaskDueDate = (dueDate: string) => {
    if (!dueDate) return 'No due date';
    const date = new Date(dueDate);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays} days`;
  };

  const formatTaskDate = (dateString: string) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    const formatted = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    // Add comma after month: "16 Nov 2025" -> "16 Nov, 2025"
    return formatted.replace(/(\w+)\s+(\d{4})/, '$1, $2');
  };

  const formatTaskAssignedDate = (assignedDate: string) => {
    if (!assignedDate) return 'Unknown';
    return formatTaskDate(assignedDate);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadManagerData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { colors, spacing, radii, typography, layout } = tokens;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 4 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header Layout - Same as Employee */}
        <View style={styles.heroHeader}>
          <View style={styles.headerInner}>
            <Text style={styles.headerDateTop}>
              {new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' })}, {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
            </Text>
            <View style={styles.headerRowBelowDate}>
              <View style={styles.avatarCircleLeft}>
                <Text style={styles.avatarInitial}>{(user?.firstName || user?.name || 'M')[0].toUpperCase()}</Text>
              </View>
              <View style={styles.textBlock}>
                <Text style={styles.heroGreeting}>Hello {(user?.firstName || user?.name?.split(' ')[0] || 'Manager')}!</Text>
                <Text style={styles.heroSubGreeting}>Good Morning</Text>
                <Text style={styles.heroMeta}>{[user?.jobTitle, user?.role].filter(Boolean).join(' | ')}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Mark your attendance Card */}
        <View style={styles.attendanceWrapper}>
          <Card style={styles.attendanceCard}>
            <View style={styles.attendanceContent}>
              <View style={styles.attendanceIconContainer}>
                <Ionicons name="calendar-outline" size={28} color="#877ED2" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attendanceTitle}>Mark your attendance</Text>
                <Text style={styles.attendanceTime}>9 AM - 5 PM</Text>
              </View>
              <TouchableOpacity
                style={styles.attendanceButton}
                onPress={() => navigation.navigate('ProofOfWorkCapture')}
              >
                <Text style={styles.attendanceButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        {/* Projects Section */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.dashboardSectionTitle}>Projects</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Projects')}>
              <Text style={styles.sectionAction}>All ›</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectsHorizontalList}>
            {allProjects.slice(0, 5).map(project => (
              <TouchableOpacity
                key={project.id}
                style={[styles.miniCard]}
                onPress={() => navigation.navigate('ProjectDetails', { id: project.id })}
              >
                <View style={styles.miniCardContent}>
                  <Text style={styles.miniCardTitle} numberOfLines={2}>{project.name}</Text>
                  <Text style={styles.miniCardMeta} numberOfLines={1}>{project.client_name || 'No client'}</Text>
                  {project.start_date && project.end_date && (
                    <Text style={styles.miniCardDates}>
                      Start <Text style={styles.miniCardDateValue}>{new Date(project.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text> · End <Text style={styles.miniCardDateValue}>{new Date(project.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
            {allProjects.length === 0 && (
              <View style={[styles.miniCardEmpty, { width: layout?.projectCardWidth || 200 }]}> 
                <Text style={styles.emptyMiniText}>No projects yet</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Tasks Section */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.dashboardSectionTitle}>Task</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AllTasks')}>
              <Text style={styles.sectionAction}>All ›</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
            {teamTasks.slice(0, 8).map(task => (
              <TouchableOpacity
                key={task.id}
                style={[styles.taskMiniCard, { width: 200 }]}
                onPress={() => navigation.navigate('TaskDetails', { taskId: task.id })}
              >
                <View style={styles.taskBadgeRow}>
                  <View style={[styles.smallStatusBadge, { backgroundColor: getTaskStatusColor(task.status) }]}>
                    <Text style={styles.smallStatusText}>{getTaskStatusText(task.status)}</Text>
                  </View>
                </View>
                {task.location && (
                  <Text style={styles.taskLocation} numberOfLines={1}>{task.location}</Text>
                )}
                <Text style={styles.taskMiniTitle} numberOfLines={2}>{task.title}</Text>
                <View style={styles.taskDateRow}>
                  <View style={styles.taskDateItem}>
                    <Text style={styles.taskDateLabel}>Assigned date</Text>
                    <Text style={styles.taskDateValue}>{formatTaskAssignedDate(task.created_at)}</Text>
                  </View>
                </View>
                <View style={styles.taskDateRow}>
                  <View style={styles.taskDateItem}>
                    <Text style={styles.taskDateLabel}>Due date</Text>
                    <Text style={styles.taskDateValue}>{formatTaskDate(task.due_date)}</Text>
                  </View>
                </View>
                <View style={styles.taskFooterIcons}>
                  <View style={styles.iconStat}><Ionicons name="people-outline" size={16} color={colors.textSecondary} /><Text style={styles.iconStatText}>{(task.assigned_employees||[]).length || 0}</Text></View>
                  <View style={styles.iconStat}><Ionicons name="document-text-outline" size={16} color={colors.textSecondary} /><Text style={styles.iconStatText}>0</Text></View>
                </View>
              </TouchableOpacity>
            ))}
            {teamTasks.length === 0 && (
              <View style={[styles.miniCardEmpty, { width: layout?.taskCardWidth || 200 }]}> 
                <Text style={styles.emptyMiniText}>No tasks yet</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/*Productivity Section */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.dashboardSectionTitle}>Productivity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('TimeEntries')}>
              <Text style={styles.sectionAction}>All ›</Text>
            </TouchableOpacity>
          </View>
          <Card style={styles.productivityCard}>
            <View style={styles.productivityContent}>
              <View style={styles.productivityTextColumn}>
                <View style={styles.productivityInfoRow}>
                  <Text style={styles.productivityInfoLabel}>This week</Text>
                  <Text style={styles.productivityInfoValue}>{getWeekDateRange()}</Text>
                </View>
                <View style={styles.productivityInfoRow}>
                  <Text style={styles.productivityInfoLabel}>Time Worked</Text>
                  <View style={styles.hoursContainer}>
                    <Text style={styles.hoursNumber}>{getWeekTotalHours()}</Text>
                    <Text style={styles.hoursUnit}>hr / 5 d</Text>
                  </View>
                </View>
                <View style={styles.productivityInfoRow}>
                  <Text style={styles.productivityInfoLabel}>Task</Text>
                  <Text style={styles.productivityInfoValue}>{overview?.totalActiveProjects || allProjects.filter(p => p.status === 'Active').length}</Text>
                </View>
              </View>
              <View style={styles.productivityBars}>
                {(() => {
                  const today = new Date();
                  const sunday = new Date(today);
                  sunday.setDate(today.getDate() - today.getDay());
                  
                  const dayAbbreviations = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                  
                  const days = Array.from({ length: 7 }).map((_, i) => {
                    const d = new Date(sunday);
                    d.setDate(sunday.getDate() + i);
                    const dateKey = d.toISOString().split('T')[0];
                    const day = dayAbbreviations[d.getDay()];
                    const date = d.getDate().toString();
                    
                    const dayEntries = weekTimeEntries.filter(entry => {
                      const entryDate = new Date(entry.start_time || entry.created_at || '').toISOString().split('T')[0];
                      return entryDate === dateKey;
                    });
                    
                    let hours = dashboardHelpers.calculateTotalHours(dayEntries);
                    hours = Math.round(hours);
                    
                    return { day, date, hours, dateKey };
                  });
                  
                  const maxHours = Math.max(...days.map(d => d.hours), 1);
                  
                  return days.map((item, index) => {
                    const isWeekend = item.day === 'Sun' || item.day === 'Sat';
                    const displayHours = isWeekend ? 0 : item.hours;
                    const barHeightPercent = maxHours > 0 && displayHours > 0 ? (displayHours / maxHours) * 100 : 0;
                    const showFill = displayHours > 0;
                    const fillHeight = showFill ? (barHeightPercent / 100) * 100 : 4;
                    const fillColor = showFill ? '#877ED2' : '#E5E5EA';
                    
                    return (
                      <View key={index} style={styles.barContainer}>
                        <Text style={[styles.barCount, displayHours === 0 && styles.barCountZero]}>{displayHours}</Text>
                        <View style={styles.barWrapper}>
                          <View style={[styles.bar, { height: 100 }]} />
                          <View 
                            style={[
                              styles.barFill, 
                              { 
                                height: fillHeight,
                                backgroundColor: fillColor
                              }
                            ]} 
                          />
                        </View>
                        <View style={styles.barLabels}>
                          <Text style={styles.barDay}>{item.day}</Text>
                          <Text style={styles.barDate}>{item.date}</Text>
                        </View>
                      </View>
                    );
                  });
                })()}
              </View>
            </View>
          </Card>
        </View>

        {/* Quick Action Row */}
        <View style={styles.quickActionRow}>
          <TouchableOpacity style={styles.quickActionSecondary} onPress={() => navigation.navigate('CreateTask')}>
            <Text style={styles.quickActionSecondaryText}>Add Task</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  heroHeader: {
    backgroundColor: '#877ED2', 
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 38,
    height: 200,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerInner: {
    position: 'relative',
    flexDirection: 'column',
    width: '100%',
  },
  textBlock: {
    flexShrink: 1,
    paddingTop: 2,
  },
  heroGreeting: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: typography.families.bold,
  },
  heroSubGreeting: {
    fontSize: 20,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: typography.families.regular,
  },
  headerDateTop: {
    alignSelf: 'flex-end',
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
    marginTop: 8,
    marginBottom: 6,
    fontFamily: typography.families.medium,
  },
  headerRowBelowDate: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 2,
  },
  heroMeta: {
    fontSize: 10,
    color: '#E8E7ED',
    fontWeight: '400',
    fontFamily: typography.families.regular,
    textTransform: 'uppercase',
  },
  avatarCircleLeft: {
    width: 41,
    height: 41,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    marginTop: 6,
    marginBottom: 24,
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  // ============================================
  // ATTENDANCE CARD STYLES
  // ============================================
  attendanceWrapper: {
    marginTop: -55,
    paddingHorizontal: 18,
  },
  attendanceCard: {
    height: 69,
    width: 372,
    padding: spacing.lg + 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F0F0F5',
    shadowColor: '#877ED2',
    shadowOpacity: 0.15,
    shadowOffset: { width: 4, height: 4 },
    shadowRadius: 12,
    elevation: 8,
    justifyContent: 'center',
  },
  attendanceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  attendanceIconContainer: {
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: '#F3F2FF',
  },
  attendanceTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#404040',
    fontFamily: typography.families.medium,
  },
  attendanceTime: {
    fontSize: 12,
    fontWeight: '400',
    color: '#727272',
    fontFamily: typography.families.regular,
    marginTop: 4,
  },
  attendanceButton: {
    backgroundColor: '#877ED2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    width: 81,
    height: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendanceButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: typography.families.medium,
  },
  sectionBlock: {
    paddingTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  dashboardSectionTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#000000',
    fontFamily: typography.families.medium,
  },
  sectionAction: {
    fontSize: 16,
    color: '#8F8F8F',
    fontFamily: typography.families.regular,
    fontWeight: '400',
  },
  horizontalList: {
    paddingLeft: 20,
    paddingRight: 10,
    gap: 12,
    paddingBottom: 10,
    paddingTop: 10,
  },
  projectsHorizontalList: {
    paddingLeft: 20,
    paddingRight: 20,
    gap: 12,
    paddingBottom: 10,
    paddingTop: 10,
    justifyContent: 'center',
  },
  // ============================================
  // PROJECT CARD STYLES
  // ============================================
  miniCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    width: 332,
    height: 95,
    marginRight: 12,
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: '#E5E6EB',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  miniCardContent: {
    width: '100%',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  miniCardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#404040',
    marginBottom: 4,
    fontFamily: typography.families.medium,
    lineHeight: 22,
    textAlign: 'left',
  },
  miniCardMeta: {
    fontSize: 10,
    color: '#727272',
    fontWeight: '400',
    marginBottom: 6,
    fontFamily: typography.families.regular,
    textAlign: 'left',
  },
  miniCardDates: {
    fontSize: 10,
    color: '#727272',
    fontWeight: '400',
    fontFamily: typography.families.regular,
    lineHeight: 18,
    textAlign: 'left',
  },
  miniCardDateValue: {
    fontWeight: '500',
    fontFamily: typography.families.medium,
    fontSize: 12,
    color: '#404040',
  },
  miniCardEmpty: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#E8E8ED',
    borderStyle: 'dashed',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  emptyMiniText: {
    fontSize: 12,
    color: '#999',
  },
  // ============================================
  // TASK CARD STYLES
  // ============================================
  taskMiniCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg + 2,
    height: 250,
    borderWidth: 1,
    borderColor: '#F0F0F5',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 14,
    elevation: 6,
    marginRight: 12,
  },
  taskBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  smallStatusBadge: {
    backgroundColor: '#6FC264',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    marginRight: 6,
    marginTop: -19,
  },
  smallStatusText: {
    fontSize: 10,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: typography.families.regular,
    letterSpacing: 0.3,
  },
  taskMiniTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#404040',
    marginBottom: 12,
    fontFamily: typography.families.medium,
    lineHeight: 22,
    height: 44,
  },
  taskFooterIcons: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F5',
  },
  iconStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  iconStatText: {
    fontSize: 12,
    color: '#727272',
    fontWeight: '400',
    fontFamily: typography.families.regular,
  },
  taskMiniMeta: {
    fontSize: typography.fontSizes.base,
    color: '#6A6D73',
    marginBottom: 10,
    fontFamily: typography.families.regular,
  },
  taskLocation: {
    fontSize: 10,
    color: '#727272',
    marginBottom: 2,
    marginTop: 4,
    fontFamily: typography.families.regular, 
    fontWeight: '400',
  },
  taskDateRow: {
    marginBottom: 8,
  },
  taskDateItem: {
    flexDirection: 'column',
  },
  taskDateLabel: {
    fontSize: 10,
    color: '#727272',
    marginBottom: 3,
    fontFamily: typography.families.regular,
    // textTransform: 'uppercase',
    fontWeight: '400',
    // letterSpacing: 0.5,
  },
  taskDateValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#404040',
    fontFamily: typography.families.medium,
    letterSpacing: 0,
  },
  // ============================================
  // PRODUCTIVITY CARD STYLES
  // ============================================
  productivityCard: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E8E8ED',
    shadowColor: '#877ED2',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
    elevation: 7,
    marginBottom: 16,
  },
  productivityContent: {
    flexDirection: 'row',
    gap: 20,
  },
  productivityTextColumn: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  productivityInfoRow: {
    marginBottom: 18,
  },
  productivityInfoLabel: {
    fontSize: 10,
    color: '#727272',
    fontWeight: '400',
    fontFamily: typography.families.regular,
    letterSpacing: 0,
  },
  productivityInfoValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#404040',
    fontFamily: typography.families.bold,
  },
  hoursContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  hoursNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#404040',
    fontFamily: typography.families.bold,
    letterSpacing: -0.5,
  },
  hoursUnit: {
    fontSize: 10,
    color: '#727272',
    marginLeft: 4,
    fontFamily: typography.families.regular,
  },
  productivityBars: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 140,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 1,
  },
  barCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6F67CC',
    marginBottom: 4,
    textAlign: 'center',
  },
  barCountZero: {
    color: '#727272',
    height: 14,
    width: 14,
    backgroundColor: '#F4F4F4',
    borderRadius: 8,
  },
  barWrapper: {
    width: '80%',
    height: 100,
    justifyContent: 'flex-end',
    marginBottom: 8,
    position: 'relative',
    alignSelf: 'center',
    alignItems: 'center',
  },
  bar: {
    width: '40%',
    height: 100,
    borderRadius: 20,
    backgroundColor: '#E5E5EA',
    position: 'absolute',
    bottom: 0,
  },
  barFill: {
    width: '40%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    position: 'absolute',
    bottom: 0,
  },
  barLabels: {
    alignItems: 'center',
    marginTop: 4,
  },
  barDay: {
    fontSize: 12,
    fontWeight: '400',
    color: '#8E8E93',
    marginBottom: 2,
    textAlign: 'center',
  },
  barDate: {
    fontSize: 12,
    fontWeight: '400',
    color: '#8E8E93',
    textAlign: 'center',
  },
  quickActionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 24,
    gap: 12,
  },
  quickActionPrimary: {
    flex: 1,
    backgroundColor: colors.primaryPurple,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: typography.families.semibold,
  },
  quickActionSecondary: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionSecondaryText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: typography.families.semibold,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
});
