import React, { useContext } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../../context/AuthContext';
import SafeAreaWrapper from '../../components/shared/SafeAreaWrapper';

const APP_VERSION = '1.0';

export default function ProfileScreen() {
  const { logout } = useContext(AuthContext);
  const navigation = useNavigation<any>();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout }
      ]
    );
  };

  // Menu Item Component
  const MenuItem = ({ 
    title, 
    onPress,
    showBorder = true,
  }: {
    title: string;
    onPress: () => void;
    showBorder?: boolean;
  }) => (
    <TouchableOpacity 
      style={[styles.menuItem, showBorder && styles.menuItemBorder]} 
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Text style={styles.menuItemText}>{title}</Text>
      <Ionicons name="chevron-forward" size={20} color="#6F67CC" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaWrapper backgroundColor="#F5F5F5">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>More</Text>
      </View>

      <ScrollView 
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Section 1: My Task */}
        <View style={styles.myTaskSection}>
          <TouchableOpacity 
            style={styles.myTaskItem}
            onPress={() => navigation.navigate('EmployeeAllTasks')}
            activeOpacity={0.6}
          >
            <Text style={styles.menuItemText}>My Task</Text>
            <Ionicons name="chevron-forward" size={20} color="#6F67CC" />
          </TouchableOpacity>
        </View>

        {/* Section 2: Main Menu */}
        <View style={styles.sectionContainer}>
          <View style={styles.styledSection}>
            <MenuItem 
              title="Projects" 
              onPress={() => navigation.navigate('Projects')}
            />
            <MenuItem 
              title="Time Entries" 
              onPress={() => navigation.navigate('Timesheet')}
            />
            <MenuItem 
              title="My Uploads" 
              onPress={() => navigation.navigate('MyUploads')}
              showBorder={false}
            />
          </View>
        </View>

        {/* Section 3: Settings & More */}
        <View style={styles.sectionContainer}>
          <View style={styles.styledSection}>
            <MenuItem 
              title="Personal Information" 
              onPress={() => Alert.alert('Personal Information', 'Coming soon!')}
            />
            <MenuItem 
              title="Change Password" 
              onPress={() => Alert.alert('Change Password', 'Coming soon!')}
            />
            <MenuItem 
              title="Language option" 
              onPress={() => Alert.alert('Language', 'Coming soon!')}
            />
            <MenuItem 
              title="Notifications" 
              onPress={() => Alert.alert('Notifications', 'Coming soon!')}
              showBorder={false}
            />
          </View>
        </View>

        {/* Section 4: Support */}
        <View style={styles.sectionContainer}>
          <View style={styles.styledSection}>
            <MenuItem 
              title="Help & Support" 
              onPress={() => Alert.alert('Help & Support', 'Coming soon!')}
            />
            <MenuItem 
              title="About" 
              onPress={() => Alert.alert('About', 'Project Time Manager v1.0')}
              showBorder={false}
            />
          </View>
        </View>

        {/* Section 5: Logout */}
        <View style={styles.sectionContainer}>
          <TouchableOpacity 
            style={styles.logoutItem}
            onPress={handleLogout}
            activeOpacity={0.6}
          >
            <Text style={styles.menuItemText}>Logout</Text>
            <Ionicons name="chevron-forward" size={20} color="#6F67CC" />
          </TouchableOpacity>
        </View>

        {/* Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version {APP_VERSION}</Text>
        </View>
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 32,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '400',
    color: '#000000',
    marginLeft: 4,
  },

  // My Task Section
  myTaskSection: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  myTaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 59,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },

  // Sections
  sectionContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  styledSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    overflow: 'hidden',
  },

  // Logout Item
  logoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 59,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },

  // Menu Item
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
  },

  // Version
  versionContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 80,
    paddingBottom: 20,
  },
  versionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8F8F8F',
  },
});