import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import Card from '../../components/shared/Card';
import ProjectCard from '../../components/shared/ProjectCard';
import { api } from '../../api/client';

type ClientProjectsRouteParams = {
  ClientProjects: {
    client: any;
    projects: any[];
    highlightProjectId?: string;
  };
};

type ClientProjectsRouteProp = RouteProp<ClientProjectsRouteParams, 'ClientProjects'>;

export default function ClientProjectsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<ClientProjectsRouteProp>();
  const { client, projects: initialProjects, highlightProjectId } = route.params;

  const [projects, setProjects] = useState<any[]>(initialProjects || []);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching projects for client:', client.id, client.name);
      
      // Try dedicated endpoint first
      try {
        console.log('📡 Calling /api/clients/:id/projects endpoint...');
        const res = await api.get(`/api/clients/${client.id}/projects`, { params: { page: 1, limit: 100 } });
        console.log('✅ Projects fetched:', res.data?.projects?.length || 0);
        console.log('📋 Projects data:', JSON.stringify(res.data?.projects, null, 2));
        setProjects(res.data?.projects || []);
      } catch (err) {
        console.log('❌ Dedicated endpoint failed:', (err as any).message);
        console.log('Error details:', (err as any).response?.data || err);
        // Fallback to generic endpoint with filter
        console.log('↩️ Falling back to /api/projects?clientId=...');
        const fallback = await api.get('/api/projects', { params: { page: 1, limit: 100, clientId: client.id } });
        console.log('✅ Fallback projects fetched:', fallback.data?.projects?.length || 0);
        console.log('📋 Fallback projects data:', JSON.stringify(fallback.data?.projects, null, 2));
        setProjects(fallback.data?.projects || []);
      }
    } catch (error) {
      console.error('❌ Failed to fetch projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialProjects || initialProjects.length === 0) {
      fetchProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id]);

  useFocusEffect(
    React.useCallback(() => {
      // Refresh on focus (e.g., after creating a project)
      console.log('🔄 ClientProjectsScreen focused, refreshing projects...');
      fetchProjects();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client?.id])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProjects();
    setRefreshing(false);
  };

  // Use real project data from database
  const projectsWithCalculatedData = useMemo(() => {
    return projects.map(project => {
      // Use real data from database, with some calculated fields for display
      const budget = project.budget || 0;
      const totalHours = project.allocated_hours || 0;
      
      // Calculate progress based on status
      let progress = 0;
      if (project.status === 'Completed') {
        progress = 100;
      } else if (project.status === 'On Hold') {
        progress = Math.floor(Math.random() * 30) + 10; // 10-40%
      } else if (project.status === 'Active') {
        progress = Math.floor(Math.random() * 70) + 20; // 20-90%
      } else {
        progress = 0; // To Do
      }
      
      return {
        ...project,
        budget,
        total_hours: totalHours,
        total_cost: budget, // For now, same as budget
        progress,
        team_size: Math.floor(Math.random() * 5) + 2, // 2-6 team members (mock for now)
        priority: ['High', 'Medium', 'Low'][Math.floor(Math.random() * 3)] // Mock for now
      };
    });
  }, [projects]);

  const formatCurrency = (amount: any) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#34C759';
      case 'completed': return '#007AFF';
      case 'on_hold': return '#FF9500';
      case 'cancelled': return '#FF3B30';
      default: return '#666';
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleProjectPress = (project: any) => {
    // Navigate to project details - you can implement this based on your navigation structure
    console.log('Project pressed:', project.name);
  };

  const listRef = React.useRef<FlatList<any>>(null);

  useEffect(() => {
    if (highlightProjectId && projects.length > 0) {
      const index = projects.findIndex(p => String(p.id) === String(highlightProjectId));
      if (index >= 0 && listRef.current) {
        setTimeout(() => {
          try {
            listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
          } catch {}
        }, 300);
      }
    }
  }, [highlightProjectId, projects]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{projects.length} project{projects.length !== 1 ? 's' : ''}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddProject', { clientId: client.id, clientName: client.name })}
        >
          <Text style={styles.addButtonText}>+ Add Project</Text>
        </TouchableOpacity>
      </View>

      {loading && projects.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading projects...</Text>
        </View>
      ) : (
      <FlatList
        ref={listRef}
        data={projectsWithCalculatedData}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ProjectCard
            project={item}
            onPress={() => handleProjectPress(item)}
            newBadge={!!highlightProjectId && String(item.id) === String(highlightProjectId)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No projects found</Text>
            <Text style={styles.emptySubtext}>This client doesn't have any projects yet</Text>
            <TouchableOpacity
              style={[styles.addButton, { marginTop: 16 }]}
              onPress={() => navigation.navigate('AddProject', { clientId: client.id, clientName: client.name })}
            >
              <Text style={styles.addButtonText}>Create First Project</Text>
            </TouchableOpacity>
          </View>
        }
      />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 8,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});
