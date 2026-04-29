import React, { useEffect, useMemo, useState } from 'react';
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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useInstallments, useCategories } from '../hooks/useStorage';
import { ProgressBar } from '../components/ProgressBar';
import { FABButton } from '../components/FABButton';
import { Icon } from '../components/Icon';
import { MoneyText } from '../components/MoneyText';
import { CategoryDot } from '../components/CategoryDot';
import { Installment, RADIUS, SPACING } from '../types';
import { useTheme } from '../hooks/useTheme';
import { formatCurrencyInput, parseCurrencyInput, getCurrentMonthKey } from '../utils/formatters';
import {
  payInstallment,
  revertInstallmentPayment,
  deleteInstallment,
  createInstallmentWithLinkedFixed,
  recalculateInstallmentValor,
} from '../services/linker';
import { storage } from '../services/storage';
import { notifications } from '../services/notifications';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ParcelasScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const { items } = useInstallments();
  const [editing, setEditing] = useState<Installment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<{ item: Installment; index: number } | null>(null);

  useEffect(() => {
    notifications.rescheduleAll([], items).catch(() => {});
  }, [items]);

  const askForPaymentDate = (item: Installment) => {
    if (item.parcelasPagas >= item.numeroParcelas) return;
    const nextIndex = item.parcelasPagas + 1;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    const monthKeyAlreadyPaid = (item.pagamentos ?? []).some((p) => p.data.slice(0, 7) === getCurrentMonthKey());
    const proceed = () => setPaymentTarget({ item, index: nextIndex });

    if (monthKeyAlreadyPaid) {
      Alert.alert(
        'Pagamento adiantado?',
        'Já existe uma parcela paga este mês. Continuar registrará outra parcela (uso comum: adiantar pagamento).',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Continuar', onPress: proceed },
        ],
      );
    } else {
      proceed();
    }
  };

  const openActionSheet = (item: Installment) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const handleEdit = () => { setEditing(item); setModalOpen(true); };
    const handleDelete = () => {
      const hasPayments = (item.pagamentos?.length ?? 0) > 0;
      const cleanup = (cascade: boolean) =>
        deleteInstallment(item.id, cascade).then(() => notifications.cancelByInstallmentId(item.id));
      if (!hasPayments) {
        Alert.alert('Excluir parcelamento', 'Confirma exclusão? Não pode ser desfeito.', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir', style: 'destructive', onPress: () => cleanup(false) },
        ]);
        return;
      }
      Alert.alert(
        'Excluir parcelamento',
        'Existem lançamentos vinculados a este parcelamento. O que fazer com eles?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Manter lançamentos', onPress: () => cleanup(false) },
          { text: 'Excluir tudo', style: 'destructive', onPress: () => cleanup(true) },
        ],
      );
    };
    const handleRevertLast = () => {
      const last = (item.pagamentos ?? []).slice().sort((a, b) => b.index - a.index)[0];
      if (!last) return;
      Alert.alert(
        'Estornar último pagamento',
        `Vai remover o pagamento da parcela ${last.index} e o lançamento associado.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Estornar',
            style: 'destructive',
            onPress: () => revertInstallmentPayment(item.id, last.index),
          },
        ],
      );
    };

    const hasPayments = (item.pagamentos?.length ?? 0) > 0;
    if (Platform.OS === 'ios') {
      const opts = ['Cancelar', 'Editar', ...(hasPayments ? ['Estornar último pagamento'] : []), 'Excluir'];
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opts, cancelButtonIndex: 0, destructiveButtonIndex: opts.length - 1, userInterfaceStyle: 'dark' },
        (idx) => {
          if (idx === 1) handleEdit();
          else if (hasPayments && idx === 2) handleRevertLast();
          else if (idx === opts.length - 1) handleDelete();
        },
      );
    } else {
      const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }> = [
        { text: 'Editar', onPress: handleEdit },
        ...(hasPayments ? [{ text: 'Estornar último', onPress: handleRevertLast }] : []),
        { text: 'Excluir', style: 'destructive', onPress: handleDelete },
        { text: 'Cancelar', style: 'cancel' },
      ];
      Alert.alert(item.descricao, undefined, buttons);
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
          const pagaEsteMes = (item.pagamentos ?? []).some(
            (p) => p.data.slice(0, 7) === getCurrentMonthKey(),
          );
          return (
            <Pressable onLongPress={() => openActionSheet(item)} onPress={() => openActionSheet(item)}>
              <View style={[styles.card, pagaEsteMes ? styles.cardPaidThisMonth : (!concluido && styles.cardPendingThisMonth)]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{item.descricao}</Text>
                  {concluido ? (
                    <View style={styles.doneBadge}>
                      <Icon name="checkmark" size={12} color={colors.primary} />
                      <Text style={styles.doneText}>Quitado</Text>
                    </View>
                  ) : pagaEsteMes ? (
                    <View style={styles.paidBadge}>
                      <Icon name="checkmark-circle" size={12} color={colors.primary} />
                      <Text style={styles.paidText}>Pago este mês</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.cardRow}>
                  <MoneyText value={item.valorParcela} style={styles.cardSubValue} />
                  <Text style={styles.cardMeta}>
                    {item.parcelasPagas} de {item.numeroParcelas}
                    {item.diaVencimento ? ` · vence dia ${item.diaVencimento}` : ' · sem prazo'}
                  </Text>
                </View>
                <View style={{ marginTop: SPACING.md }}>
                  <ProgressBar progress={progress} />
                </View>
                <DotGrid total={item.numeroParcelas} pagas={item.parcelasPagas} />
                <View style={styles.footer}>
                  <View>
                    <Text style={styles.cardMeta}>Restante</Text>
                    <MoneyText value={restante} style={styles.restanteValor} />
                  </View>
                  {!concluido && (
                    <TouchableOpacity
                      onPress={() => askForPaymentDate(item)}
                      style={styles.payBtn}
                      activeOpacity={0.8}
                    >
                      <Icon name="checkmark" size={14} color="#0a0a0b" />
                      <Text style={styles.payBtnText}>Pagamento de Parcela</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="card-outline" size={48} color={colors.textMuted} />
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
      />

      <PaymentDateModal
        target={paymentTarget}
        onClose={() => setPaymentTarget(null)}
      />
    </SafeAreaView>
  );
}

function DotGrid({ total, pagas }: { total: number; pagas: number }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  if (total <= 0) return null;
  const dots: React.ReactNode[] = [];
  for (let i = 0; i < total; i++) {
    const paid = i < pagas;
    dots.push(
      <View
        key={i}
        style={[styles.dot, paid ? styles.dotPaid : styles.dotPending]}
      />,
    );
  }
  return <View style={styles.dotsRow}>{dots}</View>;
}

interface PaymentModalProps {
  target: { item: Installment; index: number } | null;
  onClose: () => void;
}

function PaymentDateModal({ target, onClose }: PaymentModalProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const [data, setData] = useState(todayISO());
  const [observacao, setObservacao] = useState('');

  React.useEffect(() => {
    if (target) {
      setData(todayISO());
      setObservacao('');
    }
  }, [target]);

  const handleConfirm = async () => {
    if (!target) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      Alert.alert('Atenção', 'Use o formato AAAA-MM-DD para a data.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await payInstallment({
      installmentId: target.item.id,
      index: target.index,
      data,
      observacao: observacao.trim() || undefined,
    });
    onClose();
  };

  return (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>Pagamento de Parcela</Text>
          <Text style={styles.dialogSubtitle}>
            {target?.item.descricao} · parcela {target?.index}/{target?.item.numeroParcelas}
          </Text>
          <Text style={styles.label}>Data do pagamento</Text>
          <TextInput
            value={data}
            onChangeText={setData}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoCapitalize="none"
          />
          <View style={styles.dialogQuickRow}>
            <TouchableOpacity onPress={() => setData(todayISO())} style={styles.dialogQuickBtn}>
              <Text style={styles.dialogQuickText}>Hoje</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.label}>Observação (opcional)</Text>
          <TextInput
            value={observacao}
            onChangeText={setObservacao}
            placeholder="Ex: pago via PIX"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <View style={styles.dialogRow}>
            <TouchableOpacity style={styles.dialogBtnGhost} onPress={onClose}>
              <Text style={styles.modalCancel}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dialogBtnPrimary} onPress={handleConfirm}>
              <Text style={styles.dialogBtnPrimaryText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface ModalProps {
  visible: boolean;
  editing: Installment | null;
  onClose: () => void;
}

function InstallmentModal({ visible, editing, onClose }: ModalProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const { items: categories } = useCategories();
  const [descricao, setDescricao] = useState('');
  const [valorRaw, setValorRaw] = useState('');
  const [numero, setNumero] = useState('12');
  const [pagas, setPagas] = useState('0');
  const [semPrazo, setSemPrazo] = useState(false);
  const [diaVenc, setDiaVenc] = useState('5');
  const [categoriaId, setCategoriaId] = useState<string>('');

  React.useEffect(() => {
    if (!visible) return;
    if (editing) {
      setDescricao(editing.descricao);
      setValorRaw(String(Math.round(editing.valorTotal * 100)));
      setNumero(String(editing.numeroParcelas));
      setPagas(String(editing.parcelasPagas));
      setSemPrazo(!editing.diaVencimento);
      setDiaVenc(editing.diaVencimento ? String(editing.diaVencimento) : '5');
      setCategoriaId(editing.categoriaId ?? '');
    } else {
      setDescricao('');
      setValorRaw('');
      setNumero('12');
      setPagas('0');
      setSemPrazo(false);
      setDiaVenc('5');
      setCategoriaId('');
    }
  }, [visible, editing]);

  const handle = async () => {
    if (!descricao.trim()) return Alert.alert('Atenção', 'Informe a descrição.');
    const valor = parseCurrencyInput(valorRaw);
    if (valor <= 0) return Alert.alert('Atenção', 'Informe o valor total.');
    const n = parseInt(numero, 10);
    const p = parseInt(pagas, 10);
    const dv = semPrazo ? undefined : parseInt(diaVenc, 10);
    if (!n || n < 1) return Alert.alert('Atenção', 'Número de parcelas inválido.');
    if (isNaN(p) || p < 0 || p > n) return Alert.alert('Atenção', 'Parcelas pagas inválidas.');
    if (!semPrazo && (!dv || dv < 1 || dv > 31)) return Alert.alert('Atenção', 'Dia de vencimento inválido (1-31).');

    if (editing) {
      const valorMudou = Math.abs(editing.valorTotal - valor) > 0.01 || editing.numeroParcelas !== n;
      const aplicar = async (recalcular: boolean) => {
        if (recalcular) {
          await recalculateInstallmentValor(editing.id, valor, n);
        }
        const installments = await storage.getInstallments();
        const updated = installments.map((i) =>
          i.id === editing.id
            ? {
                ...i,
                descricao: descricao.trim(),
                diaVencimento: dv,
                categoriaId: categoriaId || undefined,
                ...(recalcular ? {} : { valorTotal: valor, numeroParcelas: n, valorParcela: valor / n, parcelasPagas: Math.min(i.parcelasPagas, n) }),
              }
            : i,
        );
        await storage.setInstallments(updated);
        if (editing.linkedFixedExpenseId && dv) {
          const fixed = await storage.getFixedExpenses();
          await storage.setFixedExpenses(
            fixed.map((f) =>
              f.id === editing.linkedFixedExpenseId
                ? { ...f, descricao: descricao.trim(), valor: valor / n, diaVencimento: dv, categoriaId: categoriaId || f.categoriaId }
                : f,
            ),
          );
        }
        onClose();
      };

      if (valorMudou && (editing.pagamentos?.length ?? 0) > 0) {
        Alert.alert(
          'Recalcular valor da parcela?',
          'Existem pagamentos já registrados. Recalcular o valor por parcela atualiza apenas os FUTUROS pagamentos. Os lançamentos antigos não mudam.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Apenas atualizar campos', onPress: () => aplicar(false) },
            { text: 'Recalcular', onPress: () => aplicar(true) },
          ],
        );
        return;
      }
      await aplicar(true);
      return;
    }

    await createInstallmentWithLinkedFixed({
      descricao: descricao.trim(),
      valorTotal: valor,
      numeroParcelas: n,
      categoriaId: categoriaId || undefined,
      diaVencimento: dv,
      parcelasPagas: p,
    });
    onClose();
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
            placeholderTextColor={colors.textMuted}
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
          <TextInput value={numero} onChangeText={setNumero} keyboardType="numeric" style={styles.input} />
          
          <Text style={styles.label}>Parcelas já pagas (não cria lançamentos)</Text>
          <TextInput value={pagas} onChangeText={setPagas} keyboardType="numeric" style={styles.input} editable={!editing} />
          
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Sem prazo (não criar lembretes)</Text>
            <Switch
              value={semPrazo}
              onValueChange={setSemPrazo}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
          
          {!semPrazo && (
            <>
              <Text style={styles.label}>Dia de vencimento (1-31)</Text>
              <TextInput value={diaVenc} onChangeText={setDiaVenc} keyboardType="numeric" style={styles.input} />
            </>
          )}

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
            {semPrazo ? (
              <>
                <Icon name="warning-outline" size={16} color={colors.warning} />
                <Text style={styles.noticeText}>
                  Sem data definida, você não receberá notificações nem terá um Gasto Fixo gerado automaticamente.
                </Text>
              </>
            ) : (
              <>
                <Icon name="link-outline" size={16} color={colors.primary} />
                <Text style={styles.noticeText}>
                  Cada parcelamento cria automaticamente um Gasto Fixo linkado, com lembrete 3 dias antes do vencimento.
                </Text>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: SPACING.lg, paddingBottom: SPACING.md },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },

  totalCard: {
    backgroundColor: colors.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
  },
  totalLabel: { color: colors.textMuted, fontSize: 12 },
  totalValue: { color: colors.danger, fontSize: 24, fontWeight: '700', marginTop: 4 },

  list: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  card: {
    backgroundColor: colors.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cardPaidThisMonth: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  cardPendingThisMonth: {
    borderColor: colors.danger,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    gap: SPACING.sm,
  },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  cardSubValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  cardMeta: { color: colors.textSecondary, fontSize: 12 },
  doneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full,
  },
  doneText: { color: colors.primary, fontSize: 11, fontWeight: '600' },
  paidBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full,
  },
  paidText: { color: colors.primary, fontSize: 11, fontWeight: '600' },
  dotsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    marginTop: SPACING.md,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotPaid: { backgroundColor: colors.primary },
  dotPending: { backgroundColor: colors.border },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: SPACING.md },
  restanteValor: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 2 },
  payBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.full,
  },
  payBtnText: { color: '#0a0a0b', fontSize: 13, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: SPACING.xl },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: SPACING.md },
  emptyText: { color: colors.textMuted, fontSize: 13, marginTop: SPACING.xs, textAlign: 'center', lineHeight: 19 },

  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  modalCancel: { color: colors.textSecondary, fontSize: 15 },
  modalSave: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  modalBody: { padding: SPACING.lg, paddingBottom: 60 },
  label: {
    color: colors.textSecondary, fontSize: 12,
    marginTop: SPACING.lg, marginBottom: SPACING.sm,
    textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  switchLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.card, color: colors.text,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderRadius: RADIUS.md, fontSize: 15,
  },
  inputBig: { fontSize: 22, fontWeight: '600', paddingVertical: SPACING.lg },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: 'transparent',
  },
  catChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  catChipText: { color: colors.text, fontSize: 13, fontWeight: '500' },
  notice: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.primarySoft,
    padding: SPACING.md, borderRadius: RADIUS.md,
    marginTop: SPACING.lg, gap: SPACING.sm,
  },
  noticeText: { color: colors.text, fontSize: 12, flex: 1, lineHeight: 17 },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', padding: SPACING.xl,
  },
  dialog: { backgroundColor: colors.card, padding: SPACING.lg, borderRadius: RADIUS.lg, width: '100%' },
  dialogTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  dialogSubtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  dialogQuickRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  dialogQuickBtn: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    backgroundColor: colors.cardElevated, borderRadius: RADIUS.full,
  },
  dialogQuickText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  dialogRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.lg },
  dialogBtnGhost: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  dialogBtnPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
  },
  dialogBtnPrimaryText: { color: '#0a0a0b', fontSize: 14, fontWeight: '700' },
});
