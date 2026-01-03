import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, RefreshControl, Alert, Modal, FlatList } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import { getProject, listTimeEntries, listProjectTasks, getProjectTeam, addProjectTeamMember, removeProjectTeamMember, listEmployees } from '../../api/endpoints';
import { dashboardApi } from '../../api/dashboard';
import Card from '../../components/shared/Card';

export default function ProjectDetailsScreen() {
  const route = useRoute<any>();
  const { id } = route.params || {};
  const { user } = useContext(AuthContext);
  const navigation = useNavigation<any>();
  
  const [project, setProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [taskSummary, setTaskSummary] = useState({ total: 0, completed: 0, overdue: 0 });
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableEmployees, setAvailableEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  const loadData = async () => {
    try {
      // Load project data
      const res = await getProject(id);
      const apiProject = res.project;
      setProject({
        ...apiProject,
        client_name: apiProject.client_name || 'Client',
        due_date: apiProject.end_date ? new Date(apiProject.end_date) : null,
        start_date: apiProject.start_date ? new Date(apiProject.start_date) : null,
      });

      // Load tasks
      const taskRes = await listProjectTasks(String(id), 1, 200);
      const tasks = taskRes.tasks || [];
      let completed = 0, onHold = 0;
      for (const t of tasks) {
        const st = t.status || '';
        if (st === 'Completed') completed++;
        if (st === 'On Hold') onHold++;
      }
      const total = tasks.length;
      setTaskSummary({ total, completed, overdue: onHold });
      
      // Calculate progress
      setProgress(total > 0 ? Math.round((completed / total) * 100) : 0);

      // Load team members from the new project_team_memberships table
      try {
        console.log('📡 Loading team from project_team_memberships table...');
        const teamResponse = await getProjectTeam(id as string);
        const teamData = teamResponse?.teamMembers || [];
        
        console.log(`✅ Team members from database: ${teamData.length}`);
        
        // Get stats for each team member to include hours logged
        const stats = await dashboardApi.getProjectStats(id as string);
        const employeeBreakdown = stats?.employeeBreakdown || [];
        
        // Map team members with their hours logged
        const teamMembersData = teamData.map((member: any) => {
          const statsForMember = employeeBreakdown.find((emp: any) => emp.id === member.id);
          return {
            name: `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.employee_id,
            department: member.department || 'N/A',
            hours: statsForMember ? Math.round(((statsForMember.totalMinutes || 0) / 60) * 10) / 10 : 0,
            cost: statsForMember?.totalCost || 0,
            role: member.role || 'member',
          };
        });
        
        setTeamMembers(teamMembersData);
        console.log('✅ Team members with stats loaded:', teamMembersData.length);
      } catch (e: any) {
        console.log('❌ Team members query failed:', e.message);
        console.log('🔄 Falling back to stats-based team loading...');
        
        // Fallback to old method if new endpoint fails
        try {
          const stats = await dashboardApi.getProjectStats(id as string);
          const employeeBreakdown = stats?.employeeBreakdown || [];
          setTeamMembers(employeeBreakdown.map((emp: any) => ({
            name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.employee_id,
            department: emp.department || 'N/A',
            hours: Math.round((emp.totalMinutes ?? 0) / 60 * 10) / 10,
            cost: emp.totalCost ?? 0,
          })));
        } catch (fallbackError) {
          setTeamMembers([]);
        }
      }

      // Generate recent activity from time entries
      const entriesRes = await listTimeEntries({ projectId: id, limit: 10, page: 1 });
      const entries = entriesRes.timeEntries || [];
      setRecentActivity(entries.slice(0, 5).map((entry: any, idx: number) => ({
        id: idx + 1,
        type: 'time_logged',
        user: entry.employee_name || 'Team Member',
        action: 'logged hours',
        hours: Math.round((entry.duration_minutes || 0) / 60 * 10) / 10,
        timestamp: entry.start_time ? new Date(entry.start_time) : new Date(),
      })));

    } catch (error: any) {
      console.error('Error loading project data:', error);
    }
  };

  useEffect(() => {
    if (id) {
      loadData().finally(() => setLoading(false));
    }
  }, [id, user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

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
      await addProjectTeamMember(id as string, selectedEmployee, 'member');
      Alert.alert('Success', 'Team member added successfully');
      setShowAddMemberModal(false);
      setSelectedEmployee(null);
      await loadData();
    } catch (error: any) {
      console.error('Error adding team member:', error);
      Alert.alert('Error', error.response?.data?.error || 'Failed to add team member');
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

  const formatDate = (date: Date | string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDaysOverdue = () => {
    if (!project?.end_date) return null;
    const now = new Date();
    const dueDate = new Date(project.end_date);
    const diff = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : null;
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

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

  const overdueBy = getDaysOverdue();

  return (
    <View style={{ flex: 1 }}>
      <ScrollView 
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
      {/* Main Content */}
      <View style={styles.mainContainer}>
        {/* Project Details */}
        <View style={styles.leftColumn}>
          <Card style={styles.detailCard}>
            {/* Project Info */}
            <View style={styles.rowSection}>
              <View style={styles.halfSection}>
                <Text style={styles.label}>Project name</Text>
                <Text style={styles.value}>{project.name}</Text>
              </View>

              <View style={styles.halfSection}>
                <Text style={styles.label}>Client name</Text>
                <Text style={styles.value}>{project.client_name}</Text>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Location</Text>
              <View style={styles.locationContainer}>
                <Text style={styles.locationIcon}>📍</Text>
                <Text style={styles.locationValue}>{project.location || 'Not specified'}</Text>
              </View>
            </View>

            {/* Dates Section */}
            <View style={styles.datesContainer}>
              <View style={styles.dateItem}>
                <Text style={styles.label}>Started on</Text>
                <Text style={styles.value}>{formatDate(project.start_date)}</Text>
              </View>
              <View style={styles.dateItem}>
                <Text style={styles.label}>Due on</Text>
                <Text style={styles.value}>{formatDate(project.end_date)}</Text>
              </View>
            </View>

            {/* Overdue Section */}
            {overdueBy && (
              <View style={styles.section}>
                <Text style={styles.label}>Overdue by</Text>
                <Text style={[styles.value, styles.overdueText]}>{overdueBy} days</Text>
              </View>
            )}
          </Card>

          {/* Status Section */}
          <Card style={styles.statusCard}>
            <View style={styles.section}>
              <Text style={styles.label}>Status</Text>
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.progressText}>{progress}% complete</Text>
              </View>
            </View>
          </Card>

          {/* Task Summary */}
          <View style={styles.taskSummaryContainer}>
            <Card style={[styles.taskBox, styles.taskBoxTotal]}>
              <Text style={styles.taskNumber}>{taskSummary.total}</Text>
              <Text style={styles.taskLabel}>Task</Text>
            </Card>
            <Card style={[styles.taskBox, styles.taskBoxCompleted]}>
              <Text style={styles.taskNumber}>{taskSummary.completed}</Text>
              <Text style={styles.taskLabel}>Completed</Text>
            </Card>
            <Card style={[styles.taskBox, styles.taskBoxOverdue]}>
              <Text style={styles.taskNumber}>{taskSummary.overdue}</Text>
              <Text style={styles.taskLabel}>Overdue</Text>
            </Card>
          </View>

          {/* View Tasks Button */}
          <TouchableOpacity
            style={styles.viewTasksButton}
            onPress={() => navigation.navigate('ProjectTasks', { projectId: id, projectName: project?.name })}
          >
            <Text style={styles.viewTasksText}>View All Tasks →</Text>
          </TouchableOpacity>

          {/* Right Sidebar - Team & Activity (moved here) */}
          <View style={styles.rightColumn}>
            {/* Team Management */}
            <Card style={styles.sidebarCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={styles.sidebarTitle}>Team Management</Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: '#007AFF',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  onPress={handleAddMember}
                >
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>+</Text>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Add</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.teamTable}>
                <View style={styles.teamTableHeader}>
                  <Text style={styles.teamTableHeaderText}>Name</Text>
                  <Text style={styles.teamTableHeaderText}>Dept</Text>
                  <Text style={styles.teamTableHeaderText}>hours</Text>
                  <Text style={styles.teamTableHeaderText}></Text>
                </View>
                {teamMembers.length > 0 ? (
                  teamMembers.map((member, index) => (
                    <View key={index} style={styles.teamTableRow}>
                      <Text style={styles.teamTableData}>{member.name}</Text>
                      <Text style={styles.teamTableData}>{member.department}</Text>
                      <Text style={styles.teamTableData}>{member.hours}h</Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveMember(member.id || '', member.name || 'Unknown')}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: '#FF3B30',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noTeamText}>No team members assigned</Text>
                )}
              </View>
            </Card>

            {/* Recent Activity */}
            <Card style={styles.sidebarCard}>
              <Text style={styles.sidebarTitle}>Recent activity</Text>
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <View key={activity.id} style={styles.activityItem}>
                    <Text style={styles.activityText}>
                      {activity.user} logged {activity.hours}h
                    </Text>
                    <Text style={styles.activityTime}>{formatTimeAgo(activity.timestamp)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.noActivityText}>No recent activity</Text>
              )}
            </Card>
          </View>
        </View>
      </View>
      </ScrollView>

      {/* Add Member Modal */}
      <Modal
        visible={showAddMemberModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddMemberModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}>
          <View style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: 20,
            maxHeight: '80%',
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#e5e7eb',
            }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: '#333' }}>
                Select Team Member
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setShowAddMemberModal(false);
                  setSelectedEmployee(null);
                }}
              >
                <Text style={{ fontSize: 24, color: '#666' }}>×</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={availableEmployees}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 20 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 16,
                    backgroundColor: selectedEmployee === item.id ? '#e3f2fd' : '#f9fafb',
                    borderRadius: 12,
                    marginBottom: 12,
                    borderWidth: selectedEmployee === item.id ? 2 : 1,
                    borderColor: selectedEmployee === item.id ? '#007AFF' : '#e5e7eb',
                  }}
                  onPress={() => setSelectedEmployee(item.id)}
                >
                  <View style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: '#007AFF',
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: 12,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
                      {item.name.charAt(0)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#333' }}>
                      {item.name}
                    </Text>
                    <Text style={{ fontSize: 14, color: '#666', marginTop: 2 }}>
                      {item.department || 'No Department'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, color: '#666' }}>
                    No available employees to add
                  </Text>
                </View>
              }
            />

            <View style={{
              padding: 20,
              borderTopWidth: 1,
              borderTopColor: '#e5e7eb',
            }}>
              <TouchableOpacity
                style={{
                  backgroundColor: selectedEmployee ? '#007AFF' : '#d1d5db',
                  paddingVertical: 14,
                  borderRadius: 10,
                  alignItems: 'center',
                }}
                onPress={handleSelectEmployee}
                disabled={!selectedEmployee}
              >
                <Text style={{
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: '600',
                }}>
                  Add to Team
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
  mainContainer: {
    padding: 16,
  },
  leftColumn: {
    width: '100%',
  },
  rightColumn: {
    width: '100%',
    marginTop: 16,
  },
  detailCard: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  rowSection: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
  },
  halfSection: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  locationValue: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  datesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16,
  },
  dateItem: {
    flex: 1,
  },
  overdueText: {
    color: '#FF3B30',
  },
  statusCard: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 16,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34C759',
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  taskSummaryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  taskBox: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskBoxTotal: {
    backgroundColor: '#f0f0f0',
  },
  taskBoxCompleted: {
    backgroundColor: '#dcfce7',
  },
  taskBoxOverdue: {
    backgroundColor: '#fef2f2',
  },
  taskNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  taskLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  viewTasksButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  viewTasksText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sidebarCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16,
  },
  sidebarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  teamTable: {
    gap: 8,
  },
  teamTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
    paddingBottom: 8,
    marginBottom: 8,
  },
  teamTableHeaderText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  teamTableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  teamTableData: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
  },
  noTeamText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 16,
  },
  activityItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityText: {
    fontSize: 14,
    color: '#1a1a1a',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
  },
  noActivityText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 16,
  },
});
