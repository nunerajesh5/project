import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Switch } from 'react-native';

interface TaskFilter {
  status: string[];
  priority: string[];
  assignee: string[];
  project: string[];
  dueDate: string;
  createdDate: string;
}

interface TaskFilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApplyFilter: (filter: TaskFilter) => void;
  currentFilter: TaskFilter;
  availableAssignees: string[];
  availableProjects: string[];
}

export default function TaskFilterModal({
  visible,
  onClose,
  onApplyFilter,
  currentFilter,
  availableAssignees,
  availableProjects
}: TaskFilterModalProps) {
  const [filter, setFilter] = useState<TaskFilter>(currentFilter);

  const statusOptions = ['To Do', 'Active', 'Completed', 'Cancelled', 'On Hold'];
  const priorityOptions = ['low', 'medium', 'high', 'critical'];
  const dueDateOptions = ['today', 'tomorrow', 'this_week', 'next_week', 'this_month', 'overdue'];
  const createdDateOptions = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month'];

  const toggleArrayValue = (array: string[], value: string) => {
    if (array.includes(value)) {
      return array.filter(item => item !== value);
    } else {
      return [...array, value];
    }
  };

  const handleStatusToggle = (status: string) => {
    setFilter(prev => ({
      ...prev,
      status: toggleArrayValue(prev.status, status)
    }));
  };

  const handlePriorityToggle = (priority: string) => {
    setFilter(prev => ({
      ...prev,
      priority: toggleArrayValue(prev.priority, priority)
    }));
  };

  const handleAssigneeToggle = (assignee: string) => {
    setFilter(prev => ({
      ...prev,
      assignee: toggleArrayValue(prev.assignee, assignee)
    }));
  };

  const handleProjectToggle = (project: string) => {
    setFilter(prev => ({
      ...prev,
      project: toggleArrayValue(prev.project, project)
    }));
  };

  const handleApply = () => {
    onApplyFilter(filter);
    onClose();
  };

  const handleReset = () => {
    const resetFilter: TaskFilter = {
      status: [],
      priority: [],
      assignee: [],
      project: [],
      dueDate: '',
      createdDate: ''
    };
    setFilter(resetFilter);
  };

  const getActiveFilterCount = () => {
    return filter.status.length + filter.priority.length + filter.assignee.length + 
           filter.project.length + (filter.dueDate ? 1 : 0) + (filter.createdDate ? 1 : 0);
  };

  const renderFilterSection = (
    title: string,
    options: string[],
    selectedValues: string[],
    onToggle: (value: string) => void,
    getLabel?: (value: string) => string
  ) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.optionsContainer}>
        {options.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.optionButton,
              selectedValues.includes(option) && styles.optionButtonActive
            ]}
            onPress={() => onToggle(option)}
          >
            <Text style={[
              styles.optionText,
              selectedValues.includes(option) && styles.optionTextActive
            ]}>
              {getLabel ? getLabel(option) : option.charAt(0).toUpperCase() + option.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'To Do': return 'To Do';
      case 'Active': return 'Active';
      case 'Completed': return 'Completed';
      case 'Cancelled': return 'Cancelled';
      case 'On Hold': return 'On Hold';
      default: return status;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'low': return 'Low';
      case 'medium': return 'Medium';
      case 'high': return 'High';
      case 'critical': return 'Critical';
      default: return priority;
    }
  };

  const getDateLabel = (date: string) => {
    switch (date) {
      case 'today': return 'Today';
      case 'tomorrow': return 'Tomorrow';
      case 'this_week': return 'This Week';
      case 'next_week': return 'Next Week';
      case 'this_month': return 'This Month';
      case 'overdue': return 'Overdue';
      case 'yesterday': return 'Yesterday';
      case 'last_week': return 'Last Week';
      case 'last_month': return 'Last Month';
      default: return date;
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>
              Filter Tasks {getActiveFilterCount() > 0 && `(${getActiveFilterCount()})`}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {renderFilterSection(
              'Status',
              statusOptions,
              filter.status,
              handleStatusToggle,
              getStatusLabel
            )}

            {renderFilterSection(
              'Priority',
              priorityOptions,
              filter.priority,
              handlePriorityToggle,
              getPriorityLabel
            )}

            {renderFilterSection(
              'Due Date',
              dueDateOptions,
              [filter.dueDate].filter(Boolean),
              (value) => setFilter(prev => ({ ...prev, dueDate: prev.dueDate === value ? '' : value })),
              getDateLabel
            )}

            {renderFilterSection(
              'Created Date',
              createdDateOptions,
              [filter.createdDate].filter(Boolean),
              (value) => setFilter(prev => ({ ...prev, createdDate: prev.createdDate === value ? '' : value })),
              getDateLabel
            )}

            {availableAssignees.length > 0 && renderFilterSection(
              'Assignee',
              availableAssignees,
              filter.assignee,
              handleAssigneeToggle
            )}

            {availableProjects.length > 0 && renderFilterSection(
              'Project',
              availableProjects,
              filter.project,
              handleProjectToggle
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleReset}
            >
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApply}
            >
              <Text style={styles.applyButtonText}>Apply Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 20,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  optionButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  optionTextActive: {
    color: '#fff',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    gap: 12,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
