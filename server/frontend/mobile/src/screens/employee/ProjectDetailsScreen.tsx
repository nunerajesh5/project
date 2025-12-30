import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, RefreshControl, Linking, BackHandler, Image } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { getProject, listProjectTasks, getProjectTeam, listTimeEntries } from '../../api/endpoints';
import { dashboardApi } from '../../api/dashboard';
import { api } from '../../api/client';
import SafeAreaWrapper from '../../components/shared/SafeAreaWrapper';
import { typography } from '../../design/tokens';

export default function ProjectDetailsScreen() {
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
  const [timeEntries, setTimeEntries] = useState<any[]>([]);

  const loadData = async () => {
    try {
      if (!id) return;
      
      // Load project data
      let projectData: any | null = null;
      try {
        const res = await getProject(id);
        projectData = res.project;
      } catch (e: any) {
        console.log('Error loading project:', e.message);
        return;
      }

      if (!projectData) return;
      setProject({
        ...projectData,
        client_name: projectData.client_name || 'Client',
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
        t.status?.toLowerCase() === 'done' || t.status?.toLowerCase() === 'completed'
      ).length;
      setProgress(formattedTasks.length > 0 ? Math.round((completed / formattedTasks.length) * 100) : 0);

      // Load team members
      try {
        const teamResponse = await getProjectTeam(id as string);
        const teamData = teamResponse?.teamMembers || [];
        setTeamMembers(teamData);
      } catch (e) {
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

      // Load time entries for team section
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
      console.error('Error loading project data:', error.message);
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

  const handleAddressPress = () => {
    const address = project?.client_address || project?.address || 'Doddaballapura Main Rd, Bengaluru, Karnataka 560119';
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.google.com/?q=${encodedAddress}`;
    Linking.openURL(url).catch(err => console.error('Error opening maps:', err));
  };

  // Categorize attachments
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

  // Get file icon based on mime type
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

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}, ${d.getFullYear()}`;
  };

  const getStatusColor = (status: string, dueDate?: string) => {
    const statusLower = status?.toLowerCase() || '';
    const now = new Date();
    
    // Check if task is delayed (overdue and not completed)
    if (dueDate && statusLower !== 'done' && statusLower !== 'completed') {
      const due = new Date(dueDate);
      if (due < now) {
        return '#FF3B30'; // Red for delayed
      }
    }
    
    switch (statusLower) {
      case 'done':
      case 'completed':
        return '#34C759'; // Green
      case 'in_progress':
      case 'in process':
        return '#5AC8FA'; // Blue
      case 'overdue':
        return '#FF3B30'; // Red
      case 'todo':
      case 'to do':
        return '#8E8E93'; // Grey
      default:
        return '#8E8E93';
    }
  };

  const getStatusText = (status: string, dueDate?: string) => {
    const statusLower = status?.toLowerCase() || '';
    const now = new Date();
    
    // Check if task is delayed (overdue and not completed)
    if (dueDate) {
      const due = new Date(dueDate);
      if (due < now && statusLower !== 'done' && statusLower !== 'completed') {
        const daysOverdue = Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
        return `Delayed ${daysOverdue}d`;
      }
    }
    
    switch (statusLower) {
      case 'done':
      case 'completed':
        return 'Complete';
      case 'in_progress':
      case 'in process':
        return 'In Process';
      case 'overdue':
        if (dueDate) {
          const due = new Date(dueDate);
          const daysOverdue = Math.ceil((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
          return `Delayed ${daysOverdue}d`;
        }
        return 'Delayed';
      case 'todo':
      case 'to do':
        return 'To Do';
      default:
        return 'To Do';
    }
  };

  const getProjectStatus = () => {
    if (!project?.status) return 'In Progress';
    const status = project.status.toLowerCase();
    if (status === 'active' || status === 'in_progress') return 'In Progress';
    if (status === 'completed' || status === 'done') return 'Completed';
    if (status === 'on_hold') return 'On Hold';
    return 'In Progress';
  };

  const displayedTasks = showMoreTasks ? tasks : tasks.slice(0, 4);

  // Team members with time calculation
  const getTeamMembersWithTime = () => {
    return teamMembers.map(member => {
      const memberTimeEntries = timeEntries.filter(entry => entry.employee_id === member.id);
      const totalMinutes = memberTimeEntries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      return {
        ...member,
        hours,
        minutes,
        totalMinutes,
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
      '#B99696',
      '#FF9500', // Orange
      '#5AC8FA', // Light blue
      '#8DBDC3',
      '#96A9B9',
      '#FF3B30', // Red
      '#8DBDC3',
      '#9FB996',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const formatTime = (hours: number, minutes: number) => {
    const hrs = hours.toString().padStart(2, '0');
    const mins = minutes.toString().padStart(2, '0');
    return `${hrs}hr ${mins}min`;
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
    <SafeAreaWrapper backgroundColor="#F5F5F8">
      <View style={styles.container}>
        {/* Fixed Header with Purple Background */}
        <View style={styles.fixedHeader}>
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
            {/* Purple Background Section (100px height) */}
            <View style={styles.purpleBackgroundSection}>
              <View style={styles.purpleBackgroundSpacer} />
            </View>
            
            {/* Project Information Card */}
            <View style={[styles.contentCard, styles.overlappingCard]}>
              {/* Project Location */}
              {project.location && (
                <Text style={styles.projectLocation}>{project.location}</Text>
              )}

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
                  {project.client_address || project.address || 'Doddaballapura Main Rd, Bengaluru, Karnataka 560119'}
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

            {/* Tasks Section */}
            <View style={styles.tasksSection}>
              <View style={styles.tasksHeader}>
                <Text style={styles.tasksTitle}>Task</Text>
                <TouchableOpacity 
                  style={styles.allButton}
                  onPress={() => navigation.navigate('EmployeeAllTasks', { projectId: id })}
                >
                  <Text style={styles.allButtonText}>All</Text>
                  <Ionicons name="chevron-forward" size={20} color="#8F8F8F" />
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
                      switch (status?.toLowerCase()) {
                        case 'new':
                          return '#34C759';
                        case 'in progress':
                        case 'in_progress':
                        case 'in process':
                          return '#5AC8FA';
                        case 'completed':
                        case 'done':
                          return '#007AFF';
                        case 'on hold':
                        case 'on_hold':
                          return '#FF9500';
                        default:
                          return '#8E8E93';
                      }
                    };

                    // Format date
                    const formatTaskDate = (dateString: string | null | undefined) => {
                      if (!dateString) return 'N/A';
                      try {
                        const date = new Date(dateString);
                        // Check if date is valid
                        if (isNaN(date.getTime())) return 'N/A';
                        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                        return `${date.getDate()} ${months[date.getMonth()]}, ${date.getFullYear()}`;
                      } catch (error) {
                        return 'N/A';
                      }
                    };

                    // Get status text
                    const getTaskStatusText = (status: string) => {
                      const statusLower = status?.toLowerCase() || '';
                      switch (statusLower) {
                        case 'done':
                        case 'completed':
                          return 'Completed';
                        case 'in_progress':
                        case 'in progress':
                        case 'in process':
                          return 'In Progress';
                        case 'on_hold':
                        case 'on hold':
                          return 'On Hold';
                        case 'new':
                          return 'New';
                        default:
                          return 'New';
                      }
                    };

                    return (
                      <TouchableOpacity
                        key={task.id}
                        style={styles.taskCard}
                        onPress={() => navigation.navigate('TaskDetails', { taskId: task.id })}
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
                            {formatTaskDate(task.created_at)}
                          </Text>
                        </View>

                        {/* Due Date */}
                        <View style={styles.taskDateRow}>
                          <Text style={styles.taskDateLabel}>Due date</Text>
                          <Text style={styles.taskDateValue}>
                            {formatTaskDate(task.due_date || task.dueDate || task.end_date || task.endDate)}
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

            {/* Team Section */}
            <Text style={styles.teamCardTitle}>Team</Text>
            <View style={styles.teamSection}>
              <View style={styles.teamCard}>
                <View style={styles.teamCardHeader}>
                  
                  <Text style={styles.teamCardTotalTime}>Total Time</Text>
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
                      <View style={styles.teamMemberTimeContainer}>
                        <Text style={styles.teamMemberTimeNumber}>
                          {(member.hours || 0).toString().padStart(2, '0')}
                        </Text>
                        <Text style={styles.teamMemberTimeUnit}>hr </Text>
                        <Text style={styles.teamMemberTimeNumber}>
                          {(member.minutes || 0).toString().padStart(2, '0')}
                        </Text>
                        <Text style={styles.teamMemberTimeUnit}>min</Text>
                      </View>
                    </View>
                  );
                })}
                <TouchableOpacity 
                  style={styles.manageTeamButton}
                  onPress={() => {
                    // Navigate to manage team screen if available
                    // navigation.navigate('ManageTeam', { projectId: id });
                  }}
                >
                  <Ionicons name="settings-outline" size={16} color="#877ED2" />
                  <Text style={styles.manageTeamText}>Manage Team</Text>
                </TouchableOpacity>
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
  fixedHeader: {
    backgroundColor: '#877ED2',
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 16,
    zIndex: 100,
    elevation: 5,
  },
  header: {
    // backgroundColor: '#877ED2',
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
    fontSize: 20,
    fontWeight: '400',
    fontFamily: typography.families.regular,
    color: '#FFFFFF',
    marginLeft: 2,
  },
  cardContainer: {
    flex: 1,
    // backgroundColor: '#877ED2',
  },
  scrollView: {
    flex: 1,
    backgroundColor: 'transparent',
    // backgroundColor: 'transparent',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 20,
  },
  purpleBackgroundSection: {
    backgroundColor: '#877ED2',
    height: 150,
    marginTop: -16,
    marginHorizontal: -16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: -40,
  },
  purpleBackgroundSpacer: {
    height: 60,
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
    marginBottom: 16,
  },
  overlappingCard: {
    marginTop: -70,
    zIndex: 10,
  },
  projectLocation: {
    fontSize: 10,
    color: '#727272',
    marginBottom: 2,
    fontFamily: typography.families.regular,
    fontWeight: '400',
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#404040',
    marginBottom: 12,
    height: 32,
    fontFamily: typography.families.medium,
  },
  description: {
    fontSize: 12,
    color: '#8F8F8F',
    lineHeight: 24,
    marginBottom: 14,
    fontWeight: '400',
    fontFamily: typography.families.regular,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  locationIcon: {
    marginRight: 4,
    marginTop: 2,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: '#404040',
    textDecorationLine: 'underline',
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: typography.families.regular,
  },
  footerStats: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingTop: 6,
    borderTopColor: '#F5F6FA',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  statNumber: {
    fontSize: 12,
    fontWeight: '400',
    fontFamily: typography.families.regular,
    color: '#727272',
    marginLeft: 8,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
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
    fontSize: 16,
    fontWeight: '500',
    fontFamily: typography.families.medium,
    color: '#404040',
  },
  statusPill: {
    backgroundColor: '#7E99D2',
    borderRadius: 12,
    width: 70,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: typography.families.regular,
  },
  datesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  dateItem: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 12,
    color: '#727272',
    marginBottom: 4,
    fontWeight: '400',
    fontFamily: typography.families.regular,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: typography.families.medium,
    color: '#404040',
  },
  progressContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#F5F6FA',
    borderRadius: 4,
    overflow: 'visible',
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 4,
  },
  progressTextContainer: {
    position: 'absolute',
    top: -18,
    marginLeft: -26,
    zIndex: 1,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: typography.families.medium,
    color: '#727272',
  },
  taskStatusSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#F5F6FA',
  },
  taskStatusCard: {
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
  taskStatusTitle: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: typography.families.medium,
    color: '#404040',
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
    fontSize: 12,
    fontWeight: '400',
    fontFamily: typography.families.regular,
    color: '#404040',
    marginRight: 12,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskDuration: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4C4C4C',
    fontFamily: typography.families.medium,
  },
  taskStatusText: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: typography.families.medium,
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
    fontSize: 12,
    color: '#8F8F8F',
    fontWeight: '400',
    fontFamily: typography.families.regular,
  },
  tasksSection: {
    marginTop: 24,
    paddingBottom: 20,
    height: 320,
  },
  tasksHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tasksTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#000000',
    fontFamily: typography.families.medium,
  },
  allButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  allButtonText: {
    fontSize: 16,
    color: '#8F8F8F',
    fontFamily: typography.families.regular,
    fontWeight: '400',
    marginRight: 4,
  },
  tasksScrollContent: {
    paddingRight: 16,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginRight: 12,
    width: 280,
    height: 250,
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
    fontWeight: '500',
    color: '#404040',
    fontFamily: typography.families.medium,
    marginBottom: 12,
    lineHeight: 22,
  },
  taskDateRow: {
    flexDirection: 'column',
    marginBottom: 12,
  },
  taskDateLabel: {
    fontSize: 10,
    color: '#727272',
    fontWeight: '400',
    fontFamily: typography.families.regular,
  },
  taskDateValue: {
    fontSize: 12,
    color: '#404040',
    fontWeight: '500',
    fontFamily: typography.families.medium,
    height: 16,
  },
  taskFooter: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 12,
    borderTopColor: '#F5F6FA',
  },
  taskStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  taskStatNumber: {
    fontSize: 12,
    fontWeight: '400',
    color: '#727272',
    marginLeft: 6,
    fontFamily: typography.families.regular,
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
  teamSection: {
    marginTop: 24,
    paddingHorizontal: 0,
    paddingBottom: 20,
  },
  teamCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  teamCardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamCardTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#000000',
    fontFamily: typography.families.medium,
    paddingLeft: 4,
    marginBottom: -6,
  },
  teamCardTotalTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
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
  teamMemberTimeContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  teamMemberTimeNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000000',
    fontFamily: typography.families.medium,
  },
  teamMemberTimeUnit: {
    fontSize: 10,
    fontWeight: '400',
    color: '#727272',
    fontFamily: typography.families.regular,
    marginRight: 2,
  },
  manageTeamButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingTop: 16,
    borderTopColor: '#F5F6FA',
  },
  manageTeamText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#404040',
    fontFamily: typography.families.medium,
    marginLeft: 6,
  },
  attachmentsSection: {
    marginTop: 24,
    paddingBottom: 20,
  },
  attachmentsTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#000000',
    fontFamily: typography.families.medium,
    marginBottom: 16,
  },
  attachmentCategories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  categoryBadge: {
    backgroundColor: '#F5F6FA',
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
    justifyContent: 'flex-start',
    gap: 13,
  },
  attachmentCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 4,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 0,
  },
  attachmentFileName: {
    fontSize: 10,
    color: '#727272',
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '400',
    fontFamily: typography.families.regular,
  },
  noAttachmentsText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    paddingVertical: 20,
    fontWeight: '400',
  },
});
