import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import { api } from '../../api/client';
import VoiceToTextButton from '../../components/shared/VoiceToTextButton';
import { tokens } from '../../design/tokens';

const { typography } = tokens;

export default function ProjectsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const { user } = useContext(AuthContext);

  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'in_progress' | 'new' | 'completed' | 'all'>('in_progress');

  const loadProjects = async () => {
    try {
      setLoading(true);
      if (!user?.id) {
        setProjects([]);
        return;
      }
      const response = await api.get('/api/projects/assigned');
      const employeeProjects = response.data?.projects || [];
      setProjects(employeeProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, [user?.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  };

  const getStatusCounts = () => {
    const inProgress = projects.filter(p => p.status === 'active' || p.status === 'in_progress').length;
    const newProjects = projects.filter(p => p.status === 'pending' || p.status === 'todo').length;
    const completed = projects.filter(p => p.status === 'completed').length;
    return {
      in_progress: inProgress,
      new: newProjects,
      completed,
      all: projects.length,
    };
  };

  const statusCounts = getStatusCounts();

  const filteredProjects = projects.filter(project => {
    if (selectedFilter === 'in_progress') {
      if (project.status !== 'active' && project.status !== 'in_progress') return false;
    } else if (selectedFilter === 'new') {
      if (project.status !== 'pending' && project.status !== 'todo') return false;
    } else if (selectedFilter === 'completed') {
      if (project.status !== 'completed') return false;
    }

    if (search) {
      const s = search.toLowerCase();
      if (
        !project.name?.toLowerCase().includes(s) &&
        !project.location?.toLowerCase().includes(s)
      ) {
        return false;
      }
    }

    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'in_progress':
        return '#877ED2';
      case 'completed':
        return '#34C759';
      case 'pending':
      case 'todo':
      case 'on_hold':
        return '#FF9500';
      case 'cancelled':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const getStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'pending':
      case 'todo':
        return 'New';
      case 'on_hold':
        return 'On Hold';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status || 'Unknown';
    }
  };

  const getDaysRemaining = (endDate: string) => {
    if (!endDate) return 0;
    const due = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const isOverdue = (endDate: string) => getDaysRemaining(endDate) < 0;

  const formatProjectDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const formatted = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    // Add comma after month: "01 Oct 2025" -> "01 Oct, 2025"
    return formatted.replace(/(\w+)\s+(\d{4})/, '$1, $2');
  };

  const handleProjectPress = (project: any) => {
    navigation.navigate('EmployeeProjectDetails', { id: project.id });
  };

  if (loading && projects.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#877ED2" />
        <Text style={styles.loadingText}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Projects</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="ellipsis-vertical" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Status filters */}
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
          >
            <TouchableOpacity
              style={[styles.filterTab, selectedFilter === 'in_progress' && styles.filterTabActive]}
              onPress={() => setSelectedFilter('in_progress')}
            >
              <Text style={[styles.filterText, selectedFilter === 'in_progress' && styles.filterTextActive]}>
                In Progress ({statusCounts.in_progress})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, selectedFilter === 'new' && styles.filterTabActive]}
              onPress={() => setSelectedFilter('new')}
            >
              <Text style={[styles.filterText, selectedFilter === 'new' && styles.filterTextActive]}>
                New ({statusCounts.new})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, selectedFilter === 'completed' && styles.filterTabActive]}
              onPress={() => setSelectedFilter('completed')}
            >
              <Text style={[styles.filterText, selectedFilter === 'completed' && styles.filterTextActive]}>
                Completed ({statusCounts.completed})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, selectedFilter === 'all' && styles.filterTabActive]}
              onPress={() => setSelectedFilter('all')}
            >
              <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>
                All ({statusCounts.all})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Search bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchRow}>
            <View style={styles.searchInputContainer}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search"
                style={styles.searchInput}
                placeholderTextColor="#9CA3AF"
              />
              <TouchableOpacity style={styles.searchIconButton}>
                <Ionicons name="search" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <VoiceToTextButton
              onResult={text => {
                setSearch(text);
              }}
              size="small"
              style={styles.voiceButton}
              color="#877ED2"
            />
          </View>
        </View>

        {/* Project cards */}
        <View style={styles.projectsContainer}>
          {filteredProjects.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No Projects Found</Text>
              <Text style={styles.emptySubtitle}>No projects match your current filters.</Text>
            </View>
          ) : (
            filteredProjects.map(project => {
              const overdue = isOverdue(project.end_date || project.endDate);
              const daysRemaining = getDaysRemaining(project.end_date || project.endDate);
              const statusColor = getStatusColor(project.status);

              return (
                <TouchableOpacity
                  key={project.id}
                  style={styles.projectCard}
                  onPress={() => handleProjectPress(project)}
                  activeOpacity={0.7}
                >
                  <View style={styles.projectCardTop}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                      <Text style={styles.statusBadgeText}>{getStatusText(project.status)}</Text>
                    </View>
                    <View style={styles.avatarContainer}>
                      <View style={styles.avatar}>
                        <Ionicons name="person" size={18} color="#FF9500" />
                      </View>
                      <View style={styles.avatarPlus}>
                        <Text style={styles.avatarPlusText}>+</Text>
                      </View>
                    </View>
                  </View>

                  {project.location && (
                    <View style={styles.locationRow}>
                      <Text style={styles.locationText}>{project.location}</Text>
                    </View>
                  )}

                  <Text style={styles.projectName}>{project.name}</Text>

                  <View style={styles.datesContainer}>
                    <View style={styles.dateSection}>
                      <Text style={styles.dateLabel}>Start</Text>
                      <Text style={styles.dateValue}>
                        {formatProjectDate(project.start_date || project.startDate)}
                      </Text>
                    </View>
                    <View style={styles.dateSection}>
                      <Text style={styles.dateLabel}>End</Text>
                      <Text style={styles.dateValue}>
                        {formatProjectDate(project.end_date || project.endDate)}
                      </Text>
                    </View>
                    <View style={styles.dateSection}>
                      {overdue ? (
                        <>
                          <View style={styles.overdueRow}>
                            <Text style={styles.dateLabel}>Over due</Text>
                            <Text style={styles.overdueValue}>{Math.abs(daysRemaining)}d</Text>
                          </View>
                          <View style={styles.overdueBar} />
                        </>
                      ) : project.status === 'active' || project.status === 'in_progress' ? (
                        <>
                          <View style={styles.overdueRow}>
                            <Text style={styles.dateLabel}>In Progress</Text>
                            <Text style={styles.inProgressValue}>{daysRemaining}d</Text>
                          </View>
                          <View style={styles.inProgressBar} />
                        </>
                      ) : project.status === 'completed' ? (
                        <>
                          <View style={styles.overdueRow}>
                            <Text style={styles.dateLabel}>Completed</Text>
                            <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                          </View>
                          <View style={styles.completedBar} />
                        </>
                      ) : project.status === 'pending' || project.status === 'todo' ? (
                        <>
                          <View style={styles.overdueRow}>
                            <Text style={styles.dateLabel}>New</Text>
                            <Text style={styles.newValue}>{daysRemaining}d</Text>
                          </View>
                          <View style={styles.newBar} />
                        </>
                      ) : project.status === 'on_hold' ? (
                        <>
                          <View style={styles.overdueRow}>
                            <Text style={styles.dateLabel}>On Hold</Text>
                            <Ionicons name="pause-circle" size={14} color="#FF9500" />
                          </View>
                          <View style={styles.onHoldBar} />
                        </>
                      ) : project.status === 'cancelled' ? (
                        <>
                          <View style={styles.overdueRow}>
                            <Text style={styles.dateLabel}>Cancelled</Text>
                            <Ionicons name="close-circle" size={14} color="#FF3B30" />
                          </View>
                          <View style={styles.cancelledBar} />
                        </>
                      ) : (
                        <>
                          <View style={styles.overdueRow}>
                            <Text style={styles.dateLabel}>Status</Text>
                            <Text style={styles.unknownValue}>—</Text>
                          </View>
                          <View style={styles.unknownBar} />
                        </>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 12,
    backgroundColor: '#F5F5F5',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '400',
    color: '#000000',
    fontFamily: typography.families.regular,
    marginLeft: 8,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  filterContainer: {
    backgroundColor: 'transparent',
    paddingTop: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E6EB',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  filterTab: {
    marginRight: 20,
    paddingBottom: 6,
    position: 'relative',
  },
  filterTabActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#877ED2',
    marginBottom: -1,
  },
  filterText: {
    fontSize: 16,
    color: '#8F8F8F',
    fontFamily: typography.families.regular,
    fontWeight: '400',
  },
  filterTextActive: {
    color: '#000000',
    fontWeight: '400',
    fontFamily: typography.families.regular,
    fontSize: 16,
  },
  searchContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: '#E5E6EB',
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1A1A1A',
    fontFamily: typography.families.regular,
  },
  voiceButton: {
    marginLeft: 12,
  },
  searchIconButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectsContainer: {
    padding: 16,
  },
  projectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    height: 151,
    width: 372,
  },
  projectCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: -14,
  },
  statusBadgeText: {
    fontSize: 10,
    paddingTop: 2,
    fontWeight: '400',
    color: '#FFFFFF',
    fontFamily: typography.families.regular,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    position: 'absolute',
    top: 10,
    right: 16,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 16,
    // backgroundColor: '#FF9500',
    borderColor: '#FF9500',
    borderStyle: 'solid',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 2,
    borderWidth: 1.5,
  },
  avatarPlus: {
    width: 26,
    height: 26,
    borderRadius: 16,
    backgroundColor: '#666666',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 0,
    left: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    zIndex: 1,
  },
  avatarPlusText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
    fontFamily: typography.families.bold,
    textAlign: 'center',
    lineHeight: 16,
  },
  locationRow: {
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 2,
  },
  locationText: {
    fontSize: 10,
    color: '#727272',
    fontFamily: typography.families.regular,
    fontWeight: '400',
  },
  projectName: {
    fontSize: 18,
    fontWeight: '500',
    color: '#404040',
    marginBottom: 8,
    marginTop: 0,
    paddingHorizontal: 16,
    fontFamily: typography.families.medium,
  },
  datesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  dateSection: {
    flex: 1,
  },
  dateLabel: {
    fontSize: 10,
    color: '#727272',
    fontWeight: '400',
    marginBottom: 4,
    fontFamily: typography.families.regular,
  },
  dateValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#404040',
    fontFamily: typography.families.medium,
    marginTop: -4,
  },
  overdueValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF3B30',
    fontFamily: typography.families.semibold,
  },
  overdueBar: {
    height: 2,
    backgroundColor: '#FF3B30',
    borderRadius: 1,
    width: 90,
    marginTop: 4,
    marginLeft: 26,
  },
  inProgressValue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#85C369',
    fontFamily: typography.families.bold,
  },
  inProgressBar: {
    height: 2,
    backgroundColor: '#85C369',
    borderRadius: 4,
    width: 90,
    marginTop: 4,
    marginLeft: 26,
  },
  completedBar: {
    height: 2,
    backgroundColor: '#34C759',
    borderRadius: 4,
    width: 90,
    marginTop: 4,
    marginLeft: 26,
  },
  newValue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#007AFF',
    fontFamily: typography.families.bold,
  },
  newBar: {
    height: 2,
    backgroundColor: '#007AFF',
    borderRadius: 4,
    width: 90,
    marginTop: 4,
    marginLeft: 26,
  },
  onHoldBar: {
    height: 2,
    backgroundColor: '#FF9500',
    borderRadius: 4,
    width: 90,
    marginTop: 4,
    marginLeft: 26,
  },
  cancelledBar: {
    height: 2,
    backgroundColor: '#FF3B30',
    borderRadius: 4,
    width: 90,
    marginTop: 4,
    marginLeft: 26,
  },
  unknownValue: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    fontFamily: typography.families.bold,
  },
  unknownBar: {
    height: 2,
    backgroundColor: '#8E8E93',
    borderRadius: 4,
    width: 90,
    marginTop: 4,
    marginLeft: 26,
  },
  overdueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 26,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    fontFamily: typography.families.semibold,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontFamily: typography.families.regular,
  },
});


