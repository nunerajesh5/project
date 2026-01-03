import React, { useEffect, useState, useContext, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, RefreshControl, Modal, FlatList, TextInput, Image } from 'react-native';
import { useRoute, useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import { MOCK_DATA } from '../../data/mockData';
import Card from '../../components/shared/Card';
import { formatCurrencyINR } from '../../utils/currency';

export default function EmployeeProjectDetailsScreen() {
  const route = useRoute<any>();
  const { id } = route.params || {};
  const { user } = useContext(AuthContext);
  
  const [project, setProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [projectMetrics, setProjectMetrics] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [employeeHours, setEmployeeHours] = useState<any>(null);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [projectTasks, setProjectTasks] = useState<any[]>([]);
  const [tasksFilter, setTasksFilter] = useState<'overdue' | 'completed'>('completed');
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [timerElapsedSec, setTimerElapsedSec] = useState<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartRef = useRef<number | null>(null);
  const [workDescription, setWorkDescription] = useState<string>('');
  const [attachments, setAttachments] = useState<any[]>([]);

  // Optional pickers to avoid hard dependency
  const getDocumentPicker = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('expo-document-picker');
    } catch {
      return null;
    }
  };
  const getImagePicker = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('expo-image-picker');
    } catch {
      return null;
    }
  };

  const handlePickDocument = async () => {
    const DocumentPicker = getDocumentPicker();
    if (!DocumentPicker) return;
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: true, type: '*/*' });
    if ((res as any).canceled) return;
    const files = (res as any).assets || (res as any).output || ((res as any).type ? [res] : []);
    if (files && files.length) {
      setAttachments(prev => [
        ...prev,
        ...files.map((f: any) => ({ uri: f.uri, name: f.name || 'file', size: f.size || 0, mimeType: f.mimeType || f.type || 'application/octet-stream' }))
      ]);
    }
  };

  const handlePickImage = async () => {
    const ImagePicker = getImagePicker();
    if (!ImagePicker) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (res.canceled) return;
    const files = res.assets || [];
    if (files.length) {
      setAttachments(prev => [
        ...prev,
        ...files.map((f: any) => ({ uri: f.uri, name: f.fileName || 'image.jpg', size: f.fileSize || 0, mimeType: f.type || 'image/jpeg' }))
      ]);
    }
  };

  const removeAttachment = (uri: string) => {
    setAttachments(prev => prev.filter(a => a.uri !== uri));
  };

  const startTimer = () => {
    if (isTimerRunning) return;
    timerStartRef.current = Date.now() - timerElapsedSec * 1000;
    setIsTimerRunning(true);
    timerIntervalRef.current = setInterval(() => {
      if (timerStartRef.current) {
        const elapsedMs = Date.now() - timerStartRef.current;
        setTimerElapsedSec(Math.floor(elapsedMs / 1000));
      }
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setIsTimerRunning(false);
    // Log tracked time on stop
    if (timerElapsedSec > 0 && selectedTask) {
      const h = Math.floor(timerElapsedSec / 3600);
      const m = Math.floor((timerElapsedSec % 3600) / 60);
      const s = timerElapsedSec % 60;
      const parts = [
        h > 0 ? `${h}h` : null,
        m > 0 ? `${m}m` : null,
        s > 0 ? `${s}s` : null,
      ].filter(Boolean).join(' ');
      setRecentActivity(prev => [
        {
          id: Date.now(),
          type: 'hours_logged',
          user: user?.name || 'You',
          action: 'tracked',
          target: `${parts} on "${selectedTask.title}"`,
          taskId: selectedTask.id,
          timestamp: new Date(),
          icon: '⏱'
        },
        ...prev
      ]);
      // auto reset after log
      setTimerElapsedSec(0);
      timerStartRef.current = null;
    }
  };

  const resetTimer = () => {
    stopTimer();
    setTimerElapsedSec(0);
    timerStartRef.current = null;
  };

  const formatHMS = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  };

  // Cleanup timer on modal/task change
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!showTasksModal || !selectedTask) {
      // stop timer when leaving details
      resetTimer();
    }
  }, [showTasksModal, selectedTask]);

  const TASK_STATUSES = [
    { key: 'To Do', label: 'TO DO' },
    { key: 'Active', label: 'ACTIVE' },
    { key: 'Completed', label: 'COMPLETED' },
    { key: 'Cancelled', label: 'CANCELLED' },
    { key: 'On Hold', label: 'ON HOLD' },
  ];

  const loadData = async () => {
    try {
      if (!id) {
        console.log('No project ID provided');
        return;
      }

      // Find project in mock data
      const mockProject = MOCK_DATA.clients
        .flatMap(client => client.projects)
        .find(p => p.id === id);
      
      if (!mockProject) {
        console.log('Project not found with id:', id);
        return;
      }

      const client = MOCK_DATA.clients.find(c => 
        c.projects.some(p => p.id === id)
      );

      // Generate project data (no budget information for employees)
      const projectData = {
        ...mockProject,
        client_name: client?.name || 'Unknown Client',
        due_date: new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000),
        start_date: mockProject.startDate ? new Date(mockProject.startDate) : new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        allocated_hours: Math.floor(Math.random() * 500) + 200,
        description: "A comprehensive project involving multiple phases of development, testing, and deployment."
      };

      setProject(projectData);

      // Generate employee-specific metrics (no budget data)
      const progress = Math.floor(Math.random() * 40) + 30;
      const overdueTasks = Math.floor(Math.random() * 5);
      const totalTasks = Math.floor(Math.random() * 20) + 10;
      
      const metrics = {
        progress: progress,
        hoursLogged: Math.floor(Math.random() * 200) + 50,
        hoursTotal: projectData.allocated_hours,
        overdueTasks: overdueTasks,
        totalTasks: totalTasks,
        completedTasks: Math.floor(progress / 100 * totalTasks),
        inProgressTasks: Math.floor(Math.random() * 5) + 2,
        todoTasks: Math.floor(Math.random() * 8) + 3,
        myTasks: Math.floor(Math.random() * 5) + 1, // Employee's assigned tasks
        myCompletedTasks: Math.floor(Math.random() * 3) + 1, // Employee's completed tasks
        myHoursThisWeek: Math.floor(Math.random() * 40) + 10, // Employee's hours this week
        myTotalHours: Math.floor(Math.random() * 100) + 20 // Employee's total hours on project
      };
      
      setProjectMetrics(metrics);

      // Generate team members (basic info only, no salaries)
      const assignedEmployeeIds = mockProject.assignedEmployees || [];
      const teamMembersData = assignedEmployeeIds.map(empId => {
        const employee = MOCK_DATA.users.find(u => u.id === empId);
        return {
          id: empId,
          name: employee?.name || 'Unknown Employee',
          role: employee?.role || 'employee',
          jobTitle: employee?.jobTitle || 'Developer',
          tasksAssigned: Math.floor(Math.random() * 5) + 1,
          hoursThisWeek: Math.floor(Math.random() * 40) + 10,
          totalHoursLogged: Math.floor(Math.random() * 100) + 20,
          isCurrentUser: empId === user?.id
        };
      });

      setTeamMembers(teamMembersData);

      // Generate employee's specific hours data
      const employeeHoursData = {
        thisWeek: metrics.myHoursThisWeek,
        totalHours: metrics.myTotalHours,
        dailyHours: [
          { day: 'Mon', hours: Math.floor(Math.random() * 8) + 1 },
          { day: 'Tue', hours: Math.floor(Math.random() * 8) + 1 },
          { day: 'Wed', hours: Math.floor(Math.random() * 8) + 1 },
          { day: 'Thu', hours: Math.floor(Math.random() * 8) + 1 },
          { day: 'Fri', hours: Math.floor(Math.random() * 8) + 1 },
          { day: 'Sat', hours: Math.floor(Math.random() * 4) },
          { day: 'Sun', hours: 0 }
        ],
        weeklyTarget: 40,
        efficiency: Math.floor(Math.random() * 20) + 80 // 80-100% efficiency
      };

      setEmployeeHours(employeeHoursData);

      // Generate recent activity (employee-focused)
      const activities = [
        {
          id: 1,
          type: 'task_completed',
          user: user?.name || 'You',
          action: 'completed task',
          target: 'Setup user authentication',
          timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
          icon: '✅'
        },
        {
          id: 2,
          type: 'hours_logged',
          user: user?.name || 'You',
          action: 'logged',
          target: '8 hours today',
          timestamp: new Date(Date.now() - Math.random() * 48 * 60 * 60 * 1000),
          icon: '⏰'
        },
        {
          id: 3,
          type: 'comment_added',
          user: user?.name || 'You',
          action: 'added a comment to task',
          target: 'Fix responsive design',
          timestamp: new Date(Date.now() - Math.random() * 72 * 60 * 60 * 1000),
          icon: '💬'
        }
      ];

      setRecentActivity(activities);

      // Generate project tasks
      const tasks = [
        {
          id: '1',
          title: 'Setup user authentication system',
          description: 'Implement login, registration, and password reset functionality',
          status: 'completed',
          priority: 'high',
          dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          assignedTo: user?.id || 'current-user',
          completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
        {
          id: '2',
          title: 'Design responsive UI components',
          description: 'Create mobile-first responsive design for all screens',
          status: 'Active',
          priority: 'high',
          dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago (overdue)
          assignedTo: user?.id || 'current-user',
        },
        {
          id: '3',
          title: 'Implement database schema',
          description: 'Set up PostgreSQL database with proper relationships',
          status: 'To Do',
          priority: 'medium',
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
          assignedTo: user?.id || 'current-user',
        },
        {
          id: '4',
          title: 'Write unit tests',
          description: 'Create comprehensive test suite for all modules',
          status: 'To Do',
          priority: 'medium',
          dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago (overdue)
          assignedTo: user?.id || 'current-user',
        },
        {
          id: '5',
          title: 'API documentation',
          description: 'Document all API endpoints and usage examples',
          status: 'To Do',
          priority: 'low',
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
          assignedTo: user?.id || 'current-user',
        },
        {
          id: '6',
          title: 'Performance optimization',
          description: 'Optimize database queries and frontend rendering',
          status: 'On Hold',
          priority: 'low',
          dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (overdue)
          assignedTo: user?.id || 'current-user',
        }
      ];

      setProjectTasks(tasks);

    } catch (error) {
      console.error('Error loading project data:', error);
    }
  };

  useEffect(() => {
    if (id) {
      loadData().finally(() => setLoading(false));
    }
  }, [id, user]);

  // Reload every time screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      if (id) {
        setLoading(true);
        loadData().finally(() => {
          if (isActive) setLoading(false);
        });
      }
      return () => {
        isActive = false;
      };
    }, [id, user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#34C759';
      case 'completed': return '#007AFF';
      case 'on_hold': return '#FF9500';
      case 'cancelled': return '#FF3B30';
      default: return '#666';
    }
  };

  const getProjectStatus = (project: any) => {
    if (!project.due_date) return { status: 'On Track', color: '#34d399', bgColor: '#dcfce7' };
    
    const now = new Date();
    const dueDate = new Date(project.due_date);
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue < 0) return { status: 'Overdue', color: '#ef4444', bgColor: '#fef2f2' };
    if (daysUntilDue < 7) return { status: 'At Risk', color: '#f59e0b', bgColor: '#fef3c7' };
    return { status: 'On Track', color: '#34d399', bgColor: '#dcfce7' };
  };

  const getDaysUntilDue = (project: any) => {
    if (!project.due_date) return null;
    const now = new Date();
    const dueDate = new Date(project.due_date);
    return Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const formatRelativeTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return '#34C759';
      case 'Active': return '#877ED2';
      case 'To Do': return '#8E8E93';
      case 'Cancelled': return '#FF3B30';
      case 'On Hold': return '#FF9500';
      default: return '#8E8E93';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#FF3B30';
      case 'medium': return '#FF9500';
      case 'low': return '#34C759';
      default: return '#8E8E93';
    }
  };

  const isOverdue = (dueDate: Date, status?: string) => {
    return (status !== 'Completed') && (dueDate < new Date());
  };

  const getOverdueTasks = () => {
    return projectTasks.filter(task => isOverdue(task.dueDate, task.status));
  };

  const getCompletedTasks = () => {
    return projectTasks.filter(task => task.status === 'Completed');
  };

  const getTasksForFilter = () => {
    switch (tasksFilter) {
      case 'overdue':
        return getOverdueTasks();
      case 'completed':
        return getCompletedTasks();
      default:
        return projectTasks;
    }
  };

  const updateTaskStatus = (taskId: string, newStatus: string) => {
    setProjectTasks((prev: any[]) => prev.map((t: any) => t.id === taskId ? { ...t, status: newStatus } : t));
    setSelectedTask((prev: any | null) => prev ? { ...prev, status: newStatus } : prev);
    setRecentActivity(prev => [
      {
        id: Date.now(),
        type: 'status_changed',
        user: user?.name || 'You',
        action: 'changed status to',
        target: newStatus.replace('_', ' ').toUpperCase(),
        taskId: taskId,
        timestamp: new Date(),
        icon: '🔁'
      },
      ...prev
    ]);
  };

  const openTasksModal = (filter: 'overdue' | 'completed') => {
    setTasksFilter(filter);
    setSelectedTask(null);
    setShowTasksModal(true);
  };

  const renderTaskItem = ({ item }: { item: any }) => (
    <View style={styles.taskItem}>
      <View style={styles.taskHeader}>
        <Text style={styles.taskTitle}>{item.title}</Text>
        <View style={styles.taskBadges}>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
            <Text style={styles.badgeText}>{item.priority.toUpperCase()}</Text>
          </View>
          <View style={[styles.taskStatusBadge, { backgroundColor: getTaskStatusColor(item.status) }]}>
            <Text style={styles.badgeText}>{item.status.replace('_', ' ').toUpperCase()}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.taskDescription}>{item.description}</Text>
      <View style={styles.taskFooter}>
        <Text style={styles.taskDueDateText}>
          Due: {item.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
        {isOverdue(item.dueDate, item.status) && (
          <Text style={styles.overdueText}>OVERDUE</Text>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading project details...</Text>
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Project not found</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Project Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{project.name}</Text>
        <Text style={styles.client}>{project.client_name}</Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(project.status || 'active') }]}>
            <Text style={styles.statusText}>{(project.status || 'active').toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Employee Overview */}
      <View style={styles.tabContent}>
        {/* 1. Project Header */}
        <Card style={styles.projectHeaderCard}>
          <View style={styles.projectHeader}>
            <Text style={styles.projectName}>{project.name}</Text>
            <Text style={styles.clientName}>{project.client_name}</Text>
            
            <View style={styles.statusRow}>
              <View style={[styles.statusTag, { backgroundColor: getProjectStatus(project).bgColor }]}>
                <View style={[styles.statusDot, { backgroundColor: getProjectStatus(project).color }]} />
                <Text style={[styles.statusText, { color: getProjectStatus(project).color }]}>
                  {getProjectStatus(project).status}
                </Text>
              </View>
            </View>

            {project.due_date && (
              <View style={styles.dueDateRow}>
                <Text style={styles.dueDateText}>
                  Due in {getDaysUntilDue(project)} days - {new Date(project.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* 2. My Work Summary */}
        {projectMetrics && (
          <View style={styles.metricsContainer}>
            <Card style={styles.metricsCard}>
              <Text style={styles.metricsTitle}>My Work Summary</Text>
              
              {/* Overall Progress */}
              <View style={styles.metricItem}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel}>My Progress</Text>
                  <Text style={styles.metricValue}>{projectMetrics.progress}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${projectMetrics.progress}%` }]} />
                </View>
              </View>

              {/* My Metrics Grid */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricBoxValue}>{projectMetrics.myHoursThisWeek}h</Text>
                  <Text style={styles.metricBoxLabel}>This Week</Text>
                  <Text style={styles.metricBoxSubtext}>of 40h target</Text>
                </View>

                <View style={styles.metricBox}>
                  <Text style={styles.metricBoxValue}>{projectMetrics.myTotalHours}h</Text>
                  <Text style={styles.metricBoxLabel}>Total Hours</Text>
                  <Text style={styles.metricBoxSubtext}>on this project</Text>
                </View>

                <TouchableOpacity 
                  style={styles.metricBox}
                  onPress={() => {
                    openTasksModal('completed');
                  }}
                >
                  <Text style={styles.metricBoxValue}>{getCompletedTasks().length}</Text>
                  <Text style={styles.metricBoxLabel}>My Tasks Done</Text>
                  <Text style={styles.metricBoxSubtext}>out of {projectMetrics.myTasks}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.metricBox}
                  onPress={() => {
                    openTasksModal('overdue');
                  }}
                >
                  <Text style={[styles.metricBoxValue, { color: getOverdueTasks().length > 0 ? '#ef4444' : '#34d399' }]}>
                    {getOverdueTasks().length}
                  </Text>
                  <Text style={styles.metricBoxLabel}>Overdue Tasks</Text>
                  <Text style={styles.metricBoxSubtext}>tap to view upcoming</Text>
                </TouchableOpacity>
              </View>
            </Card>
          </View>
        )}

        {/* 3. My Hours Chart */}
        {employeeHours && (
          <View style={styles.visualizationsContainer}>
            {/* Daily Hours Breakdown */}
            <Card style={styles.chartCard}>
              <Text style={styles.chartTitle}>Daily Hours</Text>
              <View style={styles.dailyHoursContainer}>
                {employeeHours.dailyHours.map((day: any, index: number) => (
                  <View key={index} style={styles.dailyHourItem}>
                    <Text style={styles.dayLabel}>{day.day}</Text>
                    <View style={styles.dailyBar}>
                      <View style={[styles.dailyBarFill, { height: `${(day.hours / 8) * 100}%` }]} />
                    </View>
                    <Text style={styles.hourValue}>{day.hours}h</Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        )}

        {/* Team Members hidden for employees per requirement */}

        {/* 5. My Recent Activity */}
        {recentActivity.length > 0 && (
          <View style={styles.activitySection}>
            <Text style={styles.sectionTitle}>My Recent Activity</Text>
            <Card style={styles.activityCard}>
              {recentActivity.map((activity, index) => (
                <View key={activity.id} style={styles.activityItem}>
                  <Text style={styles.activityIcon}>{activity.icon}</Text>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>
                      <Text style={styles.activityUser}>{activity.user === (user?.name || '') ? 'You' : activity.user}</Text> {activity.action} <Text style={styles.activityTarget}>"{activity.target}"</Text>
                    </Text>
                    <Text style={styles.activityTime}>{formatRelativeTime(activity.timestamp)}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </View>
        )}
      </View>

      {/* Tasks Modal */}
      <Modal
        visible={showTasksModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTasksModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedTask ? 'Task Details' : (tasksFilter === 'completed' ? 'Completed Tasks' : 'Overdue Tasks')}
            </Text>
            {selectedTask && (
              <TouchableOpacity 
                style={[styles.closeButton, { marginRight: 8 }]}
                onPress={() => setSelectedTask(null)}
              >
                <Text style={styles.closeButtonText}>←</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowTasksModal(false)}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {!selectedTask ? (
            // Step 1: Names list
            <FlatList
              data={getTasksForFilter()}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.taskNameRow} onPress={() => setSelectedTask(item)}>
                  <Text style={styles.taskNameText}>{item.title}</Text>
                  <View style={styles.taskNameMeta}>
                    <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(item.priority) }]} />
                    <Text style={styles.taskNameMetaText}>{item.status.replace('_',' ')}</Text>
                  </View>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.id}
              style={styles.tasksList}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            // Step 2: Details view
            <ScrollView style={styles.taskDetailScroll} contentContainerStyle={styles.taskDetailContainer}>
              <Card style={styles.taskDetailCard}>
                <Text style={styles.taskDetailTitle}>{selectedTask.title}</Text>
                <Text style={styles.taskDetailDescription}>{selectedTask.description}</Text>

                {/* Live Timer */}
                <View style={styles.timerRow}>
                  <Text style={styles.detailLabel}>Live Timer</Text>
                  <View style={styles.timerControls}>
                    <Text style={styles.timerText}>{formatHMS(timerElapsedSec)}</Text>
                    <TouchableOpacity
                      style={[styles.timerButton, isTimerRunning ? styles.timerPause : styles.timerPlay]}
                      onPress={() => (isTimerRunning ? stopTimer() : startTimer())}
                    >
                      <Text style={styles.timerButtonText}>{isTimerRunning ? '⏸' : '▶'}</Text>
                    </TouchableOpacity>
                    {/* Reset button removed per requirement */}
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.detailRow}
                  onPress={() => setShowStatusPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.detailLabel}>Status</Text>
                  <View style={[styles.taskStatusBadge, { backgroundColor: getTaskStatusColor(selectedTask.status) }]}>
                    <Text style={styles.badgeText}>{selectedTask.status.replace('_',' ').toUpperCase()}</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Priority</Text>
                  <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(selectedTask.priority) }]}>
                    <Text style={styles.badgeText}>{selectedTask.priority.toUpperCase()}</Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Due Date</Text>
                  <Text style={styles.detailValue}>
                    {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Project Status</Text>
                  <Text style={styles.detailValue}>{project?.status || 'active'}</Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Overdue</Text>
                  <Text style={[styles.detailValue, { color: isOverdue(new Date(selectedTask.dueDate), selectedTask.status) ? '#FF3B30' : '#34C759' }]}>
                    {isOverdue(new Date(selectedTask.dueDate), selectedTask.status) ? 'Yes' : 'No'}
                  </Text>
                </View>

              </Card>

              {/* Work Description */}
              <View style={{ marginTop: 12 }}>
                <Card style={styles.taskDetailCard}>
                  <Text style={styles.subSectionTitle}>Description</Text>
                  <TextInput
                    style={styles.descriptionInput}
                    placeholder="Describe your work/updates for this task"
                    multiline
                    value={workDescription}
                    onChangeText={setWorkDescription}
                  />
                </Card>
              </View>

              {/* Attachments */}
              <View style={{ marginTop: 12 }}>
                <Card style={styles.taskDetailCard}>
                  <Text style={styles.subSectionTitle}>Attachments</Text>
                  <View style={styles.attachmentActions}>
                    <TouchableOpacity style={styles.attachButton} onPress={handlePickDocument}>
                      <Text style={styles.attachButtonText}>Add File</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.attachButton, styles.attachPhoto]} onPress={handlePickImage}>
                      <Text style={styles.attachButtonText}>Add Photo</Text>
                    </TouchableOpacity>
                  </View>
                  {attachments.length > 0 ? (
                    <View style={styles.attachmentsList}>
                      {attachments.map((file, idx) => (
                        <View key={file.uri + idx} style={styles.attachmentItem}>
                          {String(file.mimeType).startsWith('image') ? (
                            <Image source={{ uri: file.uri }} style={styles.attachmentThumb} />
                          ) : (
                            <View style={styles.attachmentIcon}><Text style={styles.attachmentIconText}>📄</Text></View>
                          )}
                          <View style={styles.attachmentMeta}>
                            <Text style={styles.attachmentName} numberOfLines={1}>{file.name}</Text>
                            <Text style={styles.attachmentSize}>{Math.round((file.size || 0) / 1024)} KB</Text>
                          </View>
                          <TouchableOpacity style={styles.removeAttachment} onPress={() => removeAttachment(file.uri)}>
                            <Text style={styles.removeAttachmentText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noAttachments}>No files attached</Text>
                  )}
                </Card>
              </View>

              {/* Task Recent Activity */}
              <View style={{ marginTop: 12 }}>
                <Card style={styles.activityCard}>
                  <Text style={styles.sectionTitle}>Recent Activity</Text>
                  {(() => {
                    const taskActivities = recentActivity.filter(a => a.taskId === selectedTask.id || String(a.target || '').includes(selectedTask.title));
                    if (taskActivities.length === 0) {
                      return <Text style={{ fontSize: 12, color: '#999' }}>No recent activity for this task yet</Text>;
                    }
                    return taskActivities.map((activity: any) => (
                      <View key={activity.id} style={styles.activityItem}>
                        <Text style={styles.activityIcon}>{activity.icon}</Text>
                        <View style={styles.activityContent}>
                          <Text style={styles.activityText}>
                            <Text style={styles.activityUser}>{activity.user === (user?.name || '') ? 'You' : activity.user}</Text> {activity.action} <Text style={styles.activityTarget}>"{activity.target}"</Text>
                          </Text>
                          <Text style={styles.activityTime}>{formatRelativeTime(new Date(activity.timestamp))}</Text>
                        </View>
                      </View>
                    ));
                  })()}
                </Card>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Status Picker Modal */}
      <Modal
        visible={showStatusPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusPicker(false)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Change Status</Text>
            {TASK_STATUSES.map(opt => (
              <TouchableOpacity 
                key={opt.key}
                style={styles.pickerItem}
                onPress={() => {
                  if (selectedTask) updateTaskStatus(selectedTask.id, opt.key);
                  setShowStatusPicker(false);
                }}
              >
                <View style={[styles.pickerDot, { backgroundColor: getTaskStatusColor(opt.key) }]} />
                <Text style={[styles.pickerLabel, selectedTask?.status === opt.key ? styles.pickerLabelActive : undefined]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setShowStatusPicker(false)}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    fontSize: 18,
    color: '#FF3B30',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  client: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tabContent: {
    padding: 16,
  },
  // Project Header Styles
  projectHeaderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  projectHeader: {
    alignItems: 'center',
  },
  projectName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  clientName: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  statusRow: {
    marginBottom: 12,
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  dueDateRow: {
    marginTop: 8,
  },
  dueDateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  // Metrics Styles
  metricsContainer: {
    marginBottom: 16,
  },
  metricsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 20,
    textAlign: 'center',
  },
  metricItem: {
    marginBottom: 20,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#007AFF',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricBox: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  metricBoxValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  metricBoxLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  metricBoxSubtext: {
    fontSize: 10,
    color: '#999',
  },
  // Visualization Styles
  visualizationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  chartCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  hoursChart: {
    alignItems: 'center',
  },
  hoursBar: {
    width: '100%',
    height: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  hoursUsed: {
    height: '100%',
    backgroundColor: '#34d399',
    borderRadius: 6,
  },
  hoursLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  hoursLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  efficiencyContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  efficiencyText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  // Daily Hours Styles
  dailyHoursContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  dailyHourItem: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 2,
  },
  dayLabel: {
    fontSize: 10,
    color: '#666',
    marginBottom: 8,
  },
  dailyBar: {
    width: 20,
    height: 80,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  dailyBarFill: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minHeight: 4,
  },
  hourValue: {
    fontSize: 9,
    color: '#666',
    marginTop: 4,
  },
  // Team Members Styles
  teamSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  teamGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  memberCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  currentUserCard: {
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  memberAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  currentUserAvatar: {
    backgroundColor: '#34d399',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
    textAlign: 'center',
  },
  currentUserName: {
    color: '#007AFF',
    fontWeight: '700',
  },
  memberRole: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  memberHoursLogged: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  memberTasks: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },
  currentUserBadge: {
    fontSize: 10,
    color: '#007AFF',
    fontWeight: '600',
    marginTop: 4,
  },
  // Activity Feed Styles
  activitySection: {
    marginBottom: 16,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#1a1a1a',
    lineHeight: 20,
    marginBottom: 4,
  },
  activityUser: {
    fontWeight: '600',
    color: '#007AFF',
  },
  activityTarget: {
    fontWeight: '500',
    color: '#1a1a1a',
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  tasksList: {
    flex: 1,
    padding: 16,
  },
  // Task Names List Styles
  taskNameRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  taskNameText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  taskNameMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskNameMetaText: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Task Item Styles
  taskItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    color: '#1a1a1a',
    flex: 1,
    marginRight: 12,
  },
  taskBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  taskStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  taskDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskDueDateText: {
    fontSize: 12,
    color: '#666',
  },
  overdueText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF3B30',
  },
  // Status Picker Styles
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  pickerCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '85%',
    maxWidth: 360,
    padding: 12,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pickerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  pickerLabel: {
    fontSize: 13,
    color: '#1a1a1a',
  },
  pickerLabelActive: {
    fontWeight: '700',
    color: '#007AFF',
  },
  pickerCancel: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  pickerCancelText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
  },
  // Task Detail Styles
  taskDetailScroll: {
    flex: 1,
  },
  taskDetailContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  taskDetailCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  taskDetailTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  taskDetailDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  descriptionInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fafafa',
    textAlignVertical: 'top',
  },
  attachmentActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  attachButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  attachPhoto: {
    backgroundColor: '#34C759',
  },
  attachButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  attachmentsList: {
    marginTop: 4,
    gap: 8,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    padding: 8,
    gap: 8,
  },
  attachmentThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  attachmentIcon: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentIconText: {
    fontSize: 18,
  },
  attachmentMeta: {
    flex: 1,
  },
  attachmentName: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  attachmentSize: {
    fontSize: 12,
    color: '#666',
  },
  removeAttachment: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeAttachmentText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '700',
  },
  noAttachments: {
    fontSize: 12,
    color: '#999',
  },
  // Timer Styles
  timerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  timerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginRight: 6,
  },
  timerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerPlay: {
    backgroundColor: '#34C759',
  },
  timerPause: {
    backgroundColor: '#FF3B30',
  },
  timerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  timerReset: {
    marginLeft: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  timerResetText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
});
