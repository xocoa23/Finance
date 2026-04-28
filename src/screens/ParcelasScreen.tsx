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
import { useInstallments } from '../hooks/useStorage';
import { ProgressBar } from '../components/ProgressBar';
import { FABButton } from '../components/FABButton';
import { Icon } from '../components/Icon';
import { MoneyText } from '../components/MoneyText';
import { COLORS, Installment, RADIUS, SPACING } from '../types';
import { formatCurrencyInput, parseCurrencyInput, generateId } from '../utils/formatters';

export function ParcelasScreen() {
  const { items, add, update, remove } = useInstallments();
  const [editing, setEditing] = useState<Installment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const registrarPagamento = async (item: Installment) => {
    if (item.parcelasPagas >= item.numeroParcelas) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    await update({ ...item, parcelasPagas: item.parcelasPagas + 1 });
  };

  const openActionSheet = (item: Installment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const handleEdit = () => { setEditing(item); setModalOpen(true); };
    const handleDelete = () => {
      Alert.alert('Excluir parcelamento', 'Esta ação não pode ser desfeita.', [
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
      Alert.alert(item.descricao, undefined, [
        { text: 'Editar', onPress: handleEdit },
        { text: 'Excluir', style: 'destructive', onPress: handleDelete },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  };

  const totalDivida = items.reduce(
    (s, i) => s + (i.valorTotal - i.parcelasPagas * i.valorParcela),
    0,
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Parcelas</Text>
        <Text style={styles.subtitle}>Acompanhe o que ainda deve</Text>
      </View>

      {items.length > 0 && (
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total a pagar</Text>
          <MoneyText value={totalDivida} style={styles.totalValue} />
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const progress = item.numeroParcelas > 0 ? item.parcelasPagas / item.numeroParcelas : 0;
          const restante = item.valorTotal - item.parcelasPagas * item.valorParcela;
          const concluido = item.parcelasPagas >= item.numeroParcelas;
          return (
            <Pressable onLongPress={() => openActionSheet(item)} onPress={() => openActionSheet(item)}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.descricao}</Text>
                  {concluido && (
                    <View style={styles.doneBadge}>
                      <Icon name="checkmark" size={12} color={COLORS.primary} />
                      <Text style={styles.doneText}>Quitado</Text>
                    </View>
                  )}
                </View>
                <View style={styles.cardRow}>
                  <MoneyText value={item.valorParcela} style={styles.cardSubValue} />
                  <Text style={styles.cardMeta}>
                    {item.parcelasPagas} de {item.numeroParcelas} parcelas
                  </Text>
                </View>
                <View style={{ marginTop: SPACING.md }}>
                  <ProgressBar progress={progress} />
                </View>
                <View style={styles.footer}>
                  <View>
                    <Text style={styles.cardMeta}>Restante</Text>
                    <MoneyText value={restante} style={styles.restanteValor} />
                  </View>
                  {!concluido && (
                    <TouchableOpacity
                      onPress={() => registrarPagamento(item)}
                      style={styles.payBtn}
                      activeOpacity={0.8}
                    >
                      <Icon name="checkmark" size={14} color="#0a0a0b" />
                      <Text style={styles.payBtnText}>Registrar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="card-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum parcelamento</Text>
            <Text style={styles.emptyText}>
              Cadastre dívidas parceladas pra acompanhar quanto falta pra quitar.
            </Text>
          </View>
        }
      />

      <FABButton onPress={() => { setEditing(null); setModalOpen(true); }} />

      <InstallmentModal
        visible={modalOpen}
        editing={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={async (i) => {
          if (editing) await update(i);
          else await add(i);
          setModalOpen(false);
          setEditing(null);
        }}
      />
    </SafeAreaView>
  );
}

interface ModalProps {
  visible: boolean;
  editing: Installment | null;
  onClose: () => void;
  onSave: (i: Installment) => Promise<void>;
}

function InstallmentModal({ visible, editing, onClose, onSave }: ModalProps) {
  const [descricao, setDescricao] = useState('');
  const [valorRaw, setValorRaw] = useState('');
  const [numero, setNumero] = useState('12');
  const [pagas, setPagas] = useState('0');

  React.useEffect(() => {
    if (!visible) return;
    if (editing) {
      setDescricao(editing.descricao);
      setValorRaw(String(Math.round(editing.valorTotal * 100)));
      setNumero(String(editing.numeroParcelas));
      setPagas(String(editing.parcelasPagas));
    } else {
      setDescricao('');
      setValorRaw('');
      setNumero('12');
      setPagas('0');
    }
  }, [visible, editing]);

  const handle = async () => {
    if (!descricao.trim()) return Alert.alert('Atenção', 'Informe a descrição.');
    const valor = parseCurrencyInput(valorRaw);
    if (valor <= 0) return Alert.alert('Atenção', 'Informe o valor total.');
    const n = parseInt(numero, 10);
    const p = parseInt(pagas, 10);
    if (!n || n < 1) return Alert.alert('Atenção', 'Número de parcelas inválido.');
    if (isNaN(p) || p < 0 || p > n) return Alert.alert('Atenção', 'Parcelas pagas inválidas.');

    await onSave({
      id: editing?.id ?? generateId(),
      descricao: descricao.trim(),
      valorTotal: valor,
      numeroParcelas: n,
      parcelasPagas: p,
      valorParcela: valor / n,
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
          <Text style={styles.modalTitle}>{editing ? 'Editar' : 'Novo parcelamento'}</Text>
          <TouchableOpacity onPress={handle}>
            <Text style={styles.modalSave}>Salvar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <Text style={styles.label}>Descrição</Text>
          <TextInput
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Ex: Notebook"
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
          />
          <Text style={styles.label}>Valor total</Text>
          <TextInput
            value={formatCurrencyInput(valorRaw)}
            onChangeText={setValorRaw}
            keyboardType="numeric"
            style={[styles.input, styles.inputBig]}
          />
          <Text style={styles.label}>Número de parcelas</Text>
          <TextInput
            value={numero}
            onChangeText={setNumero}
            keyboardType="numeric"
            style={styles.input}
          />
          <Text style={styles.label}>Parcelas já pagas</Text>
          <TextInput
            value={pagas}
            onChangeText={setPagas}
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

  totalCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
  },
  totalLabel: { color: COLORS.textMuted, fontSize: 12 },
  totalValue: { color: COLORS.danger, fontSize: 24, fontWeight: '700', marginTop: 4 },

  list: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '600', flex: 1 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  cardSubValue: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  cardMeta: { color: COLORS.textSecondary, fontSize: 12 },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  doneText: { color: COLORS.primary, fontSize: 11, fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: SPACING.md },
  restanteValor: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginTop: 2 },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
  },
  payBtnText: { color: '#0a0a0b', fontSize: 13, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: SPACING.xl },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginTop: SPACING.md },
  emptyText: { color: COLORS.textMuted, fontSize: 13, marginTop: SPACING.xs, textAlign: 'center', lineHeight: 19 },

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
    backgroundColor: COLORS.card, color: COLORS.text,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderRadius: RADIUS.md, fontSize: 15,
  },
  inputBig: { fontSize: 22, fontWeight: '600', paddingVertical: SPACING.lg },
});
