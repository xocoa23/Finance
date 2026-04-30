import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet, Modal } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Icon } from './Icon';
import { useTheme } from '../hooks/useTheme';
import { RADIUS, SPACING } from '../types';

interface Props {
  value: string;
  onChange: (iso: string) => void;
  allowPast?: boolean;
  allowEmpty?: boolean;
}

export function DateTimePickerField({ value, onChange, allowPast = true, allowEmpty = false }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const [date, setDate] = useState(() => {
    if (!value && allowEmpty) return new Date();
    try { return new Date(value || new Date().toISOString()); } catch { return new Date(); }
  });
  const [show, setShow] = useState(false);
  const [mode, setMode] = useState<'date' | 'time'>('date');

  const formattedDate = value ? format(date, "dd/MM/yyyy HH:mm", { locale: ptBR }) : (allowEmpty ? 'Sem data definida' : format(date, "dd/MM/yyyy HH:mm", { locale: ptBR }));

  const handleChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
    }
    
    if (selectedDate) {
      if (!allowPast && selectedDate < new Date()) {
        return;
      }
      setDate(selectedDate);
      onChange(selectedDate.toISOString());

      if (Platform.OS === 'android' && mode === 'date') {
        setMode('time');
        setShow(true);
      }
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={styles.inputContainer}
        onPress={() => {
          setMode('date');
          setShow(true);
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.inputText}>{formattedDate}</Text>
        <Icon name="calendar-outline" size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      {Platform.OS === 'ios' ? (
        <Modal visible={show} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                {allowEmpty && (
                  <TouchableOpacity onPress={() => { setShow(false); onChange(''); }} style={{ marginRight: 'auto' }}>
                    <Text style={[styles.modalAction, { color: colors.danger }]}>Limpar</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => {
                  setShow(false);
                  if (!value) onChange(date.toISOString());
                }}>
                  <Text style={styles.modalAction}>Concluir</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={date}
                mode="datetime"
                display="spinner"
                onChange={handleChange}
                textColor={colors.text}
                minimumDate={allowPast ? undefined : new Date()}
                locale="pt-BR"
              />
            </View>
          </View>
        </Modal>
      ) : (
        show && (
          <DateTimePicker
            value={date}
            mode={mode}
            display="default"
            onChange={handleChange}
            minimumDate={allowPast ? undefined : new Date()}
          />
        )
      )}
    </View>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  inputText: {
    color: colors.text,
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: colors.card,
    paddingBottom: SPACING.xl,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  modalAction: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
