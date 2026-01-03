import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, TouchableOpacity, RefreshControl, Alert, Modal, FlatList } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import Button from '../../components/shared/Button';
import { MOCK_DATA } from '../../data/mockData';
import Card from '../../components/shared/Card';
import { getProject, listTimeEntries, listProjectTasks, getProjectTeam, addProjectTeamMember, removeProjectTeamMember, listEmployees } from '../../api/endpoints';
import { dashboardHelpers, dashboardApi } from '../../api/dashboard';
import { formatCurrencyINR, formatCurrencyPrecise, formatBudgetProgress } from '../../utils/currency';

// Admin-specific Project Details Screen with full access

export default function ProjectDetailsScreen() {
  const route = useRoute<any>();
  const { id } = route.params || {};
  const { user } = useContext(AuthContext);
  const navigation = useNavigation<any>();
  
  const [project, setProject] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'budget' | 'team'>('overview');
  const [projectMetrics, setProjectMetrics] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [budgetCalculation, setBudgetCalculation] = useState<any>(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [availableEmployees, setAvailableEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  // Stable data generation using project ID as seed
  const generateStableData = (projectId: string) => {
    const hash = projectId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const seed = Math.abs(hash) % 1000;
    
    return {
      dueDate: new Date(Date.now() + (seed % 90 + 30) * 24 * 60 * 60 * 1000),
      startDate: new Date(Date.now() - (seed % 30 + 10) * 24 * 60 * 60 * 1000),
      budget: seed % 2000000 + 1000000,
      allocatedHours: seed % 500 + 200,
      progress: seed % 40 + 30,
      overdueTasks: seed % 5,
      totalTasks: seed % 20 + 10,
      budgetSpent: seed % 500000 + 100000,
      hoursLogged: seed % 200 + 50,
      inProgressTasks: seed % 5 + 2,
      todoTasks: seed % 8 + 3,
      averageHourlyRate: seed % 2000 + 1000,
      tasksAssigned: seed % 5 + 1,
      hoursThisWeek: seed % 40 + 10,
      totalHoursLogged: seed % 100 + 20,
      totalCost: seed % 50000 + 10000,
      activity1Time: new Date(Date.now() - (seed % 24 + 1) * 60 * 60 * 1000),
      activity2Time: new Date(Date.now() - (seed % 48 + 24) * 60 * 60 * 1000),
    };
  };

  const loadData = async () => {
    try {
      console.log('=== LOADING PROJECT DATA FROM DATABASE (ADMIN) ===');
      console.log('Project ID:', id);
      console.log('User Role:', user?.role);
      
      if (!id) {
        console.log('No project ID provided');
        return;
      }
      
      // Load project data from database
      let projectData: any | null = null;
      try {
        const res = await getProject(id);
        const apiProject = res.project;
        projectData = {
          ...apiProject,
          client_name: apiProject.client_name || 'Client',
          due_date: apiProject.end_date ? new Date(apiProject.end_date) : null,
          start_date: apiProject.start_date ? new Date(apiProject.start_date) : null,
          budget: apiProject.budget || 0,
          allocated_hours: apiProject.allocated_hours || 0,
          projectCode: `PRJ-${String(Math.abs(apiProject.id.split('').reduce((a: any, b: any) => a + b.charCodeAt(0), 0)) % 1000).padStart(3, '0')}`,
        };
        console.log('✅ Project data loaded from database');
      } catch (e: any) {
        console.log('❌ Database connection failed, using mock data:', e.message);
        const mockProject = MOCK_DATA.clients.flatMap(c => c.projects).find(p => p.id === id);
        const client = MOCK_DATA.clients.find(c => c.projects.some(p => p.id === id));
        const stableData = generateStableData(id);
        projectData = mockProject ? {
          ...mockProject,
          client_name: client?.name || 'Unknown Client',
          due_date: stableData.dueDate,
          start_date: mockProject.startDate ? new Date(mockProject.startDate) : stableData.startDate,
          budget: stableData.budget,
          allocated_hours: stableData.allocatedHours,
        } : null;
      }

      if (!projectData) return;
      setProject(projectData);

      // Fetch time entries from database
      let projectEntries: any[] = [];
      try {
        const entriesRes = await listTimeEntries({ projectId: id, limit: 200, page: 1 });
        projectEntries = entriesRes.timeEntries || [];
        console.log('✅ Time entries loaded from database:', projectEntries.length);
      } catch (e: any) {
        console.log('❌ Time entries database query failed:', e.message);
        projectEntries = [];
      }

      const hoursLogged = dashboardHelpers.calculateTotalHours(projectEntries as any);
      const hoursTotal = Number(projectData.allocated_hours || 0);

      // Calculate actual budget spent from time entries
      const budgetSpent = projectEntries.reduce((total, entry) => {
        return total + (Number(entry.cost) || 0);
      }, 0);

      // Calculate average hourly rate from time entries
      const totalCost = budgetSpent;
      const averageHourlyRate = hoursLogged > 0 ? totalCost / hoursLogged : 0;

      // Load tasks from backend and compute progress from real statuses
      let totalTasks = 0;
      let completedTasks = 0;
      let activeTasks = 0;
      let onHoldTasks = 0;
      let todoTasks = 0;
      try {
        const taskRes = await listProjectTasks(String(id), 1, 200);
        const tasks = taskRes.tasks || [];
        totalTasks = tasks.length;
        for (const t of tasks) {
          const st = t.status || '';
          if (st === 'Completed') completedTasks++;
          else if (st === 'Active') activeTasks++;
          else if (st === 'On Hold') onHoldTasks++;
          else todoTasks++;
        }
      } catch (e) {
        totalTasks = 0; completedTasks = 0; activeTasks = 0; onHoldTasks = 0; todoTasks = 0;
      }
      const activeTotal = Math.max(0, completedTasks + activeTasks + onHoldTasks);
      let progress = 0;
      if (activeTotal > 0) {
        const raw = (completedTasks / activeTotal) * 100;
        progress = Math.min(100, completedTasks > 0 && raw < 1 ? 1 : Math.round(raw));
      }

      const metrics = {
        progress,
        budgetSpent: Math.round(budgetSpent * 100) / 100,
        budgetTotal: Number(projectData.budget || 0),
        hoursLogged: Math.round(hoursLogged),
        hoursTotal,
        overdueTasks,
        totalTasks,
        completedTasks,
        inProgressTasks,
        todoTasks,
        averageHourlyRate: Math.round(averageHourlyRate * 100) / 100,
      };
      setProjectMetrics(metrics);

      // Load team members from the new project_team_memberships table
      let teamMembersData: any[] = [];
      try {
        console.log('📡 Loading team from project_team_memberships table...');
        const teamResponse = await getProjectTeam(id as string);
        const teamData = teamResponse?.teamMembers || [];
        
        console.log(`✅ Team members from database: ${teamData.length}`);
        
        // Get stats for each team member to include hours logged
        const stats = await dashboardApi.getProjectStats(id as string);
        const employeeBreakdown = stats?.employeeBreakdown || [];
        
        // Map team members with their hours logged
        teamMembersData = teamData.map((member: any) => {
          const statsForMember = employeeBreakdown.find((emp: any) => emp.id === member.id);
          return {
            id: member.id,
            employeeId: member.employee_id,
            name: `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.employee_id,
            email: member.email,
            department: member.department || 'N/A',
            role: member.role || 'member',
            addedAt: member.added_at,
            totalHoursLogged: statsForMember ? Math.round(((statsForMember.totalMinutes || 0) / 60) * 10) / 10 : 0,
            totalMinutes: statsForMember?.totalMinutes || 0,
            totalCost: statsForMember?.totalCost || 0,
            monthlySalary: statsForMember?.salary_amount,
            hourlyRate: statsForMember?.hourly_rate,
            tasksAssigned: statsForMember?.tasksAssigned || 0,
          };
        });
        
        console.log('✅ Team members with stats loaded:', teamMembersData.length);
      } catch (e: any) {
        console.log('❌ Team members query failed:', e.message);
        console.log('🔄 Falling back to stats-based team loading...');
        
        // Fallback to old method if new endpoint fails
        try {
          const stats = await dashboardApi.getProjectStats(id as string);
          const employeeBreakdown = stats?.employeeBreakdown || [];
          teamMembersData = employeeBreakdown.map((emp: any) => ({
            id: emp.id,
            employeeId: emp.employee_id,
            name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.employee_id,
            totalHoursLogged: Math.round((emp.totalHours ?? (emp.totalMinutes || emp.total_minutes || 0) / 60) * 10) / 10,
            totalMinutes: emp.totalMinutes ?? emp.total_minutes ?? 0,
            totalCost: emp.totalCost ?? emp.total_cost ?? 0,
            monthlySalary: emp.salary_amount,
            hourlyRate: emp.hourly_rate,
            department: emp.department,
            tasksAssigned: emp.tasksAssigned,
          }));
        } catch (fallbackError) {
          teamMembersData = [];
        }
      }

      // Final fallback: derive team from project time entries if both methods fail
      if ((!teamMembersData || teamMembersData.length === 0) && projectEntries && projectEntries.length > 0) {
        console.log('🔄 Deriving team from time entries...');
        const byEmployee: Record<string, any> = {};
        for (const entry of projectEntries) {
          const empId = entry.employee_id || entry.employeeId;
          if (!empId) continue;
          if (!byEmployee[empId]) {
            byEmployee[empId] = {
              id: empId,
              employeeId: empId,
              name: entry.employee_name || `Employee ${String(empId).slice(0, 6)}`,
              totalMinutes: 0,
              totalCost: 0,
            };
          }
          const minutes = Number(entry.duration_minutes || 0);
          const cost = Number(entry.cost || 0);
          byEmployee[empId].totalMinutes += isNaN(minutes) ? 0 : minutes;
          byEmployee[empId].totalCost += isNaN(cost) ? 0 : cost;
        }
        teamMembersData = Object.values(byEmployee).map((emp: any) => ({
          ...emp,
          totalHoursLogged: Math.round((emp.totalMinutes / 60) * 10) / 10,
        }));
      }
      setTeamMembers(teamMembersData);

      // Stable recent activity derived from entries or seeded
      const stableData = generateStableData(id);
      const activities = [
        {
          id: 1,
          type: 'time_logged',
          user: 'You',
          action: 'logged time',
          target: projectData.name || 'Project',
          timestamp: projectEntries[0]?.start_time ? new Date(projectEntries[0].start_time) : stableData.activity1Time,
          icon: '🕒'
        },
        {
          id: 2,
          type: 'update',
          user: 'System',
          action: 'updated project status',
          target: projectData.status || 'active',
          timestamp: stableData.activity2Time,
          icon: '🔄'
        }
      ];
      setRecentActivity(activities);

      // Budget calculation for admin
      let budgetData = null;
      if (metrics.budgetTotal > 0) {
        budgetData = {
          totalBudgetUsed: metrics.budgetSpent,
          totalHoursLogged: metrics.hoursLogged,
          averageHourlyRate: metrics.averageHourlyRate,
          budgetRemaining: Math.max(0, metrics.budgetTotal - metrics.budgetSpent),
          budgetUtilization: metrics.budgetTotal > 0 ? (metrics.budgetSpent / metrics.budgetTotal) * 100 : 0,
          employeeBreakdown: (teamMembersData || []).map((m: any) => ({
            employeeName: m.name,
            totalCost: m.totalCost ?? 0,
            totalHours: m.totalHoursLogged ?? 0,
            monthlySalary: m.monthlySalary,
            hourlyRate: m.hourlyRate,
            costPercentage: metrics.budgetSpent > 0 ? ((m.totalCost ?? 0) / metrics.budgetSpent) * 100 : 0,
          })),
        };
        setBudgetCalculation(budgetData);
      } else {
        setBudgetCalculation(null);
      }

      console.log('✅ All project data loaded successfully from database');

    } catch (error: any) {
      console.error('Error loading project data:', error.message);
      
      if (error.message?.includes('offline mode') || error.message?.includes('No authentication token')) {
        console.log('Using fallback mock data for offline mode...');
      }
    }
  };

  useEffect(() => {
    if (id) {
      loadData().finally(() => setLoading(false));
    }
  }, [id, user]);

  // Reload data when screen comes back into focus (after task updates)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (id) {
        console.log('🔄 Screen focused, reloading project data...');
        loadData();
      }
    });

    return unsubscribe;
  }, [navigation, id]);

  // Watch for route params changes (refresh flag from task updates)
  useEffect(() => {
    const refreshParam = route.params?.refresh;
    if (refreshParam && id) {
      console.log('🔄 Refresh flag detected, reloading project data...');
      loadData();
    }
  }, [route.params?.refresh, id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAddMember = async () => {
    try {
      // Load available employees
      const response = await listEmployees({ page: 1, limit: 100 });
      const employees = response.employees || [];
      
      // Filter out employees already in the team
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
      await loadData(); // Reload to show updated team
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
              await loadData(); // Reload to show updated team
            } catch (error: any) {
              console.error('Error removing team member:', error);
              Alert.alert('Error', error.response?.data?.error || 'Failed to remove team member');
            }
          }
        }
      ]
    );
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

  const calculateHourlyRate = (monthlySalary: number) => {
    const workingDaysPerMonth = 24;
    const hoursPerDay = 8;
    const totalHoursPerMonth = workingDaysPerMonth * hoursPerDay;
    return Math.round(monthlySalary / totalHoursPerMonth);
  };

  const formatHours = (minutes: any) => {
    const mins = Number(minutes || 0);
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return hours > 0 ? `${hours}h ${remainingMins}m` : `${remainingMins}m`;
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading project details...</Text>
        <Text style={{color: 'blue', fontSize: 12, marginTop: 10}}>
          User Role: {user?.role || 'Not loaded'}
        </Text>
      </View>
    );
  }

  if (!project) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Project not found</Text>
        <Text style={{color: 'red', fontSize: 12, marginTop: 10}}>
          User Role: {user?.role || 'Not loaded'} | Project ID: {id}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView 
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
      {/* Project Header */}
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{project.name}</Text>
          <Text style={styles.projectCode}>{project.projectCode || ''}</Text>
        </View>
        <Text style={styles.client}>{project.client_name}</Text>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(project.status || 'active') }]}>
            <Text style={styles.statusText}>{(project.status || 'active').toUpperCase()}</Text>
          </View>
          {project.due_date && (
            <Text style={styles.statusDueText}>
              Due in {getDaysUntilDue(project)} days · {new Date(project.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          )}
        </View>
      </View>

      {/* Tab Navigation - Admin has more tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'budget' && styles.activeTab]}
          onPress={() => setActiveTab('budget')}
        >
          <Text style={[styles.tabText, activeTab === 'budget' && styles.activeTabText]}>Budget</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'team' && styles.activeTab]}
          onPress={() => setActiveTab('team')}
        >
          <Text style={[styles.tabText, activeTab === 'team' && styles.activeTabText]}>Team</Text>
        </TouchableOpacity>
      </View>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <View style={styles.tabContent}>
          <View style={{ marginBottom: 12 }}>
            <Button
              title="View Project Tasks"
              onPress={() => navigation.navigate('ProjectTasks', { 
                projectId: id, 
                projectName: project?.name
              })}
            />
          </View>
          {projectMetrics && (
            <Card style={styles.metricsCard}>
              <Text style={styles.metricsTitle}>Project Progress</Text>
              <View style={styles.metricItem}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel}>Overall Progress</Text>
                  <Text style={styles.metricValue}>{projectMetrics.progress}%</Text>
                </View>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${projectMetrics.progress}%` }]} />
                </View>
                <Text style={[styles.metricBoxSubtext, { textAlign: 'right', marginTop: 4 }]}> 
                  {projectMetrics.completedTasks} completed · {projectMetrics.inProgressTasks} in-progress · {projectMetrics.overdueTasks} overdue
                </Text>
              </View>
            </Card>
          )}

          {/* Budget Chart - Admin view */}
          {projectMetrics && (
            <View style={styles.visualizationsContainer}>
              <Card style={styles.chartCard}>
                <Text style={styles.chartTitle}>Budget Utilization (INR)</Text>
                <View style={styles.budgetChart}>
                  <View style={styles.budgetBar}>
                    <View style={[styles.budgetUsed, { width: `${(projectMetrics.budgetSpent / projectMetrics.budgetTotal) * 100}%` }]} />
                  </View>
                  <View style={styles.budgetLabels}>
                    <Text style={styles.budgetLabel}>Used: {formatCurrencyINR(projectMetrics.budgetSpent)}</Text>
                    <Text style={styles.budgetLabel}>Remaining: {formatCurrencyINR(projectMetrics.budgetTotal - projectMetrics.budgetSpent)}</Text>
                  </View>
                  {budgetCalculation && (
                    <View style={styles.budgetDetails}>
                      <Text style={styles.budgetDetailText}>
                        Based on {budgetCalculation.totalHoursLogged}h logged by {budgetCalculation.employeeBreakdown?.length || 0} employees
                      </Text>
                    </View>
                  )}
                </View>
              </Card>

              {/* Task Breakdown */}
              <Card style={styles.chartCard}>
                <Text style={styles.chartTitle}>Task Breakdown</Text>
                <View style={styles.taskBreakdown}>
                  <View style={styles.taskItem}>
                    <View style={[styles.taskColor, { backgroundColor: '#34d399' }]} />
                    <Text style={styles.taskLabel}>Completed ({projectMetrics.completedTasks})</Text>
                  </View>
                  <View style={styles.taskItem}>
                    <View style={[styles.taskColor, { backgroundColor: '#3b82f6' }]} />
                    <Text style={styles.taskLabel}>In Progress ({projectMetrics.inProgressTasks})</Text>
                  </View>
                  <View style={styles.taskItem}>
                    <View style={[styles.taskColor, { backgroundColor: '#f59e0b' }]} />
                    <Text style={styles.taskLabel}>To Do ({projectMetrics.todoTasks})</Text>
                  </View>
                </View>
              </Card>
            </View>
          )}
        </View>
      )}

      {/* Budget Tab - Admin specific */}
      {activeTab === 'budget' && budgetCalculation && (
        <View style={styles.tabContent}>
          <Card style={styles.budgetBreakdownCard}>
            <Text style={styles.sectionTitle}>Budget Breakdown by Employee</Text>
            {budgetCalculation.employeeBreakdown.map((emp: any, index: number) => (
              <View key={index} style={styles.employeeBudgetItem}>
                <View style={styles.employeeBudgetHeader}>
                  <Text style={styles.employeeBudgetName}>{emp.employeeName}</Text>
                  <Text style={styles.employeeBudgetCost}>{formatCurrencyINR(emp.totalCost)}</Text>
                </View>
                <View style={styles.employeeBudgetDetails}>
                  <Text style={styles.employeeBudgetDetail}>
                    Monthly Salary: ₹{(emp.monthlySalary || 0).toLocaleString()}
                  </Text>
                  <Text style={styles.employeeBudgetDetail}>
                    Hourly Rate: ₹{emp.hourlyRate}/hr
                  </Text>
                  <Text style={styles.employeeBudgetDetail}>
                    Hours Logged: {Math.round(emp.totalHours * 10) / 10}h
                  </Text>
                </View>
              </View>
            ))}
            <View style={styles.budgetSummary}>
              <Text style={styles.budgetSummaryTitle}>Budget Summary</Text>
              <View style={styles.budgetSummaryRow}>
                <Text style={styles.budgetSummaryLabel}>Total Budget:</Text>
                <Text style={styles.budgetSummaryAmount}>{formatCurrencyINR(project?.budget || 0)}</Text>
              </View>
              <View style={styles.budgetSummaryRow}>
                <Text style={styles.budgetSummaryLabel}>Amount Spent:</Text>
                <Text style={styles.budgetSummaryAmount}>{formatCurrencyINR(budgetCalculation.totalBudgetUsed)}</Text>
              </View>
              <View style={styles.budgetSummaryRow}>
                <Text style={styles.budgetSummaryLabel}>Remaining:</Text>
                <Text style={[styles.budgetSummaryAmount, { color: budgetCalculation.budgetRemaining >= 0 ? '#34C759' : '#FF3B30' }]}>
                  {formatCurrencyINR(budgetCalculation.budgetRemaining)}
                </Text>
              </View>
              <View style={styles.budgetSummaryRow}>
                <Text style={styles.budgetSummaryLabel}>Utilization:</Text>
                <Text style={styles.budgetSummaryAmount}>{budgetCalculation.budgetUtilization.toFixed(1)}%</Text>
              </View>
            </View>
          </Card>
        </View>
      )}

      {/* Team Tab - Admin specific */}
      {activeTab === 'team' && (
        <View style={styles.tabContent}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={styles.sectionTitle}>Team Members</Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#007AFF',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
              onPress={handleAddMember}
            >
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>+</Text>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Add Member</Text>
            </TouchableOpacity>
          </View>
          
          {teamMembers && teamMembers.length > 0 ? (
            <View style={styles.teamGrid}>
              {teamMembers.map((member, index) => (
                <View key={index} style={{ position: 'relative' }}>
                  <TouchableOpacity style={styles.memberCard}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.avatarText}>{(member.name || '?').charAt(0)}</Text>
                    </View>
                    <Text style={styles.memberName}>{member.name || 'Unknown'}</Text>
                    {member.jobTitle ? (
                      <Text style={styles.memberRole}>{member.jobTitle}</Text>
                    ) : null}
                    {typeof member.monthlySalary === 'number' && (
                      <Text style={styles.memberSalary}>₹{(member.monthlySalary || 0).toLocaleString()}/month</Text>
                    )}
                    {typeof member.hourlyRate === 'number' && (
                      <Text style={styles.memberHourlyRate}>₹{member.hourlyRate}/hr</Text>
                    )}
                    <Text style={styles.memberHoursLogged}>{member.totalHoursLogged || 0}h logged</Text>
                    {typeof member.totalCost === 'number' && (
                      <Text style={styles.memberCost}>Cost: {formatCurrencyINR(member.totalCost)}</Text>
                    )}
                    {typeof member.tasksAssigned === 'number' && (
                      <Text style={styles.memberTasks}>{member.tasksAssigned} tasks assigned</Text>
                    )}
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: '#FF3B30',
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={() => handleRemoveMember(member.id || '', member.name || 'Unknown')}
                  >
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Card style={styles.detailsCard}>
              <Text style={styles.description}>No team assigned yet.</Text>
            </Card>
          )}
        </View>
      )}

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
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  titleContainer: {
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  projectCode: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
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
  statusDueText: {
    marginLeft: 12,
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
    alignSelf: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#007AFF',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  tabContent: {
    padding: 16,
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 16,
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
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
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
  metricBoxSubtext: {
    fontSize: 10,
    color: '#999',
  },
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
  budgetChart: {
    alignItems: 'center',
  },
  budgetBar: {
    width: '100%',
    height: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  budgetUsed: {
    height: '100%',
    backgroundColor: '#34d399',
    borderRadius: 6,
  },
  budgetLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  budgetLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  taskBreakdown: {
    gap: 12,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  taskLabel: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
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
  memberRole: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textAlign: 'center',
  },
  memberTasks: {
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },
  memberSalary: {
    fontSize: 11,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 2,
  },
  memberHourlyRate: {
    fontSize: 10,
    color: '#34d399',
    fontWeight: '600',
    marginBottom: 2,
  },
  memberHoursLogged: {
    fontSize: 10,
    color: '#666',
    marginBottom: 2,
  },
  memberCost: {
    fontSize: 10,
    color: '#ef4444',
    fontWeight: '600',
  },
  budgetBreakdownCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  employeeBudgetItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  employeeBudgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  employeeBudgetName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  employeeBudgetCost: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
  },
  employeeBudgetDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  employeeBudgetDetail: {
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  budgetSummary: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 2,
    borderTopColor: '#e1e5e9',
    alignItems: 'center',
  },
  budgetSummaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  budgetSummaryAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: '#34d399',
    marginBottom: 4,
  },
  budgetSummarySubtext: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  budgetSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  budgetSummaryLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  budgetDetails: {
    marginTop: 8,
    alignItems: 'center',
  },
  budgetDetailText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
});
