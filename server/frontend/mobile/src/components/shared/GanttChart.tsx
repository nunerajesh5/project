import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Dimensions, 
  TouchableOpacity
} from 'react-native';
import { 
  PanGestureHandler,
  PinchGestureHandler,
  State
} from 'react-native-gesture-handler';
import { Project } from '../../api/dashboard';

interface Task {
  id: string;
  name: string;
  start: Date;
  end: Date;
  progress: number; // 0-1
  status: 'To Do' | 'Active' | 'Completed' | 'Cancelled' | 'On Hold';
  priority: 'low' | 'medium' | 'high' | 'critical';
  dependencies: string[]; // Array of task IDs this task depends on
  assignee?: string;
  projectId: string;
  projectName: string;
  clientName: string;
}

interface GanttChartProps {
  projects: Project[];
  onProjectPress?: (project: Project) => void;
  onTaskPress?: (task: Task) => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const CHART_WIDTH = screenWidth - 32;
const DAY_WIDTH = 25; // Increased for better visibility
const ROW_HEIGHT = 50; // Increased for better touch targets
const TASK_BAR_HEIGHT = 24;
const MILESTONE_SIZE = 12;

export default function GanttChart({ projects, onProjectPress, onTaskPress }: GanttChartProps) {
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDependencies, setShowDependencies] = useState(true);
  const [showCriticalPath, setShowCriticalPath] = useState(true);
  const [viewMode, setViewMode] = useState<'days' | 'weeks' | 'months'>('days');
  
  // Convert projects to tasks with enhanced data
  const tasks: Task[] = projects.map((project, index) => {
    const startDate = new Date(project.start_date);
    const endDate = project.end_date ? new Date(project.end_date) : new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate progress based on status and time elapsed
    let progress = 0;
    const now = new Date();
    if (project.status === 'Completed') {
      progress = 1;
    } else if (project.status === 'Active') {
      const elapsed = Math.max(0, now.getTime() - startDate.getTime());
      const total = endDate.getTime() - startDate.getTime();
      progress = Math.min(0.8, elapsed / total); // Cap at 80% for active projects
    }
    
    return {
      id: project.id,
      name: project.name,
      start: startDate,
      end: endDate,
      progress: Math.max(0, Math.min(1, progress)),
      status: project.status as Task['status'],
      priority: index % 4 === 0 ? 'critical' : index % 3 === 0 ? 'high' : index % 2 === 0 ? 'medium' : 'low',
      dependencies: [], // Will be calculated based on project relationships
      projectId: project.id,
      projectName: project.name,
      clientName: project.client_name
    };
  });

  // Calculate dependencies (simplified logic - in real app this would come from API)
  const tasksWithDependencies = tasks.map((task, index) => ({
    ...task,
    dependencies: index > 0 ? [tasks[index - 1].id] : []
  }));

  // Calculate critical path (longest path through dependencies)
  const calculateCriticalPath = (tasks: Task[]): string[] => {
    const criticalPath: string[] = [];
    const visited = new Set<string>();
    
    const dfs = (taskId: string, path: string[]): string[] => {
      if (visited.has(taskId)) return path;
      visited.add(taskId);
      
      const task = tasks.find(t => t.id === taskId);
      if (!task) return path;
      
      const currentPath = [...path, taskId];
      let longestPath = currentPath;
      
      for (const depId of task.dependencies) {
        const depPath = dfs(depId, currentPath);
        if (depPath.length > longestPath.length) {
          longestPath = depPath;
        }
      }
      
      return longestPath;
    };
    
    // Find the longest path starting from tasks with no dependencies
    const rootTasks = tasks.filter(t => t.dependencies.length === 0);
    for (const rootTask of rootTasks) {
      const path = dfs(rootTask.id, []);
      if (path.length > criticalPath.length) {
        criticalPath.splice(0, criticalPath.length, ...path);
      }
    }
    
    return criticalPath;
  };

  const criticalPath = calculateCriticalPath(tasksWithDependencies);

  // Calculate date range
  const getDateRange = () => {
    if (tasksWithDependencies.length === 0) return { start: new Date(), end: new Date() };
    
    const dates = tasksWithDependencies.flatMap(t => [t.start, t.end]);
    const start = new Date(Math.min(...dates.map(d => d.getTime())));
    const end = new Date(Math.max(...dates.map(d => d.getTime())));
    
    // Add padding
    start.setDate(start.getDate() - 7);
    end.setDate(end.getDate() + 7);
    
    return { start, end };
  };

  const { start, end } = getDateRange();
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const chartWidth = Math.max(totalDays * DAY_WIDTH * zoom, CHART_WIDTH);

