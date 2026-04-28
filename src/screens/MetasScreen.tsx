import React, { useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useGoals } from '../hooks/useStorage';
import { ProgressBar } from '../components/ProgressBar';
import { FABButton } from '../components/FABButton';
import { Icon } from '../components/Icon';
import { MoneyText } from '../components/MoneyText';
import { COLORS, Goal, RADIUS, SPACING } from '../types';
import { formatCurrencyInput, parseCurrencyInput, generateId } from '../utils/formatters';

export function MetasScreen() {
  const { items, add, update, remove } = useGoals();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [addValueGoal, setAddValueGoal] = useState<Goal | null>(null);
  const [addValueRaw, setAddValueRaw] = useState('');

  const openActionSheet = (item: Goal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const handleEdit = () => { setEditing(item); setModalOpen(true); };
    const handleDelete = () => {
      Alert.alert('Excluir meta', 'Esta ação não pode ser desfeita.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => remove(item.id) },
      ]);
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancelar', 'Editar', 'Excluir'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 2,
          userInterfaceStyle: 'dark',
        },
        (idx) => { if (idx === 1) handleEdit(); else if (idx === 2) handleDelete(); },
      );
    } else {
      Alert.alert(item.nome, undefined, [
        { text: 'Editar', onPress: handleEdit },
        { text: 'Excluir', style: 'destructive', onPress: handleDelete },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  };

  const handleAddValue = async () => {
    if (!addValueGoal) return;
    const v = parseCurrencyInput(addValueRaw);
    if (v <= 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await update({ ...addValueGoal, valorAtual: addValueGoal.valorAtual + v });
    setAddValueGoal(null);
    setAddValueRaw('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Metas</Text>
        <Text style={styles.subtitle}>Acompanhe seus objetivos financeiros</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(g) => g.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const progress =
            item.valorObjetivo > 0 ? Math.min(1, item.valorAtual / item.valorObjetivo) : 0;
          const concluido = progress >= 1;
          return (
            <Pressable onLongPress={() => openActionSheet(item)} onPress={() => openActionSheet(item)}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.nome}</Text>
                  <Text style={styles.percent}>{Math.round(progress * 100)}%</Text>
                </View>
                <View style={styles.valuesRow}>
                  <MoneyText value={item.valorAtual} style={styles.valorAtual} />
                  <MoneyText value={item.valorObjetivo} prefix="de " style={styles.valorObj} />
                </View>
                <View style={{ marginTop: SPACING.md }}>
                  <ProgressBar progress={progress} />
                </View>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => setAddValueGoal(item)}
                  disabled={concluido}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={concluido ? 'trophy' : 'add'}
                    size={16}
                    color={concluido ? COLORS.warning : COLORS.primary}
                  />
                  <Text
                    style={[
                      styles.addBtnText,
                      concluido && { color: COLORS.warning },
                    ]}
                  >
                    {concluido ? 'Meta atingida' : 'Adicionar valor'}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="flag-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Nenhuma meta</Text>
            <Text style={styles.emptyText}>
              Defina objetivos como reserva de emergência, viagem ou compra grande.
            </Text>
          </View>
        }
      />

      <FABButton onPress={() => { setEditing(null); setModalOpen(true); }} />

      <GoalModal
        visible={modalOpen}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={async (g) => {
          if (editing) await update(g);
          else await add(g);
          setModalOpen(false);
          setEditing(null);
        }}
      />

      <Modal
        visible={!!addValueGoal}
        transparent
        animationType="fade"
        onRequestClose={() => setAddValueGoal(null)}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Adicionar valor</Text>
            <Text style={styles.dialogSubtitle}>{addValueGoal?.nome}</Text>
            <TextInput
              value={formatCurrencyInput(addValueRaw)}
              onChangeText={setAddValueRaw}
              keyboardType="numeric"
              style={[styles.input, { marginTop: SPACING.md, fontSize: 22, fontWeight: '600' }]}
              autoFocus
            />
            <View style={styles.dialogRow}>
              <TouchableOpacity
                style={styles.dialogBtnGhost}
                onPress={() => { setAddValueGoal(null); setAddValueRaw(''); }}
              >
                <Text style={styles.modalCancel}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dialogBtnPrimary} onPress={handleAddValue}>
                <Text style={styles.dialogBtnPrimaryText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

interface ModalProps {
  visible: boolean;
  editing: Goal | null;
  onClose: () => void;
  onSave: (g: Goal) => Promise<void>;
}

function GoalModal({ visible, editing, onClose, onSave }: ModalProps) {
  const [nome, setNome] = useState('');
  const [objRaw, setObjRaw] = useState('');
  const [atualRaw, setAtualRaw] = useState('');

  React.useEffect(() => {
    if (!visible) return;
    if (editing) {
      setNome(editing.nome);
      setObjRaw(String(Math.round(editing.valorObjetivo * 100)));
      setAtualRaw(String(Math.round(editing.valorAtual * 100)));
    } else {
      setNome('');
      setObjRaw('');
      setAtualRaw('');
    }
  }, [visible, editing]);

  const handle = async () => {
    if (!nome.trim()) return Alert.alert('Atenção', 'Informe o nome.');
    const objetivo = parseCurrencyInput(objRaw);
    const atual = parseCurrencyInput(atualRaw);
    if (objetivo <= 0) return Alert.alert('Atenção', 'Informe o valor objetivo.');

    await onSave({
      id: editing?.id ?? generateId(),
      nome: nome.trim(),
      valorObjetivo: objetivo,
      valorAtual: atual,
      criadoEm: editing?.criadoEm ?? new Date().toISOString(),
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.modalCancel}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{editing ? 'Editar meta' : 'Nova meta'}</Text>
          <TouchableOpacity onPress={handle}>
            <Text style={styles.modalSave}>Salvar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <Text style={styles.label}>Nome</Text>
          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Ex: Viagem, Reserva de emergência"
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>Valor objetivo</Text>
          <TextInput
            value={formatCurrencyInput(objRaw)}
            onChangeText={setObjRaw}
            keyboardType="numeric"
            style={[styles.input, styles.inputBig]}
          />
          <Text style={styles.label}>Valor atual (já guardado)</Text>
          <TextInput
            value={formatCurrencyInput(atualRaw)}
            onChangeText={setAtualRaw}
            keyboardType="numeric"
            style={styles.input}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: SPACING.lg, paddingBottom: SPACING.md },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },

  list: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.card,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  percent: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  valuesRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: SPACING.xs },
  valorAtual: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  valorObj: { color: COLORS.textSecondary, fontSize: 13 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.md,
    backgroundColor: COLORS.cardElevated,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  addBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: SPACING.xl },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginTop: SPACING.md },
  emptyText: { color: COLORS.textMuted, fontSize: 13, marginTop: SPACING.xs, textAlign: 'center', lineHeight: 19 },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', padding: SPACING.xl,
  },
  dialog: { backgroundColor: COLORS.card, padding: SPACING.lg, borderRadius: RADIUS.lg, width: '100%' },
  dialogTitle: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  dialogSubtitle: { color: COLORS.textSecondary, fontSize: 13, marginTop: 4 },
  dialogRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.lg },
  dialogBtnGhost: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  dialogBtnPrimary: {
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
  },
  dialogBtnPrimaryText: { color: '#0a0a0b', fontSize: 14, fontWeight: '700' },

  modalSafe: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft,
  },
  modalTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  modalCancel: { color: COLORS.textSecondary, fontSize: 15 },
  modalSave: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  modalBody: { padding: SPACING.lg, paddingBottom: 60 },
  label: {
    color: COLORS.textSecondary, fontSize: 12,
    marginTop: SPACING.lg, marginBottom: SPACING.sm,
    textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.cardElevated, color: COLORS.text,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderRadius: RADIUS.md, fontSize: 15,
  },
  inputBig: { fontSize: 22, fontWeight: '600', paddingVertical: SPACING.lg },
});
