import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, RefreshControl, Linking, BackHandler, Image, Modal, FlatList, Alert } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { getProject, listProjectTasks, getProjectTeam, listTimeEntries, addProjectTeamMember, removeProjectTeamMember, listEmployees } from '../../api/endpoints';
import { dashboardApi } from '../../api/dashboard';
import { api } from '../../api/client';
import SafeAreaWrapper from '../../components/shared/SafeAreaWrapper';

export default function AdminProjectDetailsScreen() {
  const route = useRoute<any>();
  const { id } = route.params || {};
  const { user } = useContext(AuthContext);
  const navigation = useNavigation<any>();
  
  const [project, setProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [attachmentsCount, setAttachmentsCount] = useState<number>(0);
  const [projectAttachments, setProjectAttachments] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [showMoreTasks, setShowMoreTasks] = useState(false);
  
  // Admin-specific: Team management modal
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableEmployees, setAvailableEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  
  // Productivity section state
  const [selectedDepartment, setSelectedDepartment] = useState<string>('All');
  const [productivityView, setProductivityView] = useState<'week' | 'month'>('week');
  const [chartView, setChartView] = useState<'bar' | 'list'>('bar');
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day; // Adjust to Sunday
    const sunday = new Date(today);
    sunday.setDate(diff);
    return sunday;
  });
  const [timeEntries, setTimeEntries] = useState<any[]>([]);

  const loadData = async () => {
    try {
      if (!id) return;
      
      // Load project data
      const res = await getProject(id);
      const apiProject = res.project;
      setProject({
        ...apiProject,
        client_name: apiProject.client_name || 'Client',
      });

      // Load tasks
      const taskRes = await listProjectTasks(String(id), 1, 200);
      const allTasks = taskRes.tasks || [];
      
      // Calculate task durations and format them
      const formattedTasks = allTasks.map((task: any) => {
        let duration = 0;
        if (task.due_date && task.created_at) {
          const start = new Date(task.created_at);
          const end = new Date(task.due_date);
          const diffTime = Math.abs(end.getTime() - start.getTime());
          duration = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        } else if (task.estimated_duration) {
          duration = task.estimated_duration;
        }
        
        return {
          ...task,
          duration: duration || 0,
        };
      });
      
      // Calculate progress
      const completed = formattedTasks.filter((t: any) => 
        t.status === 'Completed'
      ).length;
      setProgress(formattedTasks.length > 0 ? Math.round((completed / formattedTasks.length) * 100) : 0);

      // Load team members with stats
      try {
        const teamResponse = await getProjectTeam(id as string);
        const teamData = teamResponse?.teamMembers || [];
        
        // Get stats for each team member to include hours logged
        let employeeBreakdown: any[] = [];
        try {
          const stats = await dashboardApi.getProjectStats(id as string);
          employeeBreakdown = stats?.employeeBreakdown || [];
        } catch (statsError) {
          console.warn('Error loading project stats (non-critical):', statsError);
        }
        
        // Map team members with their hours logged
        const teamMembersData = teamData.map((member: any) => {
          const statsForMember = employeeBreakdown.find((emp: any) => emp.id === member.id);
          const totalMinutes = statsForMember ? (statsForMember.totalMinutes || 0) : 0;
          const hours = Math.floor(totalMinutes / 60);
          const minutes = totalMinutes % 60;
          
          return {
            ...member,
            hours,
            minutes,
            totalMinutes,
          };
        });
        
        setTeamMembers(teamMembersData);
      } catch (e: any) {
        console.error('Error loading team members:', e?.message || e);
        setTeamMembers([]);
      }

      // Load attachments count and attach to tasks
      try {
        let allAttachments: any[] = [];
        const tasksWithAttachments = await Promise.all(
          formattedTasks.map(async (task: any) => {
            try {
              const taskAttachments = await dashboardApi.getTaskAttachments(task.id.toString());
              allAttachments.push(...taskAttachments);
              return {
                ...task,
                attachments: taskAttachments,
              };
            } catch (error) {
              return {
                ...task,
                attachments: [],
              };
            }
          })
        );
        setTasks(tasksWithAttachments);
        setAttachmentsCount(allAttachments.length);
        setProjectAttachments(allAttachments);
      } catch (error) {
        setTasks(formattedTasks);
        setAttachmentsCount(0);
        setProjectAttachments([]);
      }

      // Load time entries for productivity
      try {
        const entriesRes = await listTimeEntries({ 
          projectId: id, 
          page: 1, 
          limit: 1000 
        });
        setTimeEntries(entriesRes.timeEntries || []);
      } catch (error) {
        console.error('Error loading time entries:', error);
        setTimeEntries([]);
      }

    } catch (error: any) {
      console.error('Error loading project data:', error);
    }
  };

  useEffect(() => {
    if (id) {
      loadData().finally(() => setLoading(false));
    }
  }, [id, user]);

  // Handle Android back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });

    return () => backHandler.remove();
  }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Admin-specific: Handle add member
  const handleAddMember = async () => {
    try {
      const response = await listEmployees({ page: 1, limit: 100 });
      const employees = response.employees || [];
      const teamMemberIds = teamMembers.map(m => m.id);
      const available = employees.filter((emp: any) => !teamMemberIds.includes(emp.id));
      setAvailableEmployees(available);
      setShowAddMemberModal(true);
    } catch (error) {
      console.error('Error loading employees:', error);
      Alert.alert('Error', 'Failed to load employees');
    }
  };

  const handleSelectEmployee = async () => {
    if (!selectedEmployee || !id) return;
    
    try {
      console.log('Adding team member:', selectedEmployee, 'to project:', id);
      await addProjectTeamMember(id as string, selectedEmployee, 'member');
      Alert.alert('Success', 'Team member added successfully');
      setShowAddMemberModal(false);
      setSelectedEmployee(null);
      await loadData();
    } catch (error: any) {
      console.error('Error adding team member:', error?.response?.data || error?.message || error);
      Alert.alert('Error', error.response?.data?.error || error?.message || 'Failed to add team member');
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!id) return;
    
    Alert.alert(
      'Remove Team Member',
      `Are you sure you want to remove ${memberName} from this project team?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeProjectTeamMember(id as string, memberId);
              Alert.alert('Success', 'Team member removed successfully');
              await loadData();
            } catch (error: any) {
              console.error('Error removing team member:', error);
              Alert.alert('Error', error.response?.data?.error || 'Failed to remove team member');
            }
          }
        }
      ]
    );
  };

  const handleAddressPress = () => {
    const address = project?.client_address || project?.address || 'Doddaballapura Main Rd, Bengaluru, Karnataka 560119';
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.google.com/?q=${encodedAddress}`;
    Linking.openURL(url).catch(err => console.error('Error opening maps:', err));
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}, ${d.getFullYear()}`;
  };

  const getStatusColor = (status: string, dueDate?: string) => {
    const statusLower = status?.toLowerCase() || '';
    
    switch (status) {
      case 'Completed':
        return '#34C759'; // Green
      case 'Active':
        return '#877ED2'; // Purple
      case 'Cancelled':
        return '#FF3B30'; // Red
      case 'On Hold':
        return '#FF9500'; // Orange
      case 'To Do':
        return '#8E8E93'; // Grey
      default:
        return '#8E8E93';
    }
  };

  const getStatusText = (status: string, dueDate?: string) => {
    const now = new Date();
    
    // Check if task is delayed (overdue and not completed)
    if (dueDate && status !== 'Completed') {
      const due = new Date(dueDate);
      if (due < now) {
        const daysOverdue = Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        return `Delayed ${daysOverdue}d`;
      }
    }
    
    switch (status) {
      case 'Completed':
        return 'Completed';
      case 'Active':
        return 'Active';
      case 'Cancelled':
        return 'Cancelled';
      case 'On Hold':
        return 'On Hold';
      case 'To Do':
        return 'To Do';
      default:
        return 'To Do';
    }
  };

  const getProjectStatus = () => {
    if (!project?.status) return 'Active';
    const status = project.status;
    if (status === 'To Do') return 'To Do';
    if (status === 'Active') return 'Active';
    if (status === 'Completed') return 'Completed';
    if (status === 'On Hold') return 'On Hold';
    if (status === 'Cancelled') return 'Cancelled';
    return 'Active';
  };

  const displayedTasks = showMoreTasks ? tasks : tasks.slice(0, 4);

  // Productivity helper functions
  const getProductivityWeekRange = () => {
    if (productivityView === 'month') {
      const month = currentWeekStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return month;
    }
    
    const start = new Date(currentWeekStart);
    start.setDate(currentWeekStart.getDate() - currentWeekStart.getDay()); // Get Sunday
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Get Saturday
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const startDay = start.getDate().toString().padStart(2, '0');
    const endDay = end.getDate().toString().padStart(2, '0');
    return `${startDay} ${months[start.getMonth()]} - ${endDay} ${months[end.getMonth()]}`;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => {
      const newDate = new Date(prev);
      if (productivityView === 'month') {
        newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      } else {
        newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
      }
      return newDate;
    });
  };

  // Get unique departments from team members
  const getDepartments = () => {
    const departments = new Set<string>();
    teamMembers.forEach(member => {
      if (member.department) {
        departments.add(member.department);
      }
    });
    return ['All', ...Array.from(departments).sort()];
  };

  // Filter time entries by department
  const getFilteredTimeEntries = () => {
    let filtered = timeEntries;
    
    if (selectedDepartment !== 'All') {
      const departmentEmployeeIds = teamMembers
        .filter(m => m.department === selectedDepartment)
        .map(m => m.id);
      filtered = filtered.filter(entry => 
        departmentEmployeeIds.includes(entry.employee_id)
      );
    }
    
    return filtered;
  };

  // Calculate productivity data
  const getProductivityData = () => {
    const filteredEntries = getFilteredTimeEntries();
    
    if (productivityView === 'month') {
      return getProductivityMonthData(filteredEntries);
    }
    
    const sunday = new Date(currentWeekStart);
    sunday.setDate(currentWeekStart.getDate() - currentWeekStart.getDay()); // Get Sunday
    
    const dayAbbreviations = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const day = dayAbbreviations[d.getDay()];
      const date = d.getDate().toString();
      
      const dayStr = d.toISOString().split('T')[0];
      const dayEntries = filteredEntries.filter(entry => {
        const entryDate = entry.start_time || entry.work_date || entry.created_at;
        if (!entryDate) return false;
        const entryDayStr = new Date(entryDate).toISOString().split('T')[0];
        return entryDayStr === dayStr;
      });
      
      const totalMinutes = dayEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
      const hours = totalMinutes / 60;
      
      return { day, date, hours: Math.round(hours * 10) / 10 };
    });
  };

  const getProductivityMonthData = (filteredEntries: any[]) => {
    const firstDay = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth(), 1);
    const lastDay = new Date(currentWeekStart.getFullYear(), currentWeekStart.getMonth() + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    const dayAbbreviations = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    return Array.from({ length: daysInMonth }).map((_, i) => {
      const d = new Date(firstDay);
      d.setDate(i + 1);
      const day = dayAbbreviations[d.getDay()];
      const date = d.getDate().toString();
      
      const dayStr = d.toISOString().split('T')[0];
      const dayEntries = filteredEntries.filter(entry => {
        const entryDate = entry.start_time || entry.work_date || entry.created_at;
        if (!entryDate) return false;
        const entryDayStr = new Date(entryDate).toISOString().split('T')[0];
        return entryDayStr === dayStr;
      });
      
      const totalMinutes = dayEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
      const hours = totalMinutes / 60;
      
      return { day, date, hours: Math.round(hours * 10) / 10 };
    });
  };

  const productivityData = getProductivityData();
  const maxHours = Math.max(...productivityData.map(d => d.hours), 1);
  const totalHours = productivityData.reduce((sum, d) => sum + d.hours, 0);
  const daysWithWork = productivityData.filter(d => d.hours > 0).length;
  const totalTasks = tasks.length;

  // Team members with time calculation
  const getTeamMembersWithTime = () => {
    return teamMembers.map(member => {
      return {
        ...member,
        hours: member.hours || 0,
        minutes: member.minutes || 0,
        totalMinutes: member.totalMinutes || 0,
      };
    });
  };

  const teamMembersWithTime = getTeamMembersWithTime();

  // Helper functions for team display
  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      '#8B4513', // Brown
      '#708090', // Blue-grey
      '#34C759', // Green
      '#FF9500', // Orange
      '#5AC8FA', // Light blue
      '#007AFF', // Blue
      '#AF52DE', // Purple
      '#FF3B30', // Red
      '#FF9500', // Orange
      '#34C759', // Green
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const formatTime = (hours: number, minutes: number) => {
    const hrs = hours.toString().padStart(2, '0');
    const mins = minutes.toString().padStart(2, '0');
    return `${hrs}hr ${mins}min`;
  };

  // Helper functions for attachments
  const categorizeAttachments = (attachments: any[]) => {
    const categorized: { [key: string]: any[] } = {
      Document: [],
      Photo: [],
      Video: [],
    };
    
    attachments.forEach((attachment) => {
      const mimeType = attachment.mime_type?.toLowerCase() || '';
      if (mimeType.startsWith('image/')) {
        categorized.Photo.push(attachment);
      } else if (mimeType.startsWith('video/')) {
        categorized.Video.push(attachment);
      } else {
        categorized.Document.push(attachment);
      }
    });
    
    return categorized;
  };

  const getFileIcon = (mimeType: string) => {
    const mime = mimeType?.toLowerCase() || '';
    if (mime.startsWith('image/')) {
      return 'image';
    } else if (mime.startsWith('video/')) {
      return 'videocam';
    } else {
      return 'document-text';
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#877ED2" />
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
    <SafeAreaWrapper backgroundColor="#F5F6FA">
      <View style={styles.container}>
        {/* Purple Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {project.name || 'Project'}
            </Text>
            <TouchableOpacity style={styles.headerButton}>
              <Ionicons name="ellipsis-vertical" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        <View style={styles.cardContainer}>
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            showsVerticalScrollIndicator={false}
          >
            {/* Project Information Card */}
            <View style={[styles.contentCard, styles.overlappingCard]}>
              {/* Project Title */}
              <Text style={styles.projectTitle}>{project.name || 'Project'}</Text>

              {/* Description */}
              <Text style={styles.description}>
                {project.description || project.notes || 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam'}
              </Text>

              {/* Address with Map Marker */}
              <TouchableOpacity style={styles.addressContainer} onPress={handleAddressPress} activeOpacity={0.7}>
                <Ionicons name="location" size={20} color="#877ED2" style={styles.locationIcon} />
                <Text style={styles.addressText}>
                  {project.client_address || project.address || project.location || 'Doddaballapura Main Rd, Bengaluru, Karnataka 560119'}
                </Text>
              </TouchableOpacity>

              {/* Footer Statistics */}
              <View style={styles.footerStats}>
                <View style={styles.statItem}>
                  <Ionicons name="people" size={24} color="#877ED2" />
                  <Text style={styles.statNumber}>{teamMembers.length || 0}</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="document-text" size={24} color="#877ED2" />
                  <Text style={styles.statNumber}>{attachmentsCount}</Text>
                </View>
                <View style={styles.statItem}>
                  <Ionicons name="clipboard" size={24} color="#877ED2" />
                  <Text style={styles.statNumber}>{tasks.length}</Text>
                </View>
              </View>
            </View>

            {/* Status and Task Status Card (Merged) */}
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <Text style={styles.statusTitle}>Status</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>{getProjectStatus()}</Text>
                </View>
              </View>
              
              <View style={styles.datesRow}>
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>Start</Text>
                  <Text style={styles.dateValue}>{formatDate(project.start_date)}</Text>
                </View>
                <View style={styles.dateItem}>
                  <Text style={styles.dateLabel}>End</Text>
                  <Text style={styles.dateValue}>{formatDate(project.end_date)}</Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.progressText}>{progress}%</Text>
              </View>

              {/* Task Status Section within the same card */}
              <View style={styles.taskStatusSection}>
                <Text style={styles.taskStatusTitle}>Task Status ({tasks.length})</Text>
                
                <View style={styles.taskList}>
                  {displayedTasks.map((task, index) => {
                    const statusColor = getStatusColor(task.status, task.due_date);
                    const statusText = getStatusText(task.status, task.due_date);
                    
                    return (
                      <View key={task.id || index} style={styles.taskItem}>
                        <View style={styles.taskItemContent}>
                          <Text style={styles.taskName}>{task.title || 'Task'}</Text>
                          <View style={styles.taskMeta}>
                            <Text style={styles.taskDuration}>{task.duration}d</Text>
                            <Text style={[styles.taskStatusText, { color: statusColor }]}>
                              {statusText}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.taskStatusBar, { backgroundColor: statusColor }]} />
                      </View>
                    );
                  })}
                </View>

                {tasks.length > 4 && (
                  <TouchableOpacity 
                    style={styles.moreTaskButton}
                    onPress={() => setShowMoreTasks(!showMoreTasks)}
                  >
                    <Text style={styles.moreTaskText}>
                      {showMoreTasks ? 'Show Less' : 'More Task'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Tasks Section */}
            <View style={styles.tasksSection}>
              <View style={styles.tasksHeader}>
                <Text style={styles.tasksTitle}>Task</Text>
                <TouchableOpacity 
                  style={styles.allButton}
                  onPress={() => navigation.navigate('ProjectTasks', { projectId: id, projectName: project?.name })}
                >
                  <Text style={styles.allButtonText}>All</Text>
                  <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
                </TouchableOpacity>
              </View>
              {tasks.length > 0 ? (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.tasksScrollContent}
                >
                  {tasks.map((task) => {
                    // Handle assigned_employees if it's a string (JSON) or array
                    let assignedEmployees = task.assigned_employees || [];
                    if (typeof assignedEmployees === 'string') {
                      try {
                        assignedEmployees = JSON.parse(assignedEmployees);
                      } catch (e) {
                        assignedEmployees = [];
                      }
                    }
                    const taskAttachments = task.attachments || [];
                    
                    // Get status badge color
                    const getTaskStatusColor = (status: string) => {
                      switch (status) {
                        case 'Completed':
                          return '#34C759';
                        case 'Active':
                          return '#877ED2';
                        case 'Cancelled':
                          return '#FF3B30';
                        case 'On Hold':
                          return '#FF9500';
                        case 'To Do':
                          return '#8E8E93';
                        default:
                          return '#8E8E93';
                      }
                    };

                    // Format date
                    const formatTaskDate = (dateString: string) => {
                      if (!dateString) return 'N/A';
                      const date = new Date(dateString);
                      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                      return `${date.getDate()} ${months[date.getMonth()]}, ${date.getFullYear()}`;
                    };

                    // Get status text
                    const getTaskStatusText = (status: string) => {
                      switch (status) {
                        case 'Completed':
                          return 'Completed';
                        case 'Active':
                          return 'Active';
                        case 'Cancelled':
                          return 'Cancelled';
                        case 'On Hold':
                          return 'On Hold';
                        case 'To Do':
                          return 'To Do';
                        default:
                          return 'To Do';
                      }
                    };

                    return (
                      <TouchableOpacity
                        key={task.id}
                        style={styles.taskCard}
                        onPress={() => navigation.navigate('TaskView', { taskId: task.id, projectId: id, projectName: project?.name })}
                      >
                        {/* Status Badge */}
                        <View style={[styles.statusBadge, { backgroundColor: getTaskStatusColor(task.status) }]}>
                          <Text style={styles.statusBadgeText}>{getTaskStatusText(task.status)}</Text>
                        </View>

                        {/* Location/Client */}
                        <Text style={styles.taskLocation}>
                          {project?.client_name 
                            ? `${project.client_name}, ${project?.location || 'yelahanka'}`.toLowerCase()
                            : project?.location || 'Yelahanka, Bangalore'}
                        </Text>

                        {/* Task Title */}
                        <Text style={styles.taskTitle} numberOfLines={2}>
                          {task.title || 'Task'}
                        </Text>

                        {/* Assigned Date */}
                        <View style={styles.taskDateRow}>
                          <Text style={styles.taskDateLabel}>Assigned date</Text>
                          <Text style={styles.taskDateValue}>
                            {formatTaskDate(task.created_at) || 'N/A'}
                          </Text>
                        </View>

                        {/* Due Date */}
                        <View style={styles.taskDateRow}>
                          <Text style={styles.taskDateLabel}>Due date</Text>
                          <Text style={styles.taskDateValue}>
                            {formatTaskDate(task.due_date) || 'N/A'}
                          </Text>
                        </View>

                        {/* Footer Icons */}
                        <View style={styles.taskFooter}>
                          <View style={styles.taskStatItem}>
                            <Ionicons name="people" size={16} color="#877ED2" />
                            <Text style={styles.taskStatNumber}>{assignedEmployees.length || 0}</Text>
                          </View>
                          <View style={styles.taskStatItem}>
                            <Ionicons name="document-text" size={16} color="#877ED2" />
                            <Text style={styles.taskStatNumber}>{taskAttachments.length || 0}</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.noTasksContainer}>
                  <Text style={styles.noTasksText}>No tasks available in this project</Text>
                </View>
              )}
            </View>

            {/* View All Tasks Button */}
            <TouchableOpacity
              style={styles.viewTasksButton}
              onPress={() => navigation.navigate('ProjectTasks', { projectId: id, projectName: project?.name })}
            >
              <Text style={styles.viewTasksText}>View All Tasks →</Text>
            </TouchableOpacity>

            {/* Productivity Section */}
            <View style={styles.productivitySection}>
              <Text style={styles.productivityTitle}>Productivity</Text>
              
              {/* Department Filters */}
              <View style={styles.productivityCard}>
              <View style={styles.productivityFilters}>
                <Text style={styles.productivityFiltersLabel}>Productivity by Department</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.productivityFiltersScroll}
                >
                  {getDepartments().map((dept) => (
                    <TouchableOpacity
                      key={dept}
                      style={[
                        styles.productivityFilterButton,
                        selectedDepartment === dept && styles.productivityFilterButtonActive
                      ]}
                      onPress={() => setSelectedDepartment(dept)}
                    >
                      <Text style={[
                        styles.productivityFilterButtonText,
                        selectedDepartment === dept && styles.productivityFilterButtonTextActive
                      ]}>
                        {dept}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Productivity Card */}
              
                {/* Header with toggles and navigation */}
                <View style={styles.productivityCardHeader}>
                  {/* First Row: Toggles */}
                  <View style={styles.productivityHeaderTopRow}>
                    {/* Left: Week/Month Toggle */}
                    <View style={styles.productivityHeaderLeft}>
                      <View style={styles.productivityViewToggle}>
                        <TouchableOpacity
                          style={[styles.productivityToggleButton, productivityView === 'week' && styles.productivityToggleButtonActive]}
                          onPress={() => setProductivityView('week')}
                        >
                          <Text style={[styles.productivityToggleText, productivityView === 'week' && styles.productivityToggleTextActive]}>Week</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.productivityToggleButton, productivityView === 'month' && styles.productivityToggleButtonActive]}
                          onPress={() => setProductivityView('month')}
                        >
                          <Text style={[styles.productivityToggleText, productivityView === 'month' && styles.productivityToggleTextActive]}>Month</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Right: Chart Type Toggle */}
                    <View style={styles.productivityChartToggle}>
                      <TouchableOpacity
                        style={[styles.productivityChartToggleButton, chartView === 'bar' && styles.productivityChartToggleButtonActive]}
                        onPress={() => setChartView('bar')}
                      >
                        <Ionicons name="bar-chart" size={20} color={chartView === 'bar' ? '#877ED2' : '#8E8E93'} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.productivityChartToggleButton, chartView === 'list' && styles.productivityChartToggleButtonActive]}
                        onPress={() => setChartView('list')}
                      >
                        <Ionicons name="list" size={20} color={chartView === 'list' ? '#877ED2' : '#8E8E93'} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Second Row: Week/Month Navigation */}
                  <View style={styles.productivityWeekNav}>
                    <TouchableOpacity onPress={() => navigateWeek('prev')} style={styles.productivityNavButton}>
                      <Ionicons name="chevron-back" size={20} color="#000000" />
                    </TouchableOpacity>
                    <View style={styles.productivityWeekNavText}>
                      <Text style={styles.productivityWeekRange}>{getProductivityWeekRange()}</Text>
                    </View>
                    <TouchableOpacity onPress={() => navigateWeek('next')} style={styles.productivityNavButton}>
                      <Ionicons name="chevron-forward" size={20} color="#000000" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Bar Chart */}
                {chartView === 'bar' && (
                  <View style={styles.productivityChartContainer}>
                    <View style={styles.productivityChart}>
                      {productivityData.map((item, index) => {
                        const barHeightPercent = maxHours > 0 && item.hours > 0 ? (item.hours / maxHours) * 100 : 0;
                        const fillHeight = item.hours > 0 ? Math.max((barHeightPercent / 100) * 100, 4) : 4;
                        const fillColor = item.hours > 0 ? '#877ED2' : '#E5E5EA';
                        
                        return (
                          <View key={index} style={styles.productivityBarColumn}>
                            <Text style={[styles.productivityBarValue, item.hours === 0 && styles.productivityBarValueZero]}>
                              {Math.round(item.hours)}
                            </Text>
                            <View style={styles.productivityBarWrapper}>
                              <View style={styles.productivityBarBackground} />
                              <View 
                                style={[
                                  styles.productivityBarFill, 
                                  { 
                                    height: fillHeight,
                                    backgroundColor: fillColor
                                  }
                                ]} 
                              />
                            </View>
                            <View style={styles.productivityBarLabels}>
                              <Text style={styles.productivityBarDay}>{item.day}</Text>
                              <Text style={styles.productivityBarDate}>{item.date}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* Summary Statistics */}
                <View style={styles.productivitySummary}>
                  <View style={styles.productivitySummaryLeft}>
                    <Text style={styles.productivitySummaryLabel}>Time worked</Text>
                    <View style={styles.productivitySummaryHours}>
                      <Text style={styles.productivitySummaryHoursNumber}>
                        {Math.round(totalHours * 10) / 10}
                      </Text>
                      <Text style={styles.productivitySummaryHoursUnit}>
                        {' hr / '}
                        {daysWithWork}
                        {productivityView === 'week' ? ' d' : ' days'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.productivitySummaryRight}>
                    <Text style={styles.productivitySummaryLabel}>Task</Text>
                    <Text style={styles.productivitySummaryValue}>{totalTasks}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Team Section - Admin can manage team */}
            <View style={styles.teamSection}>
              <View style={styles.teamCard}>
                <View style={styles.teamCardHeader}>
                  <Text style={styles.teamCardTitle}>Team</Text>
                  <TouchableOpacity onPress={handleAddMember} style={styles.addMemberButton}>
                    <Ionicons name="add" size={20} color="#877ED2" />
                    <Text style={styles.addMemberText}>Add</Text>
                  </TouchableOpacity>
                </View>
                {teamMembersWithTime.map((member) => {
                  const memberName = `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.employee_id || 'Unknown';
                  const memberRole = member.role || member.department || 'Member';
                  
                  return (
                    <View key={member.id} style={styles.teamMemberRow}>
                      <View style={styles.avatarContainer}>
                        {member.avatar ? (
                          <Image source={{ uri: member.avatar }} style={styles.avatarImage} />
                        ) : (
                          <View style={[styles.avatarPlaceholder, { backgroundColor: getAvatarColor(memberName) }]}>
                            <Text style={styles.avatarText}>{getInitials(memberName)}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.teamMemberInfo}>
                        <Text style={styles.teamMemberName}>{memberName}</Text>
                        <Text style={styles.teamMemberRole}>{memberRole}</Text>
                      </View>
                      <View style={styles.teamMemberActions}>
                        <Text style={styles.teamMemberTime}>
                          {formatTime(member.hours || 0, member.minutes || 0)}
                        </Text>
                        <TouchableOpacity 
                          style={styles.removeMemberButton}
                          onPress={() => handleRemoveMember(member.id, memberName)}
                        >
                          <Ionicons name="close" size={16} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
                {teamMembersWithTime.length === 0 && (
                  <Text style={styles.noTeamText}>No team members assigned</Text>
                )}
              </View>
            </View>

            {/* Attachments Section */}
            <View style={styles.attachmentsSection}>
              <Text style={styles.attachmentsTitle}>Attachments</Text>
              {projectAttachments.length > 0 ? (
                (() => {
                  const categorized = categorizeAttachments(projectAttachments);
                  return (
                    <>
                      <View style={styles.attachmentCategories}>
                        {Object.entries(categorized).map(([category, items]) => (
                          items.length > 0 && (
                            <View key={category} style={styles.categoryBadge}>
                              <Text style={styles.categoryBadgeText}>
                                {category} {items.length}
                              </Text>
                            </View>
                          )
                        ))}
                      </View>
                      <View style={styles.attachmentsGrid}>
                        {projectAttachments.map((attachment, index) => (
                          <View key={index} style={styles.attachmentCard}>
                            <Ionicons 
                              name={getFileIcon(attachment.mime_type) as any} 
                              size={24} 
                              color="#877ED2" 
                            />
                            <Text style={styles.attachmentFileName} numberOfLines={2}>
                              {attachment.original_name || 'Attachment'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </>
                  );
                })()
              ) : (
                <Text style={styles.noAttachmentsText}>No attachments available</Text>
              )}
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Add Member Modal - Admin specific */}
      <Modal
        visible={showAddMemberModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddMemberModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Team Member</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddMemberModal(false);
                  setSelectedEmployee(null);
                }}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={availableEmployees}
              keyExtractor={(item) => String(item.id || item.employee_id)}
              contentContainerStyle={styles.modalListContent}
              renderItem={({ item }) => {
                const displayName = (item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim()).trim() || item.employee_id || 'Employee';
                const initials = displayName
                  .split(/\s+/)
                  .filter(Boolean)
                  .map((part: string) => part[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                const department = item.department || item.role || 'No Department';
                return (
                  <TouchableOpacity
                    style={[
                      styles.modalEmployeeItem,
                      selectedEmployee === item.id && styles.modalEmployeeItemSelected
                    ]}
                    onPress={() => setSelectedEmployee(item.id)}
                  >
                    <View style={[styles.modalAvatar, { backgroundColor: getAvatarColor(displayName) }]}>
                      <Text style={styles.modalAvatarText}>{initials}</Text>
                    </View>
                    <View style={styles.modalEmployeeInfo}>
                      <Text style={styles.modalEmployeeName}>{displayName}</Text>
                      <Text style={styles.modalEmployeeDepartment}>{department}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <View style={styles.modalEmpty}>
                  <Text style={styles.modalEmptyText}>No available employees to add</Text>
                </View>
              }
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[
                  styles.modalAddButton,
                  !selectedEmployee && styles.modalAddButtonDisabled
                ]}
                onPress={handleSelectEmployee}
                disabled={!selectedEmployee}
              >
                <Text style={styles.modalAddButtonText}>Add to Team</Text>
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
  errorText: {
    fontSize: 18,
    color: '#FF3B30',
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#877ED2',
    paddingTop: 12,
    paddingBottom: 140,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    position: 'relative',
    zIndex: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 2,
  },
  cardContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
    pointerEvents: 'box-none',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 168,
    paddingBottom: 20,
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 20,
    zIndex: 10,
    marginBottom: 16,
  },
  overlappingCard: {
    marginTop: -80,
  },
  projectTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  description: {
    fontSize: 12,
    color: '#000000',
    lineHeight: 24,
    marginBottom: 20,
    fontWeight: '400',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  locationIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: '#877ED2',
    textDecorationLine: 'underline',
    lineHeight: 20,
    fontWeight: '400',
  },
  footerStats: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F5F6FA',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  statNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  statusPill: {
    backgroundColor: '#5AC8FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
    fontWeight: '400',
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#F5F6FA',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  taskStatusSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F5F6FA',
  },
  taskStatusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  taskList: {
    gap: 0,
  },
  taskItem: {
    marginBottom: 16,
  },
  taskItemContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  taskName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginRight: 12,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskDuration: {
    fontSize: 12,
    fontWeight: '400',
    color: '#8E8E93',
  },
  taskStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  taskStatusBar: {
    height: 2,
    borderRadius: 1,
  },
  moreTaskButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  moreTaskText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '400',
  },
  viewTasksButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  viewTasksText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tasksSection: {
    marginTop: 24,
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  tasksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tasksTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  allButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allButtonText: {
    fontSize: 16,
    color: '#8E8E93',
    marginRight: 4,
  },
  tasksScrollContent: {
    paddingRight: 16,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    width: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginBottom: 8,
    marginTop: -18,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  taskLocation: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
    fontWeight: '400',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
    lineHeight: 22,
  },
  taskDateRow: {
    flexDirection: 'column',
    marginBottom: 12,
  },
  taskDateLabel: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '400',
    marginBottom: 4,
  },
  taskDateValue: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '600',
  },
  taskFooter: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F6FA',
  },
  taskStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  taskStatNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 6,
  },
  noTasksContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noTasksText: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '400',
  },
  productivitySection: {
    marginTop: 24,
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  productivityTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  productivityFilters: {
    marginBottom: 16,
  },
  productivityFiltersLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
    fontWeight: '400',
  },
  productivityFiltersScroll: {
    paddingRight: 16,
  },
  productivityFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F6FA',
    marginRight: 8,
  },
  productivityFilterButtonActive: {
    backgroundColor: '#877ED2',
  },
  productivityFilterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  productivityFilterButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  productivityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  productivityCardHeader: {
    marginBottom: 16,
  },
  productivityHeaderTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  productivityHeaderLeft: {
    alignItems: 'flex-start',
  },
  productivityViewToggle: {
    flexDirection: 'row',
    backgroundColor: '#F5F6FA',
    borderRadius: 8,
    padding: 2,
  },
  productivityToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  productivityToggleButtonActive: {
    backgroundColor: '#877ED2',
  },
  productivityToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  productivityToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  productivityChartToggle: {
    flexDirection: 'row',
    backgroundColor: '#F5F6FA',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  productivityChartToggleButton: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productivityChartToggleButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  productivityWeekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-between',
    paddingVertical: 8,
    position: 'relative',
  },
  productivityNavButton: {
    zIndex: 1,
  },
  productivityWeekNavText: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 0,
  },
  productivityWeekRange: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  productivityChartContainer: {
    marginBottom: 16,
  },
  productivityChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 140,
    width: '100%',
  },
  productivityBarColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  productivityBarValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  productivityBarValueZero: {
    color: '#8E8E93',
  },
  productivityBarWrapper: {
    width: '80%',
    height: 100,
    justifyContent: 'flex-end',
    marginBottom: 8,
    position: 'relative',
    alignSelf: 'center',
    alignItems: 'center',
  },
  productivityBarBackground: {
    width: '40%',
    height: 100,
    borderRadius: 4,
    backgroundColor: '#E5E5EA',
    position: 'absolute',
    bottom: 0,
  },
  productivityBarFill: {
    width: '40%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    position: 'absolute',
    bottom: 0,
    minHeight: 4,
  },
  productivityBarLabels: {
    alignItems: 'center',
  },
  productivityBarDay: {
    fontSize: 12,
    fontWeight: '400',
    color: '#8E8E93',
  },
  productivityBarDate: {
    fontSize: 12,
    fontWeight: '400',
    color: '#8E8E93',
  },
  productivitySummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F5F6FA',
  },
  productivitySummaryLeft: {
    flex: 1,
  },
  productivitySummaryRight: {
    alignItems: 'flex-end',
  },
  productivitySummaryLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
    fontWeight: '400',
  },
  productivitySummaryHours: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  productivitySummaryHoursNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  productivitySummaryHoursUnit: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '400',
  },
  productivitySummaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  teamSection: {
    marginTop: 24,
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  teamCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  teamCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F6FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addMemberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#877ED2',
  },
  teamMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  teamMemberInfo: {
    flex: 1,
    marginRight: 12,
  },
  teamMemberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2,
  },
  teamMemberRole: {
    fontSize: 14,
    color: '#8E8E93',
    fontWeight: '400',
  },
  teamMemberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  teamMemberTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  removeMemberButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F6FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noTeamText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 16,
    fontWeight: '400',
  },
  attachmentsSection: {
    marginTop: 24,
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  attachmentsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 16,
  },
  attachmentCategories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  categoryBadge: {
    backgroundColor: '#F5F6FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  categoryBadgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  attachmentsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  attachmentCard: {
    width: '31%',
    backgroundColor: '#F5F6FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
  },
  attachmentFileName: {
    fontSize: 12,
    color: '#000000',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '400',
  },
  noAttachmentsText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 20,
    fontWeight: '400',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalListContent: {
    padding: 20,
  },
  modalEmployeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  modalEmployeeItemSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  modalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalEmployeeInfo: {
    flex: 1,
  },
  modalEmployeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalEmployeeDepartment: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  modalEmpty: {
    padding: 20,
    alignItems: 'center',
  },
  modalEmptyText: {
    fontSize: 16,
    color: '#666',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalAddButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalAddButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  modalAddButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});