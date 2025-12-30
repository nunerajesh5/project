import React, { useEffect, useState, useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  ScrollView, 
  TouchableOpacity, 
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { AuthContext } from '../../context/AuthContext';
import { dashboardApi, dashboardHelpers, DashboardOverview, ActivityLog, Project } from '../../api/dashboard';
import { getMyOrganization } from '../../api/endpoints';
import Card from '../../components/shared/Card';
import SafeAreaWrapper from '../../components/shared/SafeAreaWrapper';
import { formatCurrencyINR } from '../../utils/currency';

// Theme colors
const PRIMARY_PURPLE = '#877ED2';
const LIGHT_PURPLE = '#877ED2';
const BUTTON_COLOR = '#877ED2';
const BG_COLOR = '#F5F5F8';

// Get greeting based on time of day
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

export default function AdminDashboardScreen() {
  const navigation = useNavigation<any>();
  const { user } = useContext(AuthContext);
  const { t } = useTranslation();
  
  // Admin Dashboard State
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organization, setOrganization] = useState<{ name: string; join_code: string; unique_id: string } | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);

  const loadData = async () => {
    try {
      setError(null);
      console.log('Loading admin dashboard data...');
      
      // Load dashboard overview
      console.log('Fetching overview data...');
      const overviewData = await dashboardApi.getOverview();
      console.log('Overview data received:', overviewData);
      setOverview(overviewData.overview);
      setRecentActivity(overviewData.recentActivity || []);
      
      // Load projects for Gantt chart
      console.log('Fetching projects data...');
      const projectsData = await dashboardApi.getProjects({ limit: 50 });
      console.log('Projects data received:', projectsData);
      setProjects(projectsData.projects || []);
      
      // Load organization data for QR code
      try {
        const orgData = await getMyOrganization();
        setOrganization(orgData.organization);
      } catch (orgError) {
        console.error('Error loading organization:', orgError);
        // Don't fail the whole dashboard if org loading fails
      }
      
      console.log('Admin dashboard data loaded successfully');
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      console.error('Error details:', (error as any)?.response?.data || (error as Error)?.message);
      setOverview(null);
      setRecentActivity([]);
      setProjects([]);
      setError('Failed to load dashboard data. Pull to refresh.');
    }
  };

  useEffect(() => {
    loadData().finally(() => {
      setLoading(false);
      setOrgLoading(false);
    });
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY_PURPLE} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Stat Card Component matching the design
  const StatCard = ({ title, value, iconName, buttonText, onButtonPress }: {
    title: string;
    value: number;
    iconName: string;
    buttonText: string;
    onButtonPress: () => void;
  }) => (
    <View style={styles.statCard}>
      <View style={styles.statCardHeader}>
        <Text style={styles.statCardTitle}>{title}</Text>
        <View style={styles.statCardIcon}>
          <Ionicons name={iconName as any} size={32} color="#E88D4E" />
        </View>
      </View>
      <Text style={styles.statCardValue}>{value}</Text>
      <TouchableOpacity style={styles.statCardButton} onPress={onButtonPress}>
        <Text style={styles.statCardButtonText}>{buttonText}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaWrapper backgroundColor={PRIMARY_PURPLE}>
      <ScrollView 
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Purple Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                  </Text>
                </View>
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.greeting}>Hello {user?.name?.split(' ')[0] || 'Admin'}</Text>
                <Text style={styles.subGreeting}>{getGreeting()}</Text>
                <Text style={styles.roleText}>Super admin</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.menuButton} onPress={() => navigation.navigate('Profile')}>
              <Ionicons name="menu" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Content Area */}
        <View style={styles.contentArea}>
          {/* Stats Grid - 2x2 */}
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <StatCard
                title="Clients"
                value={overview?.totalClients || 0}
                iconName="handshake-outline"
                buttonText="Add New Client"
                onButtonPress={() => navigation.navigate('AddClient')}
              />
              <StatCard
                title="Projects"
                value={overview?.totalActiveProjects || 0}
                iconName="clipboard-outline"
                buttonText="Add New Projects"
                onButtonPress={() => navigation.navigate('AddProject')}
              />
            </View>
            <View style={styles.statsRow}>
              <StatCard
                title="Employee"
                value={overview?.totalActiveEmployees || 0}
                iconName="people-outline"
                buttonText="Add New Employee"
                onButtonPress={() => navigation.navigate('AddEmployee')}
              />
              <StatCard
                title="Task"
                value={0} //{overview?.totalActiveTasks || 0}
                iconName="list-outline"
                buttonText="Add New Task"
                onButtonPress={() => navigation.navigate('CreateTask')}
              />
            </View>
          </View>

          {/* Organization QR Code Section */}
          {organization && (
            <Card style={styles.qrCard}>
              <Text style={styles.qrTitle}>{t('organization.employee_registration_qr')}</Text>
              <Text style={styles.qrSubtitle}>{t('organization.share_qr_code')}</Text>
              <View style={styles.qrContainer}>
                <View style={styles.qrWrapper}>
                  <QRCode 
                    value={organization.join_code} 
                    size={200} 
                    backgroundColor="#fff" 
                    color="#111" 
                  />
                </View>
                <Text style={styles.qrCodeText}>{t('organization.join_code')}: {organization.join_code}</Text>
                <Text style={styles.qrNote}>{t('organization.employees_can_scan')}</Text>
              </View>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_COLOR,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BG_COLOR,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: PRIMARY_PURPLE,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Header Styles
  header: {
    backgroundColor: PRIMARY_PURPLE,
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 26,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 41,
    height: 41,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '700',
    color: PRIMARY_PURPLE,
  },
  headerTextContainer: {
    justifyContent: 'center',
  },
  greeting: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  subGreeting: {
    fontSize: 20,
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
    color: '#FFFFFF',
    opacity: 0.95,
    marginTop: -2,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
    color: '#E8E7ED',
    opacity: 0.8,
    marginTop: 2,
  },
  menuButton: {
    width: 42,
    height: 42,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Content Area
  contentArea: {
    flex: 1,
    backgroundColor: BG_COLOR,
    paddingTop: 64,
  },

  // Stats Grid
  statsGrid: {
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 16,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    width: 176,
    height: 142,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statCardTitle: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    color: '#404040',
    marginTop: -4,
  },
  statCardIcon: {
    opacity: 0.6,
  },
  statCardValue: {
    fontSize: 40,
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
    color: '#727272',
    marginTop: -22,
    marginBottom: 10,
  },
  statCardButton: {
    backgroundColor: BUTTON_COLOR,
    borderRadius: 25,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  statCardButtonText: {
    fontSize: 12,
    fontWeight: '400',
    fontFamily: 'Inter_400Regular',
    color: '#FFFFFF',
  },

  // QR Code Section (kept as is)
  qrCard: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
    padding: 20,
    alignItems: 'center',
    borderRadius: 16,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    textAlign: 'center',
  },
  qrSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    width: '100%',
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qrCodeText: {
    fontSize: 16,
    fontWeight: '700',
    color: PRIMARY_PURPLE,
    marginBottom: 8,
    letterSpacing: 1,
  },
  qrNote: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
