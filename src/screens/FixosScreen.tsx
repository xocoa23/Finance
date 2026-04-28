import React, { useEffect, useState } from 'react';
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
import { useFixedExpenses, useCategories } from '../hooks/useStorage';
import { CategoryDot } from '../components/CategoryDot';
import { FABButton } from '../components/FABButton';
import { Icon } from '../components/Icon';
import { MoneyText } from '../components/MoneyText';
import { COLORS, FixedExpense, RADIUS, SPACING } from '../types';
import {
  formatCurrencyInput,
  parseCurrencyInput,
  generateId,
  getCurrentMonthKey,
} from '../utils/formatters';
import { notifications } from '../services/notifications';

export function FixosScreen() {
  const { items, add, update, remove } = useFixedExpenses();
  const { items: categories } = useCategories();
  const [editing, setEditing] = useState<FixedExpense | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const monthKey = getCurrentMonthKey();
  const findCategory = (id: string) => categories.find((c) => c.id === id);

  useEffect(() => {
    notifications.rescheduleAll(items).catch(() => {});
  }, [items]);

  const togglePago = async (item: FixedExpense) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const pagoNoMes = { ...item.pagoNoMes, [monthKey]: !item.pagoNoMes?.[monthKey] };
    await update({ ...item, pagoNoMes });
  };

  const totalMes = items.reduce((s, f) => s + f.valor, 0);
  const pagosMes = items.filter((f) => f.pagoNoMes?.[monthKey]).reduce((s, f) => s + f.valor, 0);
  const pendenteMes = totalMes - pagosMes;

  const openActionSheet = (item: FixedExpense) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const handleEdit = () => {
      setEditing(item);
      setModalOpen(true);
    };
    const handleDelete = () => {
      Alert.alert('Excluir gasto fixo', 'Esta ação não pode ser desfeita.', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            await notifications.cancelByExpenseId(item.id);
            await remove(item.id);
          },
        },
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
        (idx) => {
          if (idx === 1) handleEdit();
          else if (idx === 2) handleDelete();
        },
      );
    } else {
      Alert.alert(item.descricao, undefined, [
        { text: 'Editar', onPress: handleEdit },
        { text: 'Excluir', style: 'destructive', onPress: handleDelete },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Gastos fixos</Text>
        <Text style={styles.subtitle}>Lembretes 3 dias antes do vencimento</Text>
      </View>

      {items.length > 0 && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Pendente</Text>
            <MoneyText value={pendenteMes} style={[styles.summaryValue, { color: COLORS.warning }]} />
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Pago</Text>
            <MoneyText value={pagosMes} style={[styles.summaryValue, { color: COLORS.primary }]} />
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total</Text>
            <MoneyText value={totalMes} style={styles.summaryValue} />
          </View>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const pago = !!item.pagoNoMes?.[monthKey];
          const cat = findCategory(item.categoriaId);
          return (
            <Pressable onLongPress={() => openActionSheet(item)} onPress={() => openActionSheet(item)}>
              <View style={[styles.card, pago && styles.cardPago]}>
                <View style={styles.cardLeft}>
                  <View style={[styles.dayBadge, pago && { backgroundColor: COLORS.primarySoft }]}>
                    <Text style={[styles.dayText, pago && { color: COLORS.primary }]}>
                      {String(item.diaVencimento).padStart(2, '0')}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, pago && styles.cardTitlePago]}>{item.descricao}</Text>
                    <View style={styles.cardMetaRow}>
                      <CategoryDot color={cat?.cor ?? COLORS.textMuted} size={6} />
                      <Text style={styles.cardMeta}>{cat?.nome ?? 'Sem categoria'}</Text>
                    </View>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <MoneyText value={item.valor} style={[styles.cardValor, pago && styles.cardValorPago]} />
                  <TouchableOpacity
                    onPress={() => togglePago(item)}
                    style={[styles.payBtn, pago && styles.payBtnActive]}
                    activeOpacity={0.7}
                  >
                    {pago ? (
                      <Icon name="checkmark-circle" size={14} color={COLORS.primary} />
                    ) : null}
                    <Text style={[styles.payBtnText, pago && styles.payBtnTextActive]}>
                      {pago ? 'Pago' : 'Marcar pago'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="pin-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum gasto fixo</Text>
            <Text style={styles.emptyText}>
              Cadastre suas contas mensais (aluguel, internet, assinaturas) e receba lembretes 3
              dias antes do vencimento.
            </Text>
          </View>
        }
      />

      <FABButton onPress={() => { setEditing(null); setModalOpen(true); }} />

      <FixedModal
        visible={modalOpen}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={async (item) => {
          if (editing) await update(item);
          else await add(item);
          setModalOpen(false);
          setEditing(null);
        }}
      />
    </SafeAreaView>
  );
}

interface ModalProps {
  visible: boolean;
  editing: FixedExpense | null;
  onClose: () => void;
  onSave: (f: FixedExpense) => Promise<void>;
}

function FixedModal({ visible, editing, onClose, onSave }: ModalProps) {
  const { items: categories } = useCategories();
  const [descricao, setDescricao] = useState('');
  const [valorRaw, setValorRaw] = useState('');
  const [categoriaId, setCategoriaId] = useState(categories[0]?.id ?? '');
  const [dia, setDia] = useState('5');

  React.useEffect(() => {
    if (!visible) return;
    if (editing) {
      setDescricao(editing.descricao);
      setValorRaw(String(Math.round(editing.valor * 100)));
      setCategoriaId(editing.categoriaId);
      setDia(String(editing.diaVencimento));
    } else {
      setDescricao('');
      setValorRaw('');
      setCategoriaId(categories[0]?.id ?? '');
      setDia('5');
    }
  }, [visible, editing, categories]);

  const handle = async () => {
    if (!descricao.trim()) return Alert.alert('Atenção', 'Informe a descrição.');
    const valor = parseCurrencyInput(valorRaw);
    if (valor <= 0) return Alert.alert('Atenção', 'Informe o valor.');
    const diaNum = parseInt(dia, 10);
    if (!diaNum || diaNum < 1 || diaNum > 31) return Alert.alert('Atenção', 'Dia inválido (1-31).');

    await onSave({
      id: editing?.id ?? generateId(),
      descricao: descricao.trim(),
      valor,
      categoriaId,
      diaVencimento: diaNum,
      pagoNoMes: editing?.pagoNoMes ?? {},
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
          <Text style={styles.modalTitle}>{editing ? 'Editar' : 'Novo gasto fixo'}</Text>
          <TouchableOpacity onPress={handle}>
            <Text style={styles.modalSave}>Salvar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Ex: Aluguel, Internet"
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>Valor</Text>
          <TextInput
            value={formatCurrencyInput(valorRaw)}
            onChangeText={setValorRaw}
            keyboardType="numeric"
            style={[styles.input, styles.inputBig]}
          />
          <Text style={styles.label}>Dia de vencimento (1-31)</Text>
          <TextInput
            value={dia}
            onChangeText={setDia}
            keyboardType="numeric"
            style={styles.input}
          />
          <Text style={styles.label}>Categoria</Text>
          <View style={styles.catGrid}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.catChip, categoriaId === c.id && styles.catChipActive]}
                onPress={() => setCategoriaId(c.id)}
                activeOpacity={0.7}
              >
                <CategoryDot color={c.cor} size={10} />
                <Text style={styles.catChipText}>{c.nome}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.notice}>
            <Icon name="notifications-outline" size={16} color={COLORS.primary} />
            <Text style={styles.noticeText}>
              Você receberá uma notificação 3 dias antes do vencimento, todo mês.
            </Text>
          </View>
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

  summaryCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: COLORS.borderSoft },
  summaryLabel: { color: COLORS.textMuted, fontSize: 11, marginBottom: 4 },
  summaryValue: { color: COLORS.text, fontSize: 14, fontWeight: '700' },

  list: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardPago: { opacity: 0.6 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
  dayBadge: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  cardTitlePago: { textDecorationLine: 'line-through' },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  cardMeta: { color: COLORS.textSecondary, fontSize: 12 },
  cardValor: { color: COLORS.text, fontSize: 15, fontWeight: '700' },
  cardValorPago: { color: COLORS.textSecondary },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  payBtnActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  payBtnText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  payBtnTextActive: { color: COLORS.primary },

  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginTop: SPACING.md },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: SPACING.xs,
    textAlign: 'center',
    lineHeight: 19,
  },

  modalSafe: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  modalTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  modalCancel: { color: COLORS.textSecondary, fontSize: 15 },
  modalSave: { color: COLORS.primary, fontSize: 15, fontWeight: '700' },
  modalBody: { padding: SPACING.lg, paddingBottom: 60 },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: COLORS.card,
    color: COLORS.text,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    fontSize: 15,
  },
  inputBig: { fontSize: 22, fontWeight: '600', paddingVertical: SPACING.lg },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  catChipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  catChipText: { color: COLORS.text, fontSize: 13, fontWeight: '500' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  noticeText: { color: COLORS.text, fontSize: 12, flex: 1, lineHeight: 17 },
});