  // Generate date headers based on view mode
  const generateDateHeaders = () => {
    const headers = [];
    const current = new Date(start);
    
    if (viewMode === 'days') {
      while (current <= end) {
        headers.push({
          date: new Date(current),
          isWeekend: current.getDay() === 0 || current.getDay() === 6,
          isToday: current.toDateString() === new Date().toDateString()
        });
        current.setDate(current.getDate() + 1);
      }
    } else if (viewMode === 'weeks') {
      // Start from Monday of the week
      const monday = new Date(current);
      monday.setDate(current.getDate() - current.getDay() + 1);
      
      while (monday <= end) {
        headers.push({
          date: new Date(monday),
          isWeekend: false,
          isToday: monday.toDateString() === new Date().toDateString()
        });
        monday.setDate(monday.getDate() + 7);
      }
    } else if (viewMode === 'months') {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      while (monthStart <= end) {
        headers.push({
          date: new Date(monthStart),
          isWeekend: false,
          isToday: monthStart.toDateString() === new Date().toDateString()
        });
        monthStart.setMonth(monthStart.getMonth() + 1);
      }
    }
    
    return headers;
  };

  const dateHeaders = generateDateHeaders();

  // Calculate task bar position and width
  const getTaskBarStyle = (task: Task) => {
    const startOffset = Math.max(0, Math.floor((task.start.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const duration = Math.max(1, Math.ceil((task.end.getTime() - task.start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    
    return {
      left: startOffset * DAY_WIDTH * zoom,
      width: duration * DAY_WIDTH * zoom,
    };
  };

  // Get task status color
  const getTaskStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'Active':
        return '#877ED2';
      case 'Completed':
        return '#34C759';
      case 'To Do':
        return '#8E8E93';
      case 'On Hold':
        return '#FF9500';
      case 'Cancelled':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  // Get priority color
  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'critical':
        return '#FF3B30';
      case 'high':
        return '#FF9500';
      case 'medium':
        return '#FFCC00';
      case 'low':
        return '#34C759';
      default:
        return '#8E8E93';
    }
  };

  // Check if task is overdue
  const isOverdue = (task: Task) => {
    return task.end < new Date() && task.status !== 'completed';
  };

  // Check if task is on critical path
  const isOnCriticalPath = (taskId: string) => {
    return showCriticalPath && criticalPath.includes(taskId);
  };

  // Render dependency arrows
  const renderDependencies = () => {
    if (!showDependencies) return null;
    
    return tasksWithDependencies.map((task) => {
      if (task.dependencies.length === 0) return null;
      
      return task.dependencies.map((depId) => {
        const depTask = tasksWithDependencies.find(t => t.id === depId);
        if (!depTask) return null;
        
        const depStyle = getTaskBarStyle(depTask);
        const taskStyle = getTaskBarStyle(task);
        
        return (
          <View
            key={`${depId}-${task.id}`}
            style={[
              styles.dependencyArrow,
              {
                left: depStyle.left + depStyle.width,
                top: ROW_HEIGHT * tasksWithDependencies.indexOf(depTask) + TASK_BAR_HEIGHT / 2,
                width: taskStyle.left - (depStyle.left + depStyle.width),
              }
            ]}
          />
        );
      });
    }).flat().filter(Boolean);
  };

  return (
    <View style={styles.container}>
      {/* Professional Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Gantt Chart</Text>
          <Text style={styles.subtitle}>Project Timeline View</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.toolbar}>
            <TouchableOpacity style={styles.toolbarButton}>
              <Text style={styles.toolbarIcon}>📊</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarButton}>
              <Text style={styles.toolbarIcon}>⚙️</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.toolbarButton}>
              <Text style={styles.toolbarIcon}>📥</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* View Mode Controls */}
      <View style={styles.viewControls}>
        <View style={styles.viewModeGroup}>
          <Text style={styles.controlLabel}>View:</Text>
          <View style={styles.viewModeButtons}>
            <TouchableOpacity 
              style={[styles.viewModeButton, viewMode === 'days' && styles.activeViewMode]}
              onPress={() => setViewMode('days')}
            >
              <Text style={[styles.viewModeText, viewMode === 'days' && styles.activeViewModeText]}>Days</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.viewModeButton, viewMode === 'weeks' && styles.activeViewMode]}
              onPress={() => setViewMode('weeks')}
            >
              <Text style={[styles.viewModeText, viewMode === 'weeks' && styles.activeViewModeText]}>Weeks</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.viewModeButton, viewMode === 'months' && styles.activeViewMode]}
              onPress={() => setViewMode('months')}
            >
              <Text style={[styles.viewModeText, viewMode === 'months' && styles.activeViewModeText]}>Months</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.featureToggles}>
          <TouchableOpacity 
            style={[styles.featureToggle, showDependencies && styles.activeFeatureToggle]}
            onPress={() => setShowDependencies(!showDependencies)}
          >
            <Text style={[styles.featureToggleText, showDependencies && styles.activeFeatureToggleText]}>Dependencies</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.featureToggle, showCriticalPath && styles.activeFeatureToggle]}
            onPress={() => setShowCriticalPath(!showCriticalPath)}
          >
            <Text style={[styles.featureToggleText, showCriticalPath && styles.activeFeatureToggleText]}>Critical Path</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Professional Gantt Chart Container */}
      <View style={styles.ganttContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={true}
          style={styles.scrollContainer}
          contentContainerStyle={{ width: chartWidth }}
        >
          <View style={styles.chartContainer}>
            {/* Professional Date Headers */}
            <View style={styles.dateHeader}>
              <View style={styles.taskNameColumn}>
                <View style={styles.taskHeader}>
                  <Text style={styles.headerText}>Task Name</Text>
                  <View style={styles.headerDivider} />
                </View>
              </View>
              <View style={styles.timelineContainer}>
                {dateHeaders.map((header, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.dateCell,
                      header.isWeekend && styles.weekendCell,
                      header.isToday && styles.todayCell
                    ]}
                  >
                    <View style={styles.dateCellContent}>
                      <Text style={[
                        styles.dateText,
                        header.isWeekend && styles.weekendText,
                        header.isToday && styles.todayText
                      ]}>
                        {viewMode === 'days' ? header.date.getDate() : 
                         viewMode === 'weeks' ? `W${Math.ceil(header.date.getDate() / 7)}` :
                         header.date.getMonth() + 1}
                      </Text>
                      <Text style={[
                        styles.monthText,
                        header.isWeekend && styles.weekendText,
                        header.isToday && styles.todayText
                      ]}>
                        {viewMode === 'days' ? header.date.toLocaleDateString('en', { month: 'short' }) :
                         viewMode === 'weeks' ? header.date.toLocaleDateString('en', { month: 'short' }) :
                         header.date.toLocaleDateString('en', { year: '2-digit' })}
                      </Text>
                    </View>
                    {header.isToday && <View style={styles.todayIndicator} />}
                  </View>
                ))}
              </View>
            </View>

            {/* Professional Task Rows */}
            {tasksWithDependencies.map((task, index) => {
              const barStyle = getTaskBarStyle(task);
              const isTaskOverdue = isOverdue(task);
              const isCritical = isOnCriticalPath(task.id);
              
              return (
                <View key={task.id} style={[styles.taskRow, index % 2 === 0 && styles.alternateRow]}>
                  <View style={styles.taskNameColumn}>
                    <View style={styles.taskInfo}>
                      <View style={styles.taskNameRow}>
                        <Text 
                          style={styles.taskName}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {task.name}
                        </Text>
                        <View style={styles.taskIndicators}>
                          {isCritical && <View style={styles.criticalIndicator} />}
                          {isTaskOverdue && <View style={styles.overdueIndicator} />}
                        </View>
                      </View>
                      <Text style={styles.clientName}>{task.clientName}</Text>
                      <View style={styles.taskMeta}>
                        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) }]}>
                          <Text style={styles.priorityText}>{task.priority.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.statusText}>{task.status.replace('_', ' ').toUpperCase()}</Text>
                      </View>
                    </View>
                    <View style={styles.taskDivider} />
                  </View>
                  
                  <View style={styles.timelineContainer}>
                    <View style={styles.taskBarContainer}>
                      {/* Dependency Arrows */}
                      {renderDependencies()}
                      
                      {/* Professional Task Bar */}
                      <TouchableOpacity
                        style={[
                          styles.taskBar,
                          {
                            left: barStyle.left,
                            width: barStyle.width,
                            backgroundColor: getTaskStatusColor(task.status),
                          },
                          isTaskOverdue && styles.overdueBar,
                          isCritical && styles.criticalBar
                        ]}
                        onPress={() => {
                          setSelectedTask(task);
                          onTaskPress?.(task);
                        }}
                      >
                        {/* Progress Bar */}
                        <View 
                          style={[
                            styles.progressBar,
                            {
                              width: `${task.progress * 100}%`,
                              backgroundColor: 'rgba(255,255,255,0.4)'
                            }
                          ]}
                        />
                        
                        {/* Task Bar Content */}
                        <View style={styles.taskBarContent}>
                          <Text style={styles.taskBarText} numberOfLines={1}>
                            {task.name}
                          </Text>
                          <Text style={styles.progressText}>
                            {Math.round(task.progress * 100)}%
                          </Text>
                        </View>
                        
                        {/* Milestone Indicator */}
                        {task.progress === 1 && (
                          <View style={styles.milestone}>
                            <Text style={styles.milestoneText}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Professional Legend */}
      <View style={styles.legend}>
        <View style={styles.legendHeader}>
          <Text style={styles.legendTitle}>Legend</Text>
          <View style={styles.legendDivider} />
        </View>
        <View style={styles.legendSections}>
          <View style={styles.legendSection}>
            <Text style={styles.legendSectionTitle}>Task Status</Text>
            <View style={styles.legendItems}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#007AFF' }]} />
                <Text style={styles.legendText}>In Progress</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#34C759' }]} />
                <Text style={styles.legendText}>Completed</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#8E8E93' }]} />
                <Text style={styles.legendText}>Not Started</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#FF9500' }]} />
                <Text style={styles.legendText}>On Hold</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.legendSection}>
            <Text style={styles.legendSectionTitle}>Priority Level</Text>
            <View style={styles.legendItems}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#FF3B30' }]} />
                <Text style={styles.legendText}>Critical</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#FF9500' }]} />
                <Text style={styles.legendText}>High</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#FFCC00' }]} />
                <Text style={styles.legendText}>Medium</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: '#34C759' }]} />
                <Text style={styles.legendText}>Low</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    margin: 16,
    padding: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    gap: 8,
  },
  toolbarButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolbarIcon: {
    fontSize: 16,
  },
  viewControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  viewModeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginRight: 12,
  },
  viewModeButtons: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 6,
    padding: 2,
  },
  viewModeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  activeViewMode: {
    backgroundColor: '#007AFF',
  },
  viewModeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  activeViewModeText: {
    color: '#fff',
  },
  featureToggles: {
    flexDirection: 'row',
    gap: 8,
  },
  featureToggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    backgroundColor: '#fff',
  },
  activeFeatureToggle: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  featureToggleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
  activeFeatureToggleText: {
    color: '#fff',
  },
  ganttContainer: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 6,
    margin: 16,
    overflow: 'hidden',
  },
  scrollContainer: {
    maxHeight: 500,
  },
  chartContainer: {
    minWidth: CHART_WIDTH,
  },
  dateHeader: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 2,
    borderBottomColor: '#d1d5db',
  },
  taskNameColumn: {
    width: 200,
    borderRightWidth: 2,
    borderRightColor: '#d1d5db',
    backgroundColor: '#f8f9fa',
  },
  taskHeader: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  headerDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#d1d5db',
    marginLeft: 8,
  },
  timelineContainer: {
    flex: 1,
    position: 'relative',
  },
  dateCell: {
    width: DAY_WIDTH,
    alignItems: 'center',
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  dateCellContent: {
    alignItems: 'center',
  },
  weekendCell: {
    backgroundColor: '#f3f4f6',
  },
  todayCell: {
    backgroundColor: '#dbeafe',
    position: 'relative',
  },
  todayIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#3b82f6',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  monthText: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },
  weekendText: {
    color: '#9ca3af',
  },
  todayText: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  taskRow: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    alignItems: 'center',
    position: 'relative',
  },
  alternateRow: {
    backgroundColor: '#f9fafb',
  },
  taskInfo: {
    flex: 1,
    padding: 12,
  },
  taskNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  taskName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
    flex: 1,
  },
  taskIndicators: {
    flexDirection: 'row',
    gap: 4,
  },
  criticalIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#dc2626',
  },
  overdueIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
  },
  clientName: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 6,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#fff',
  },
  statusText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  taskDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 12,
  },
  taskBarContainer: {
    flex: 1,
    height: ROW_HEIGHT - 8,
    position: 'relative',
    marginVertical: 4,
  },
  taskBar: {
    position: 'absolute',
    height: TASK_BAR_HEIGHT,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
    flexDirection: 'row',
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: TASK_BAR_HEIGHT,
    borderRadius: 4,
  },
  taskBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  taskBarText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
  },
  progressText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '500',
    marginLeft: 4,
  },
  milestone: {
    position: 'absolute',
    right: -6,
    top: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  overdueBar: {
    borderWidth: 2,
    borderColor: '#f59e0b',
    borderStyle: 'dashed',
  },
  criticalBar: {
    borderWidth: 2,
    borderColor: '#dc2626',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 2,
  },
  dependencyArrow: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#6b7280',
    top: TASK_BAR_HEIGHT / 2 - 1,
  },
  legend: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
  },
  legendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  legendDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
    marginLeft: 8,
  },
  legendSections: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendSection: {
    flex: 1,
  },
  legendSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  legendItems: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 6,
  },
  legendText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
});
