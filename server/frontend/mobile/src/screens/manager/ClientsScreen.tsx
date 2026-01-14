import React, { useEffect, useState, useContext } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
// DB-only: no selectors/mocks
import { AuthContext } from '../../context/AuthContext';
import { usePermissions } from '../../context/PermissionsContext';
// Removed useRole import to avoid context errors
import { api } from '../../api/client';
import Card from '../../components/shared/Card';
import ClientCard from '../../components/shared/ClientCard';
import Button from '../../components/shared/Button';
import AppHeader from '../../components/shared/AppHeader';

export default function ClientsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useContext(AuthContext);
  const { has } = usePermissions();
  // Show Add Client button only if permission is granted
  const canManageClients = has('clients.add');
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const loadClients = async (pageNum = 1) => {
    try {
      console.log('🔄 Loading clients from database...');
      
      // Load clients directly from API
      let all = [];
      try {
        console.log('📡 Making API call to /api/clients...');
        const response = await api.get('/api/clients', { params: { page: 1, limit: 100 } });
        console.log('📊 API Response:', response.data);
        
        const apiClients = response.data?.clients || [];
        console.log('✅ Clients loaded from database:', apiClients.length);
        
        if (apiClients.length === 0) {
          console.log('⚠️ No clients returned from API, checking database...');
        }
        
        all = apiClients.map((c: any, index: number) => ({
          id: c.id,
          name: c.name,
          clientCode: `CLT-${String(index + 1).padStart(3, '0')}`, // Generate user-friendly client code
          email: c.email,
          phone: c.phone,
          address: c.address,
          contact_person: c.contact_person,
          created_at: c.created_at,
          updated_at: c.updated_at,
        }));
        
        console.log('📋 Mapped clients:', all.length);
        
      } catch (error) {
        console.log('❌ Clients API failed:', (error as Error).message);
        console.log('Error details:', (error as any).response?.data || error);
        all = [];
      }
      
      const pageSize = 20;
      const start = (pageNum - 1) * pageSize;
      const slice = all.slice(start, start + pageSize);
      setClients(pageNum === 1 ? slice : [...clients, ...slice]);
      setHasNext(start + pageSize < all.length);
      setPage(pageNum);
      
      console.log('✅ Final clients loaded:', all.length, 'Displayed:', slice.length);
    } catch (error) {
      console.error('❌ Error loading clients:', error);
      Alert.alert('Error', 'Failed to load clients');
    }
  };

  useEffect(() => {
    // Only load clients if user is authenticated
    if (user) {
      console.log('👤 User authenticated, loading clients...');
      loadClients().finally(() => setLoading(false));
    } else {
      console.log('⏳ Waiting for user authentication...');
      setLoading(false);
    }
  }, [user]);

  // Reload clients when screen comes into focus (e.g., returning from AddClient)
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        console.log('🔄 Screen focused, reloading clients...');
        loadClients(1); // Always reload from page 1
      }
    }, [user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadClients(1);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (hasNext && !loading) {
      setLoading(true);
      await loadClients(page + 1);
      setLoading(false);
    }
  };

  const handleDeleteClient = async (client: any) => {
    try {
      console.log('🗑️ Attempting to delete client:', client.name, client.id);
      
      const projectCount = client.project_count || 0;
      const warningMessage = projectCount > 0 
        ? `Are you sure you want to delete "${client.name}"?\n\n⚠️ WARNING: This will also delete ${projectCount} project(s) associated with this client!\n\nThis action cannot be undone.`
        : `Are you sure you want to delete "${client.name}"?\n\nThis action cannot be undone.`;
      
      Alert.alert(
        'Delete Client',
        warningMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const response = await api.delete(`/api/clients/${client.id}`);
                const deletedProjects = response.data?.deletedProjects || 0;
                console.log('✅ Client deleted successfully. Projects deleted:', deletedProjects);
                Alert.alert(
                  'Success', 
                  deletedProjects > 0 
                    ? `Client and ${deletedProjects} project(s) deleted successfully`
                    : 'Client deleted successfully'
                );
                // Reload clients
                loadClients(1);
              } catch (error: any) {
                console.error('❌ Error deleting client:', error);
                const errorMsg = error.response?.data?.error || 'Failed to delete client';
                Alert.alert('Error', errorMsg);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('❌ Error in delete handler:', error);
    }
  };

  const handleClientPress = async (client: any) => {
    try {
      console.log('🔄 Loading projects for client:', client.name);
      
      // Load projects for this specific client from database
      let clientProjects = [];
      try {
        console.log('📡 Making API call to /api/projects for client:', client.id);
          const response = await api.get(`/api/clients/${client.id}/projects`, { params: { page: 1, limit: 100 } });
        
        const apiProjects = response.data?.projects || [];
        console.log('✅ Client projects loaded from database:', apiProjects.length);
        
        clientProjects = apiProjects.map((p: any, index: number) => ({
          id: p.id,
          name: p.name,
          projectCode: `PRJ-${String(index + 1).padStart(3, '0')}`, // Generate user-friendly project code
          description: p.description,
          status: p.status,
          start_date: p.start_date,
          end_date: p.end_date,
          budget: p.budget || 0,
          location: p.location,
          allocated_hours: p.allocated_hours || 0,
          client_id: p.client_id,
          client_name: p.client_name,
        }));
        
          // Fallback: if none returned, try generic projects filter (defensive)
          if (clientProjects.length === 0) {
            console.log('ℹ️ No projects via /api/clients/:id/projects, falling back to /api/projects?clientId=...');
            const fallback = await api.get('/api/projects', { params: { page: 1, limit: 100, clientId: client.id } });
            const fbProjects = fallback.data?.projects || [];
            clientProjects = fbProjects.map((p: any, index: number) => ({
              id: p.id,
              name: p.name,
              projectCode: `PRJ-${String(index + 1).padStart(3, '0')}`,
              description: p.description,
              status: p.status,
              start_date: p.start_date,
              end_date: p.end_date,
              budget: p.budget || 0,
              location: p.location,
              allocated_hours: p.allocated_hours || 0,
              client_id: p.client_id,
              client_name: p.client_name,
            }));
          }
      } catch (error) {
        console.log('❌ Client projects API failed:', (error as Error).message);
        console.log('Error details:', (error as any).response?.data || error);
        // Fallback to generic projects endpoint filtered by clientId if the dedicated endpoint is unavailable
        try {
          console.log('↩️ Falling back to /api/projects?clientId=...');
          const fallback = await api.get('/api/projects', { params: { page: 1, limit: 100, clientId: client.id } });
          const fbProjects = fallback.data?.projects || [];
          clientProjects = fbProjects.map((p: any, index: number) => ({
            id: p.id,
            name: p.name,
            projectCode: `PRJ-${String(index + 1).padStart(3, '0')}`,
            description: p.description,
            status: p.status,
            start_date: p.start_date,
            end_date: p.end_date,
            budget: p.budget || 0,
            location: p.location,
            allocated_hours: p.allocated_hours || 0,
            client_id: p.client_id,
            client_name: p.client_name,
          }));
          console.log('✅ Fallback loaded projects:', clientProjects.length);
        } catch (fallbackError) {
          console.log('❌ Fallback /api/projects also failed:', (fallbackError as Error).message);
          console.log('Error details:', (fallbackError as any).response?.data || fallbackError);
          clientProjects = [];
        }
      }
      
      console.log('📋 Final client projects:', clientProjects.length);
      navigation.navigate('ClientProjects', { client, projects: clientProjects });
      
    } catch (error) {
      console.error('❌ Error loading client projects:', error);
      // Fallback to empty array
      navigation.navigate('ClientProjects', { client, projects: [] });
    }
  };

  const formatCurrency = (amount: any) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;


  if (loading && clients.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AppHeader
        rightAction={canManageClients ? {
          title: `+ ${t('clients.add_client')}`,
          onPress: () => navigation.navigate('AddClient')
        } : undefined}
      />
      
      <View style={styles.screenContent}>
        <Text style={styles.title}>{t('clients.clients')}</Text>
        
        <FlatList
        data={clients}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ClientCard 
            client={item} 
            onPress={() => handleClientPress(item)}
            onDelete={() => handleDeleteClient(item)}
            canDelete={canManageClients}
          />
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('clients.no_clients')}</Text>
            <Text style={styles.emptySubtext}>
              {canManageClients ? t('clients.add_client') : t('common.no_data')}
            </Text>
            {canManageClients && (
              <View style={styles.emptyButton}>
                <Button
                  title={t('clients.add_client')}
                  onPress={() => navigation.navigate('AddClient')}
                />
              </View>
            )}
          </View>
        }
        contentContainerStyle={styles.listContent}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  screenContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
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
  listContent: {
    padding: 16,
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
    marginBottom: 24,
    textAlign: 'center',
  },
  emptyButton: {
    paddingHorizontal: 24,
  },
});