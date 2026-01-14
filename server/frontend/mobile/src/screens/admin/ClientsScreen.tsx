import React, { useEffect, useState, useContext } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity, RefreshControl, Alert, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
// DB-only: no selectors/mocks
import { AuthContext } from '../../context/AuthContext';
import { usePermissions } from '../../context/PermissionsContext';
// Removed useRole import to avoid context errors
import { api } from '../../api/client';
import ClientCard from '../../components/shared/ClientCard';
import Button from '../../components/shared/Button';

export default function ClientsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useContext(AuthContext);
  const { has } = usePermissions();
  // Show Add Client button only if permission is granted
  const canManageClients = has('clients.add');
  const [clients, setClients] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
          client_type: c.client_type || 'Client',
          location: c.location || '',
          email: c.email,
          phone: c.phone,
          address: c.address,
          contact_person: c.contact_person,
          onboard_date: c.onboard_date || c.created_at,
          project_count: c.project_count || 0,
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
      setFilteredClients(pageNum === 1 ? slice : [...clients, ...slice]);
      setHasNext(start + pageSize < all.length);
      setPage(pageNum);
      
      console.log('✅ Final clients loaded:', all.length, 'Displayed:', slice.length);
    } catch (error) {
      console.error('❌ Error loading clients:', error);
      Alert.alert('Error', 'Failed to load clients');
    }
  };

  // Filter clients based on search query
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredClients(clients);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = clients.filter(client =>
        client.name?.toLowerCase().includes(query) ||
        client.client_type?.toLowerCase().includes(query) ||
        client.location?.toLowerCase().includes(query) ||
        client.email?.toLowerCase().includes(query)
      );
      setFilteredClients(filtered);
    }
  }, [searchQuery, clients]);

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

  const handleEditClient = (client: any) => {
    navigation.navigate('EditClient', { client });
  };

  const formatCurrency = (amount: any) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;


  if (loading && clients.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6B5CE7" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('clients.clients')}</Text>
        <View style={styles.headerRight} />
      </View>
      
      <View style={styles.screenContent}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Ionicons name="search" size={20} color="#999" />
          </View>
        </View>

        <FlatList
        data={filteredClients}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <ClientCard 
            client={item} 
            onPress={() => handleClientPress(item)}
            onEdit={() => handleEditClient(item)}
            onDelete={() => handleDeleteClient(item)}
            canDelete={canManageClients}
            canEdit={canManageClients}
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

        {/* Floating Add Button */}
        {canManageClients && (
          <TouchableOpacity 
            style={styles.fab}
            onPress={() => navigation.navigate('AddClient')}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  headerRight: {
    width: 32,
  },
  screenContent: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    padding: 0,
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
    paddingBottom: 80,
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
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6B5CE7',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});