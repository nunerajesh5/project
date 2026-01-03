import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../api/client';
import Card from '../../components/shared/Card';
import AppHeader from '../../components/shared/AppHeader';

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
}

export default function AllTasksScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useContext(AuthContext);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      setTasks(response.data.tasks || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
      setTasks([]);
    } finally {
      setLoading(false);
    }
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

  // Group tasks by project for display
  const tasksByProject = tasks.reduce((acc: Record<string, { name: string; items: Task[] }>, t) => {
    if (!acc[t.project_id]) acc[t.project_id] = { name: t.project_name, items: [] };
    acc[t.project_id].items.push(t);
    return acc;
  }, {});

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <AppHeader />
      <View style={styles.header}>
        <Text style={styles.title}>{t('tasks.all_tasks')}</Text>
        <Text style={styles.subtitle}>{tasks.length} {t('tasks.tasks')} across {Object.keys(tasksByProject).length} {t('projects.projects')}</Text>
      </View>

      {tasks.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>{t('tasks.no_tasks')}</Text>
          <Text style={styles.emptySubtitle}>{t('common.refresh')}</Text>
        </View>
      ) : (
        Object.entries(tasksByProject).map(([pid, group]) => (
          <View key={pid} style={{ marginBottom: 12 }}>
            <View style={styles.projectHeaderRow}>
              <Text style={styles.projectTitle}>{group.name}</Text>
              <Text style={styles.projectCount}>{group.items.length} task{group.items.length !== 1 ? 's' : ''}</Text>
            </View>
            {group.items.map((task) => (
              <Card key={task.id} style={styles.taskCard}>
                <View style={styles.taskHeader}>
                  <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(task.status) }]}>
                    <Text style={styles.statusText}>{task.status.toUpperCase()}</Text>
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
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F2F2F7' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#8E8E93' },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1C1C1E', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#8E8E93' },
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
});


