import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import { dashboardApi, Employee } from '../../api/dashboard';
import Card from '../../components/shared/Card';
import Button from '../../components/shared/Button';
import { formatCurrencyINR } from '../../utils/currency';

type TaskStatus = 'To Do' | 'Active' | 'Completed' | 'Cancelled' | 'On Hold';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'To Do' | 'Active' | 'Completed' | 'Cancelled' | 'On Hold';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dueDate: Date;
  assignedTo: string;
  assignedToName: string;
  projectId: string;
  projectName: string;
  completedAt?: Date;
  created_at: string;
  updated_at: string;
}

interface GroupedTasks {
  [key: string]: {
    groupName: string;
    groupValue: string;
    tasks: Task[];
    count: number;
  };
}

type GroupByField = 'department' | 'salary_type' | 'priority' | 'project' | 'employee';

export default function OverdueTasksScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { mode } = route.params || {};
  const { user } = useContext(AuthContext);
  
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [groupedTasks, setGroupedTasks] = useState<GroupedTasks>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByField>('employee');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'employee'>('dueDate');
  const [showGroupByModal, setShowGroupByModal] = useState(false);
  const [showSortByModal, setShowSortByModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  console.log('OverdueTasksScreen loaded, user role:', user?.role);

  const loadData = async () => {
    try {
      console.log('Loading overdue tasks data...');
      setLoading(true);
      
      // Load employees
      console.log('Fetching employees...');
      const employeesData = await dashboardApi.getEmployees({ limit: 100 });
      console.log('Employees data:', employeesData);
      setEmployees(employeesData.employees || []);
      
      // Generate mock overdue tasks data
      console.log('Generating mock overdue tasks...');
      const mockOverdueTasks = generateMockOverdueTasks(employeesData.employees || [])
        .map(t => ({
          ...t,
          status: (Math.random() < 0.33 ? 'Completed' : (Math.random() < 0.66 ? 'Active' : 'On Hold')) as TaskStatus,
        }));
      console.log('Generated tasks:', mockOverdueTasks.length);
      setOverdueTasks(mockOverdueTasks);
      
    } catch (error) {
      console.error('Error loading overdue tasks:', error);
      // Fallback to empty data instead of showing alert
      setEmployees([]);
      setOverdueTasks([]);
    } finally {
      setLoading(false);
    }
  };

  const generateMockOverdueTasks = (employees: Employee[]): Task[] => {
    const tasks: Task[] = [];
    const projects = [
      { id: '1', name: 'E-commerce Platform' },
      { id: '2', name: 'Mobile App Development' },
      { id: '3', name: 'Data Analytics Dashboard' },
      { id: '4', name: 'API Integration' },
      { id: '5', name: 'UI/UX Redesign' },
    ];

    const taskTemplates = [
      { title: 'Fix critical bug in payment gateway', priority: 'critical' as const },
      { title: 'Complete user authentication module', priority: 'high' as const },
      { title: 'Update API documentation', priority: 'medium' as const },
      { title: 'Write unit tests for core functions', priority: 'high' as const },
      { title: 'Optimize database queries', priority: 'medium' as const },
      { title: 'Implement responsive design', priority: 'high' as const },
      { title: 'Code review for pull requests', priority: 'medium' as const },
      { title: 'Deploy to staging environment', priority: 'critical' as const },
      { title: 'Update project documentation', priority: 'low' as const },
      { title: 'Fix security vulnerabilities', priority: 'critical' as const },
    ];

    employees.forEach((employee, empIndex) => {
      const numTasks = Math.floor(Math.random() * 4) + 1; // 1-4 tasks per employee
      
      for (let i = 0; i < numTasks; i++) {
        const template = taskTemplates[Math.floor(Math.random() * taskTemplates.length)];
        const project = projects[Math.floor(Math.random() * projects.length)];
        const daysOverdue = Math.floor(Math.random() * 10) + 1; // 1-10 days overdue
        
        tasks.push({
          id: `task-${empIndex}-${i}-${Date.now()}`,
          title: template.title,
          description: `Detailed description for ${template.title.toLowerCase()}`,
          status: 'Active',
          priority: template.priority,
          dueDate: new Date(Date.now() - daysOverdue * 24 * 60 * 60 * 1000),
          assignedTo: employee.id,
          assignedToName: `${employee.first_name} ${employee.last_name}`,
          projectId: project.id,
          projectName: project.name,
          created_at: new Date(Date.now() - (daysOverdue + 5) * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - daysOverdue * 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    });

    return tasks.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  };

  const groupTasks = (tasks: Task[], groupByField: GroupByField) => {
    const grouped: GroupedTasks = {};
    
    tasks.forEach(task => {
      let groupKey = '';
      let groupName = '';
      let groupValue = '';
      
      const employee = employees.find(emp => emp.id === task.assignedTo);
      
      switch (groupByField) {
        case 'department':
          groupKey = employee?.department || 'No Department';
          groupName = 'Department';
          groupValue = groupKey;
          break;
        case 'salary_type':
          groupKey = employee?.salary_type || 'Unknown';
          groupName = 'Salary Type';
          groupValue = groupKey;
          break;
        case 'priority':
          groupKey = task.priority;
          groupName = 'Priority';
          groupValue = groupKey;
          break;
        case 'project':
          groupKey = task.projectId;
          groupName = 'Project';
          groupValue = task.projectName;
          break;
        case 'employee':
        default:
          groupKey = task.assignedTo;
          groupName = 'Employee';
          groupValue = task.assignedToName;
          break;
      }
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          groupName,
          groupValue,
          tasks: [],
          count: 0,
        };
      }
      
      grouped[groupKey].tasks.push(task);
      grouped[groupKey].count++;
    });
    
    return grouped;
  };

  const sortTasks = (tasks: Task[], sortField: 'dueDate' | 'priority' | 'employee') => {
    return [...tasks].sort((a, b) => {
      switch (sortField) {
        case 'dueDate':
          return a.dueDate.getTime() - b.dueDate.getTime();
        case 'priority':
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        case 'employee':
          return a.assignedToName.localeCompare(b.assignedToName);
        default:
          return 0;
      }
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (overdueTasks.length > 0) {
      const grouped = groupTasks(overdueTasks, groupBy);
      
      // Sort tasks within each group
      Object.keys(grouped).forEach(key => {
        grouped[key].tasks = sortTasks(grouped[key].tasks, sortBy);
      });
      
      setGroupedTasks(grouped);
    }
  }, [overdueTasks, groupBy, sortBy]); // Removed employees dependency to prevent unnecessary re-renders

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleTaskPress = (task: Task) => {
    setSelectedTask(task);
    setShowTaskModal(true);
  };

  const handleMarkComplete = async (taskId: string) => {
    try {
      // In a real app, this would call an API
      setOverdueTasks(prev => 
        prev.map(task => 
          task.id === taskId 
            ? { ...task, status: 'Completed' as const, completedAt: new Date() }
            : task
        )
      );
      setShowTaskModal(false);
      Alert.alert('Success', 'Task marked as completed!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update task status.');
    }
  };

  const handleReassignTask = (taskId: string) => {
    // In a real app, this would open a reassignment modal
    Alert.alert('Reassign Task', 'Task reassignment feature coming soon!');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#FF3B30';
      case 'high': return '#FF9500';
      case 'medium': return '#FFCC00';
      case 'low': return '#34C759';
      default: return '#8E8E93';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return '#34C759';
      case 'Active': return '#877ED2';
      case 'Cancelled': return '#FF3B30';
      case 'On Hold': return '#FF9500';
      case 'To Do': return '#8E8E93';
      default: return '#8E8E93';
    }
  };

  const getDaysOverdue = (dueDate: Date) => {
    const now = new Date();
    const diffTime = now.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderTaskCard = (task: Task) => (
    <TouchableOpacity key={task.id} onPress={() => handleTaskPress(task)}>
      <Card style={styles.taskCard}>
        <View style={styles.taskHeader}>
          <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) }]}>
            <Text style={styles.priorityText}>{task.priority.toUpperCase()}</Text>
          </View>
        </View>
        
        <Text style={styles.taskDescription} numberOfLines={2}>{task.description}</Text>
        
        <View style={styles.taskMeta}>
          <View style={styles.taskMetaItem}>
            <Text style={styles.metaLabel}>Assigned to:</Text>
            <Text style={styles.metaValue}>{task.assignedToName}</Text>
          </View>
          <View style={styles.taskMetaItem}>
            <Text style={styles.metaLabel}>Project:</Text>
            <Text style={styles.metaValue}>{task.projectName}</Text>
          </View>
          <View style={styles.taskMetaItem}>
            <Text style={styles.metaLabel}>Status:</Text>
            <View style={[styles.priorityBadge, { backgroundColor: getStatusColor(task.status) }]}>
              <Text style={styles.priorityText}>{task.status.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.taskMetaItem}>
            <Text style={styles.metaLabel}>Due:</Text>
            <Text style={[styles.metaValue, styles.overdueText]}>
              {formatDate(task.dueDate)} ({getDaysOverdue(task.dueDate)} days overdue)
            </Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderGroup = (groupKey: string, groupData: GroupedTasks[string]) => (
    <View key={groupKey} style={styles.groupContainer}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>{groupData.groupValue}</Text>
        <Text style={styles.groupCount}>{groupData.count} overdue task{groupData.count !== 1 ? 's' : ''}</Text>
      </View>
      {groupData.tasks.map(renderTaskCard)}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading overdue tasks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Overdue Tasks</Text>
        <Text style={styles.subtitle}>
          {overdueTasks.length} overdue task{overdueTasks.length !== 1 ? 's' : ''} across {Object.keys(groupedTasks).length} {groupBy === 'employee' ? 'employees' : groupBy + 's'}
        </Text>
      </View>

      <View style={styles.filters}>
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowGroupByModal(true)}
        >
          <Text style={styles.filterButtonText}>Group by: {groupBy.replace('_', ' ')}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.filterButton}
          onPress={() => setShowSortByModal(true)}
        >
          <Text style={styles.filterButtonText}>Sort by: {sortBy.replace('_', ' ')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {Object.keys(groupedTasks).length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>🎉 No Overdue Tasks!</Text>
            <Text style={styles.emptySubtitle}>All tasks are up to date.</Text>
          </View>
        ) : (
          Object.entries(groupedTasks).map(([key, groupData]) => renderGroup(key, groupData))
        )}
      </ScrollView>

      {/* Group By Modal */}
      <Modal visible={showGroupByModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Group By</Text>
            {(['employee', 'department', 'salary_type', 'priority', 'project'] as GroupByField[]).map(field => (
              <TouchableOpacity
                key={field}
                style={[styles.modalOption, groupBy === field && styles.modalOptionSelected]}
                onPress={() => {
                  setGroupBy(field);
                  setShowGroupByModal(false);
                }}
              >
                <Text style={[styles.modalOptionText, groupBy === field && styles.modalOptionTextSelected]}>
                  {field.replace('_', ' ').toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowGroupByModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sort By Modal */}
      <Modal visible={showSortByModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sort By</Text>
            {(['dueDate', 'priority', 'employee'] as const).map(field => (
              <TouchableOpacity
                key={field}
                style={[styles.modalOption, sortBy === field && styles.modalOptionSelected]}
                onPress={() => {
                  setSortBy(field);
                  setShowSortByModal(false);
                }}
              >
                <Text style={[styles.modalOptionText, sortBy === field && styles.modalOptionTextSelected]}>
                  {field.replace('_', ' ').toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowSortByModal(false)}
            >
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Task Detail Modal */}
      <Modal visible={showTaskModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.taskModalContent}>
            {selectedTask && (
              <>
                <View style={styles.taskModalHeader}>
                  <Text style={styles.taskModalTitle}>{selectedTask.title}</Text>
                  <TouchableOpacity onPress={() => setShowTaskModal(false)}>
                    <Text style={styles.closeButton}>✕</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.taskModalDescription}>{selectedTask.description}</Text>
                
                <View style={styles.taskModalMeta}>
                  <View style={styles.taskModalMetaItem}>
                    <Text style={styles.taskModalMetaLabel}>Priority:</Text>
                    <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(selectedTask.priority) }]}>
                      <Text style={styles.priorityText}>{selectedTask.priority.toUpperCase()}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.taskModalMetaItem}>
                    <Text style={styles.taskModalMetaLabel}>Assigned to:</Text>
                    <Text style={styles.taskModalMetaValue}>{selectedTask.assignedToName}</Text>
                  </View>
                  
                  <View style={styles.taskModalMetaItem}>
                    <Text style={styles.taskModalMetaLabel}>Project:</Text>
                    <Text style={styles.taskModalMetaValue}>{selectedTask.projectName}</Text>
                  </View>
                  
                  <View style={styles.taskModalMetaItem}>
                    <Text style={styles.taskModalMetaLabel}>Due Date:</Text>
                    <Text style={[styles.taskModalMetaValue, styles.overdueText]}>
                      {formatDate(selectedTask.dueDate)} ({getDaysOverdue(selectedTask.dueDate)} days overdue)
                    </Text>
                  </View>
                </View>
                
                <View style={styles.taskModalActions}>
                  <Button
                    title="Mark Complete"
                    onPress={() => handleMarkComplete(selectedTask.id)}
                  />
                  <Button
                    title="Reassign"
                    onPress={() => handleReassignTask(selectedTask.id)}
                    variant="secondary"
                  />
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  filters: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  filterButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    alignItems: 'center',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  groupContainer: {
    marginBottom: 24,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  groupCount: {
    fontSize: 14,
    color: '#8E8E93',
  },
  taskCard: {
    marginHorizontal: 20,
    marginVertical: 8,
    padding: 16,
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    flex: 1,
    marginRight: 12,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  taskDescription: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 12,
    lineHeight: 20,
  },
  taskMeta: {
    gap: 8,
  },
  taskMetaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 12,
    color: '#1C1C1E',
    fontWeight: '600',
  },
  overdueText: {
    color: '#FF3B30',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 8,
  },
  modalOptionSelected: {
    backgroundColor: '#007AFF',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#1C1C1E',
    textAlign: 'center',
  },
  modalOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  modalCloseButton: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  taskModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  taskModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  taskModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    fontSize: 20,
    color: '#8E8E93',
    fontWeight: 'bold',
  },
  taskModalDescription: {
    fontSize: 16,
    color: '#8E8E93',
    lineHeight: 24,
    marginBottom: 20,
  },
  taskModalMeta: {
    marginBottom: 24,
  },
  taskModalMetaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  taskModalMetaLabel: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '500',
  },
  taskModalMetaValue: {
    fontSize: 14,
    color: '#1C1C1E',
    fontWeight: '600',
  },
  taskModalActions: {
    gap: 12,
  },
  actionButton: {
    marginBottom: 8,
  },
  secondaryButton: {
    backgroundColor: '#F2F2F7',
  },
});
