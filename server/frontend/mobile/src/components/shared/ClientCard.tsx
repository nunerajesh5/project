import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type ClientCardProps = {
  client: {
    id: string;
    name: string;
    clientCode?: string;
    client_type?: string;
    location?: string;
    contact_person?: string;
    email?: string;
    phone?: string;
    address?: string;
    onboard_date?: string;
    project_count?: number;
  };
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMore?: () => void;
  canDelete?: boolean;
  canEdit?: boolean;
};

export default function ClientCard({ 
  client, 
  onPress, 
  onEdit,
  onDelete, 
  onMore,
  canDelete = false,
  canEdit = false 
}: ClientCardProps) {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <View style={styles.cardContainer}>
      <TouchableOpacity 
        onPress={() => setExpanded(!expanded)} 
        style={styles.cardHeader}
        activeOpacity={0.7}
      >
        <View style={styles.headerContent}>
          <Text style={styles.clientName}>{client.name}</Text>
          <Text style={styles.clientSubtitle}>
            {client.client_type || 'Client'}{client.location ? ` | ${client.location}` : ''}
          </Text>
        </View>
        <Ionicons 
          name={expanded ? 'chevron-up' : 'chevron-down'} 
          size={24} 
          color="#6B5CE7" 
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedContent}>
          {/* Address */}
          {client.address && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Address:</Text>
              <Text style={styles.value}>{client.address}</Text>
            </View>
          )}

          {/* Mobile and Email Row */}
          <View style={styles.twoColumnRow}>
            <View style={styles.column}>
              <Text style={styles.label}>Mobile:</Text>
              <Text style={styles.value}>{client.phone || '-'}</Text>
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Email:</Text>
              <Text style={styles.value}>{client.email || '-'}</Text>
            </View>
          </View>

          {/* Onboard Date and Number of Projects Row */}
          <View style={styles.twoColumnRow}>
            <View style={styles.column}>
              <Text style={styles.label}>Onboard Date:</Text>
              <Text style={styles.value}>{formatDate(client.onboard_date)}</Text>
            </View>
            <View style={styles.column}>
              <Text style={styles.label}>Number of Projects:</Text>
              <Text style={styles.value}>{client.project_count ?? 0}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {canEdit && onEdit && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.editButton]} 
                onPress={onEdit}
              >
                <Ionicons name="pencil" size={14} color="#fff" />
                <Text style={styles.editButtonText}>Edit</Text>
              </TouchableOpacity>
            )}
            
            {canDelete && onDelete && (
              <TouchableOpacity 
                style={[styles.actionButton, styles.deleteButton]} 
                onPress={onDelete}
              >
                <Ionicons name="trash" size={14} color="#fff" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[styles.actionButton, styles.moreButton]} 
              onPress={onPress}
            >
              <Ionicons name="apps" size={14} color="#6B5CE7" />
              <Text style={styles.moreButtonText}>More</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  headerContent: {
    flex: 1,
    marginRight: 12,
  },
  clientName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  clientSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  expandedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  infoRow: {
    marginBottom: 12,
  },
  twoColumnRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  column: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    color: '#888',
    marginBottom: 2,
  },
  value: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  editButton: {
    backgroundColor: '#6B5CE7',
  },
  editButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#6B5CE7',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  moreButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#6B5CE7',
  },
  moreButtonText: {
    color: '#6B5CE7',
    fontSize: 14,
    fontWeight: '600',
  },
});
