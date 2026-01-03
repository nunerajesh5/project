import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { translateStatus, translatePriority } from '../../utils/translations';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../api/client';
import Card from '../../components/shared/Card';
import AppHeader from '../../components/shared/AppHeader';
import SafeAreaWrapper from '../../components/shared/SafeAreaWrapper';
import TaskBulkActions from '../../components/manager/TaskBulkActions';
import TaskFilterModal from '../../components/manager/TaskFilterModal';

type TaskStatus = 'To Do' | 'Active' | 'Completed' | 'Cancelled' | 'On Hold';

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  project_id: string;
  project_name: string;
  assigned_to: string;
  first_name: string;
  last_name: string;
  employee_email: string;
  due_date: string;
  created_at: string;
  updated_at: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
}

interface TaskFilter {
  status: string[];
  priority: string[];
  assignee: string[];
  project: string[];
  dueDate: string;
  createdDate: string;
}

export default function AllTasksScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useContext(AuthContext);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Enhanced task management state
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [currentFilter, setCurrentFilter] = useState<TaskFilter>({
    status: [],
    priority: [],
    assignee: [],
    project: [],
    dueDate: '',
    createdDate: ''
  });
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');


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


  const loadData = async () => {
    try {
      setLoading(true);
      console.log('Loading all tasks from API...');
      const response = await api.get('/api/tasks', { 
        params: { 
          page: 1, 
          limit: 100 
        } 
      });
      
      console.log('Tasks API response:', response.data);
      const tasksData = response.data.tasks || [];
      
      // Add mock priority and description data
      const enhancedTasks = tasksData.map((task: Task) => ({
        ...task,
        priority: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as 'low' | 'medium' | 'high' | 'critical',
        description: `Detailed description for ${task.title.toLowerCase()}`
      }));
      
      setTasks(enhancedTasks);
      setFilteredTasks(enhancedTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
      setFilteredTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = (filter: TaskFilter) => {
    let filtered = [...tasks];

    // Filter by status
    if (filter.status.length > 0) {
      filtered = filtered.filter(task => filter.status.includes(task.status));
    }

    // Filter by priority
    if (filter.priority.length > 0) {
      filtered = filtered.filter(task => task.priority && filter.priority.includes(task.priority));
    }

    // Filter by assignee
    if (filter.assignee.length > 0) {
      filtered = filtered.filter(task => 
        filter.assignee.some(assignee => 
          `${task.first_name} ${task.last_name}`.toLowerCase().includes(assignee.toLowerCase())
        )
      );
    }

    // Filter by project
    if (filter.project.length > 0) {
      filtered = filtered.filter(task => filter.project.includes(task.project_name));
    }

    // Filter by due date
    if (filter.dueDate) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(task => {
        const dueDate = new Date(task.due_date);
        
        switch (filter.dueDate) {
          case 'today':
            return dueDate.toDateString() === today.toDateString();
          case 'tomorrow':
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return dueDate.toDateString() === tomorrow.toDateString();
          case 'this_week':
            const weekStart = new Date(today);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            return dueDate >= weekStart && dueDate <= weekEnd;
          case 'overdue':
            return dueDate < today;
          default:
            return true;
        }
      });
    }

    setFilteredTasks(filtered);
    setCurrentFilter(filter);
  };

  const handleBulkAction = async (action: string, taskIds: string[]) => {
    try {
      switch (action) {
        case 'complete':
          setTasks(prev => 
            prev.map(task => 
              taskIds.includes(task.id) 
                ? { ...task, status: 'Completed' as TaskStatus }
                : task
            )
          );
          Alert.alert('Success', `${taskIds.length} tasks marked as completed`);
          break;
        case 'assign':
          Alert.alert('Assign Tasks', 'Task assignment feature coming soon!');
          break;
        case 'priority':
          Alert.alert('Set Priority', 'Priority setting feature coming soon!');
          break;
        case 'move':
          Alert.alert('Move Tasks', 'Task moving feature coming soon!');
          break;
        case 'delete':
          Alert.alert(
            'Delete Tasks',
            `Are you sure you want to delete ${taskIds.length} tasks?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  setTasks(prev => prev.filter(task => !taskIds.includes(task.id)));
                  setSelectedTasks([]);
                  Alert.alert('Success', `${taskIds.length} tasks deleted`);
                }
              }
            ]
          );
          break;
      }
    } catch (error) {
      Alert.alert('Error', `Failed to ${action} tasks`);
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const getAvailableAssignees = () => {
    const assignees = new Set<string>();
    tasks.forEach(task => {
      if (task.first_name && task.last_name) {
        assignees.add(`${task.first_name} ${task.last_name}`);
      }
    });
    return Array.from(assignees);
  };

  const getAvailableProjects = () => {
    const projects = new Set<string>();
    tasks.forEach(task => {
      if (task.project_name) {
        projects.add(task.project_name);
      }
    });
    return Array.from(projects);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  // Group filtered tasks by project for display
  const tasksByProject = filteredTasks.reduce((acc: Record<string, { name: string; items: Task[] }>, t) => {
    if (!acc[t.project_id]) acc[t.project_id] = { name: t.project_name, items: [] };
    acc[t.project_id].items.push(t);
    return acc;
  }, {});

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'critical': return '#FF3B30';
      case 'high': return '#FF9500';
      case 'medium': return '#FFCC00';
      case 'low': return '#34C759';
      default: return '#8E8E93';
    }
  };

  return (
    <SafeAreaWrapper>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <AppHeader />
      
      <View style={styles.screenContent}>
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.title}>{t('tasks.all_tasks')}</Text>
              <Text style={styles.subtitle}>
                {filteredTasks.length} of {tasks.length} {t('tasks.tasks')} across {Object.keys(tasksByProject).length} {t('projects.projects')}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setShowFilterModal(true)}
              >
                <Text style={styles.actionButtonText}>🔍 {t('common.filter')}</Text>
              </TouchableOpacity>
              {selectedTasks.length > 0 && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.bulkActionButton]}
                  onPress={() => setShowBulkActions(true)}
                >
                  <Text style={styles.actionButtonText}>⚙️ Bulk ({selectedTasks.length})</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {filteredTasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>
            {tasks.length === 0 ? t('tasks.no_tasks') : t('tasks.no_tasks')}
          </Text>
          <Text style={styles.emptySubtitle}>
            {tasks.length === 0 
              ? t('common.refresh') 
              : t('common.filter')
            }
          </Text>
        </View>
      ) : (
        Object.entries(tasksByProject).map(([pid, group]) => (
          <View key={pid} style={{ marginBottom: 12 }}>
            <View style={styles.projectHeaderRow}>
              <Text style={styles.projectTitle}>{group.name}</Text>
              <Text style={styles.projectCount}>{group.items.length} task{group.items.length !== 1 ? 's' : ''}</Text>
            </View>
            {group.items.map((task) => (
              <TouchableOpacity
                key={task.id}
                onPress={() => toggleTaskSelection(task.id)}
                onLongPress={() => toggleTaskSelection(task.id)}
              >
                <Card style={
                  selectedTasks.includes(task.id) 
                    ? [styles.taskCard, styles.selectedTaskCard]
                    : styles.taskCard
                }>
                  <View style={styles.taskHeader}>
                    <View style={styles.taskTitleContainer}>
                      <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
                      {selectedTasks.includes(task.id) && (
                        <Text style={styles.selectionIndicator}>✓</Text>
                      )}
                    </View>
                    <View style={styles.badgesContainer}>
                      {task.priority && (
                        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) }]}>
                          <Text style={styles.priorityText}>{translatePriority(task.priority, t).toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) }]}>
                        <Text style={styles.statusText}>{translateStatus(task.status, t).toUpperCase()}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.taskMeta}>
                    <View style={styles.taskMetaItem}>
                      <Text style={styles.metaLabel}>Assigned to:</Text>
                      <Text style={styles.metaValue}>{task.first_name} {task.last_name}</Text>
                    </View>
                    <View style={styles.taskMetaItem}>
                      <Text style={styles.metaLabel}>Due:</Text>
                      <Text style={styles.metaValue}>{new Date(task.due_date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}</Text>
                    </View>
                    <View style={styles.taskMetaItem}>
                      <Text style={styles.metaLabel}>Email:</Text>
                      <Text style={styles.metaValue}>{task.employee_email}</Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        ))
      )}
      </View>
      </ScrollView>

      {/* Bulk Actions Modal */}
      <TaskBulkActions
        selectedTasks={selectedTasks}
        onBulkAction={handleBulkAction}
        onClearSelection={() => setSelectedTasks([])}
        visible={showBulkActions}
        onClose={() => setShowBulkActions(false)}
      />

      {/* Filter Modal */}
      <TaskFilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApplyFilter={applyFilter}
        currentFilter={currentFilter}
        availableAssignees={getAvailableAssignees()}
        availableProjects={getAvailableProjects()}
      />
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  screenContent: { flex: 1 },
  titleSection: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#8E8E93' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F2F7' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#8E8E93' },
  emptyState: { alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#1C1C1E', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#8E8E93' },
  taskCard: { marginHorizontal: 20, marginVertical: 8, padding: 16 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  taskTitle: { fontSize: 16, fontWeight: '600', color: '#1C1C1E', flex: 1, marginRight: 12 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  priorityText: { fontSize: 12, fontWeight: 'bold', color: '#FFFFFF' },
  taskDescription: { fontSize: 14, color: '#8E8E93', marginBottom: 12, lineHeight: 20 },
  taskMeta: { gap: 8 },
  taskMetaItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaLabel: { fontSize: 12, color: '#8E8E93', fontWeight: '500' },
  metaValue: { fontSize: 12, color: '#1C1C1E', fontWeight: '600' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: 'bold', color: '#FFFFFF' },
  projectHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingHorizontal: 20 },
  projectTitle: { fontSize: 18, fontWeight: '600', color: '#1C1C1E' },
  projectCount: { fontSize: 14, color: '#8E8E93' },
  
  // Enhanced Task Management Styles
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
  },
  bulkActionButton: {
    backgroundColor: '#007AFF',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  selectedTaskCard: {
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#F8F9FF',
  },
  taskTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  selectionIndicator: {
    fontSize: 16,
    color: '#007AFF',
    marginLeft: 8,
    fontWeight: 'bold',
  },
  badgesContainer: {
    flexDirection: 'row',
    gap: 4,
  },
});


