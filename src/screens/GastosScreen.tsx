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
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useFixedExpenses, useExpectedExpenses, useCategories } from '../hooks/useStorage';
import { CategoryDot } from '../components/CategoryDot';
import { CategorySelectorField } from '../components/CategorySelectorField';
import { DateTimePickerField } from '../components/DateTimePickerField';
import { FABButton } from '../components/FABButton';
import { Icon } from '../components/Icon';
import { MoneyText } from '../components/MoneyText';
import { ExpectedExpense, FixedExpense, RADIUS, SPACING } from '../types';
import { useTheme } from '../hooks/useTheme';
import { formatCurrencyInput, parseCurrencyInput, getCurrentMonthKey } from '../utils/formatters';
import {
  payFixedExpense,
  unmarkFixedExpense,
  deleteFixedExpense,
  payExpectedExpense,
  deleteExpectedExpense,
  unmarkExpectedExpense,
} from '../services/linker';
import { storage } from '../services/storage';
import { notifications } from '../services/notifications';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function GastosScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const { items: fixos } = useFixedExpenses();
  const { items: esperados } = useExpectedExpenses();
  const [activeTab, setActiveTab] = useState<'fixos' | 'esperados'>('fixos');

  const [editingFixo, setEditingFixo] = useState<FixedExpense | null>(null);
  const [editingEsperado, setEditingEsperado] = useState<ExpectedExpense | null>(null);
  
  const [modalFixoOpen, setModalFixoOpen] = useState(false);
  const [modalEsperadoOpen, setModalEsperadoOpen] = useState(false);

  const [paymentTargetFixo, setPaymentTargetFixo] = useState<FixedExpense | null>(null);
  const [paymentTargetEsperado, setPaymentTargetEsperado] = useState<ExpectedExpense | null>(null);

  useEffect(() => {
    notifications.rescheduleAll(fixos, [], esperados).catch(() => {});
  }, [fixos, esperados]);

  // --- ACTIONS FIXOS ---
  const openActionSheetFixo = (item: FixedExpense) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const monthKey = getCurrentMonthKey();
    const handleEdit = () => { setEditingFixo(item); setModalFixoOpen(true); };
    const handleDelete = () => {
      Alert.alert(
        'Excluir Gasto Fixo',
        'Os pagamentos já registrados (lançamentos) não serão apagados.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: () => {
              deleteFixedExpense(item.id, false).then(() => notifications.cancelByExpenseId(item.id));
            },
          },
        ],
      );
    };
    const handleRevert = () => {
      Alert.alert('Estornar', 'Remover o pagamento deste mês?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Estornar', style: 'destructive', onPress: () => unmarkFixedExpense(item.id, monthKey) },
      ]);
    };

    const isPaid = item.pagoNoMes[monthKey];
    if (Platform.OS === 'ios') {
      const opts = ['Cancelar', 'Editar', ...(isPaid ? ['Estornar pagamento'] : []), 'Excluir'];
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opts, cancelButtonIndex: 0, destructiveButtonIndex: opts.length - 1, userInterfaceStyle: 'dark' },
        (idx) => {
          if (idx === 1) handleEdit();
          else if (isPaid && idx === 2) handleRevert();
          else if (idx === opts.length - 1) handleDelete();
        },
      );
    } else {
      const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }> = [
        { text: 'Editar', onPress: handleEdit },
        ...(isPaid ? [{ text: 'Estornar', onPress: handleRevert }] : []),
        { text: 'Excluir', style: 'destructive', onPress: handleDelete },
        { text: 'Cancelar', style: 'cancel' },
      ];
      Alert.alert(item.descricao, undefined, buttons);
    }
  };

  // --- ACTIONS ESPERADOS ---
  const openActionSheetEsperado = (item: ExpectedExpense) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const monthKey = getCurrentMonthKey();
    const isPaid = item.pagoNoMes?.[monthKey];

    const handleEdit = () => { setEditingEsperado(item); setModalEsperadoOpen(true); };
    const handleDelete = () => {
      Alert.alert(
        'Excluir Gasto Esperado',
        'Tem certeza?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Excluir',
            style: 'destructive',
            onPress: async () => {
              await deleteExpectedExpense(item.id, false);
              await notifications.cancelByExpectedId(item.id);
            },
          },
        ],
      );
    };
    const handleRevert = () => {
      Alert.alert('Estornar', 'Remover o pagamento deste mês?', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Estornar', style: 'destructive', onPress: () => unmarkExpectedExpense(item.id, monthKey) },
      ]);
    };

    if (Platform.OS === 'ios') {
      const opts = ['Cancelar', 'Editar', ...(isPaid ? ['Estornar pagamento'] : []), 'Excluir'];
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opts, cancelButtonIndex: 0, destructiveButtonIndex: opts.length - 1, userInterfaceStyle: 'dark' },
        (idx) => {
          if (idx === 1) handleEdit();
          else if (isPaid && idx === 2) handleRevert();
          else if (idx === opts.length - 1) handleDelete();
        },
      );
    } else {
      const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' | 'destructive' }> = [
        { text: 'Editar', onPress: handleEdit },
        ...(isPaid ? [{ text: 'Estornar', onPress: handleRevert }] : []),
        { text: 'Excluir', style: 'destructive', onPress: handleDelete },
        { text: 'Cancelar', style: 'cancel' },
      ];
      Alert.alert(item.descricao, undefined, buttons);
    }
  };

  const handleFAB = () => {
    if (activeTab === 'fixos') {
      setEditingFixo(null);
      setModalFixoOpen(true);
    } else {
      setEditingEsperado(null);
      setModalEsperadoOpen(true);
    }
  };

  const renderFixos = () => {
    const monthKey = getCurrentMonthKey();
    const sorted = [...fixos].sort((a, b) => {
      const paidA = a.pagoNoMes[monthKey] ? 1 : 0;
      const paidB = b.pagoNoMes[monthKey] ? 1 : 0;
      if (paidA !== paidB) return paidA - paidB;
      const dA = a.diaVencimento || 99;
      const dB = b.diaVencimento || 99;
      return dA - dB;
    });

    const totalPendentes = sorted.reduce((sum, item) => sum + (item.pagoNoMes[monthKey] ? 0 : item.valor), 0);

    return (
      <View style={{ flex: 1 }}>
        {totalPendentes > 0 && (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total pendente no mês</Text>
            <MoneyText value={totalPendentes} style={styles.totalValue} />
          </View>
        )}
        <FlatList
          data={sorted}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isPaid = item.pagoNoMes[monthKey];
            return (
              <Pressable onLongPress={() => openActionSheetFixo(item)} onPress={() => openActionSheetFixo(item)}>
                <View style={[styles.card, isPaid ? styles.cardPaidThisMonth : styles.cardPendingThisMonth]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.descricao}</Text>
                    {isPaid ? (
                      <View style={styles.paidBadge}>
                        <Icon name="checkmark-circle" size={12} color={colors.primary} />
                        <Text style={styles.paidText}>Pago este mês</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.cardRow}>
                    <MoneyText value={item.valor} style={styles.cardValue} />
                    <Text style={styles.cardMeta}>
                      {item.diaVencimento ? `Todo dia ${item.diaVencimento}` : 'Sem dia fixo'}
                      {item.linkedInstallmentId ? ' · Parcela' : ''}
                    </Text>
                  </View>
                  {!isPaid && (
                    <View style={styles.footer}>
                      <TouchableOpacity
                        onPress={() => setPaymentTargetFixo(item)}
                        style={styles.payBtn}
                        activeOpacity={0.8}
                      >
                        <Icon name="checkmark" size={14} color="#0a0a0b" />
                        <Text style={styles.payBtnText}>Marcar como pago</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="calendar-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Nenhum gasto fixo</Text>
              <Text style={styles.emptyText}>Aluguel, internet, academia...</Text>
            </View>
          }
        />
      </View>
    );
  };

  const renderEsperados = () => {
    const monthKey = getCurrentMonthKey();
    const totalEsperado = esperados.reduce((sum, item) => sum + (item.pagoNoMes?.[monthKey] ? 0 : item.valor), 0);

    return (
      <View style={{ flex: 1 }}>
        {totalEsperado > 0 && (
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total esperado pendente</Text>
            <MoneyText value={totalEsperado} style={styles.totalValue} />
          </View>
        )}
        <FlatList
          data={esperados}
          keyExtractor={(i) => i.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isPaid = item.pagoNoMes?.[monthKey];
            return (
              <Pressable onLongPress={() => openActionSheetEsperado(item)} onPress={() => openActionSheetEsperado(item)}>
                <View style={[styles.card, isPaid ? styles.cardPaidThisMonth : styles.cardPendingThisMonth]}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.descricao}</Text>
                    {isPaid ? (
                      <View style={styles.paidBadge}>
                        <Icon name="checkmark-circle" size={12} color={colors.primary} />
                        <Text style={styles.paidText}>Pago este mês</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={styles.cardRow}>
                    <MoneyText value={item.valor} style={styles.cardValue} />
                    <Text style={styles.cardMeta}>
                      {item.dataVencimento ? `Previsto: ${item.dataVencimento}` : 'Sem data definida'}
                    </Text>
                  </View>
                  {item.observacao ? (
                    <Text style={[styles.cardMeta, { marginTop: 4 }]}>{item.observacao}</Text>
                  ) : null}
                  {!isPaid && (
                    <View style={styles.footer}>
                      <TouchableOpacity
                        onPress={() => setPaymentTargetEsperado(item)}
                        style={styles.payBtn}
                        activeOpacity={0.8}
                      >
                        <Icon name="checkmark" size={14} color="#0a0a0b" />
                        <Text style={styles.payBtnText}>Pagar agora</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="alert-circle-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Nenhum gasto esperado</Text>
              <Text style={styles.emptyText}>Use para compras únicas que você planeja fazer (IPVA, viagem, etc).</Text>
            </View>
          }
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Gastos</Text>
      </View>
      
      <View style={styles.tabsContainer}>
        <View style={styles.tabsRow}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'fixos' && styles.tabActive]} 
            onPress={() => setActiveTab('fixos')}
          >
            <Text style={[styles.tabText, activeTab === 'fixos' && styles.tabTextActive]}>Fixos</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'esperados' && styles.tabActive]} 
            onPress={() => setActiveTab('esperados')}
          >
            <Text style={[styles.tabText, activeTab === 'esperados' && styles.tabTextActive]}>Esperados</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'fixos' ? renderFixos() : renderEsperados()}

      <FABButton onPress={handleFAB} />

      <FixoModal
        visible={modalFixoOpen}
        editing={editingFixo}
        onClose={() => { setModalFixoOpen(false); setEditingFixo(null); }}
      />
      <EsperadoModal
        visible={modalEsperadoOpen}
        editing={editingEsperado}
        onClose={() => { setModalEsperadoOpen(false); setEditingEsperado(null); }}
      />

      <PaymentFixoModal target={paymentTargetFixo} onClose={() => setPaymentTargetFixo(null)} />
      <PaymentEsperadoModal target={paymentTargetEsperado} onClose={() => setPaymentTargetEsperado(null)} />
    </SafeAreaView>
  );
}

// --- PAYMENT MODALS ---
function PaymentFixoModal({ target, onClose }: { target: FixedExpense | null; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getDialogStyles(colors), [colors]);

  const [data, setData] = useState(todayISO());

  React.useEffect(() => {
    if (target) setData(todayISO());
  }, [target]);

  const handleConfirm = async () => {
    if (!target) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      Alert.alert('Atenção', 'Use o formato AAAA-MM-DD.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await payFixedExpense({ fixedExpenseId: target.id, data, monthKey: getCurrentMonthKey() });
    onClose();
  };

  return (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.dialog}>
              <Text style={styles.dialogTitle}>Pagar Gasto Fixo</Text>
              <Text style={styles.dialogSubtitle}>{target?.descricao}</Text>
              <Text style={styles.label}>Data do pagamento (irá registrar lançamento)</Text>
              <DateTimePickerField value={data} onChange={setData} allowPast={true} />
              <View style={styles.dialogRow}>
                <TouchableOpacity style={styles.dialogBtnGhost} onPress={onClose}>
                  <Text style={styles.modalCancel}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dialogBtnPrimary} onPress={handleConfirm}>
                  <Text style={styles.dialogBtnPrimaryText}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function PaymentEsperadoModal({ target, onClose }: { target: ExpectedExpense | null; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getDialogStyles(colors), [colors]);

  const [data, setData] = useState(todayISO());
  const [valorRaw, setValorRaw] = useState('');

  React.useEffect(() => {
    if (target) {
      setData(todayISO());
      setValorRaw(String(Math.round(target.valor * 100)));
    }
  }, [target]);

  const handleConfirm = async () => {
    if (!target) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      Alert.alert('Atenção', 'Use o formato AAAA-MM-DD.');
      return;
    }
    const val = parseCurrencyInput(valorRaw);
    if (val <= 0) return Alert.alert('Atenção', 'Valor inválido.');

    Alert.alert(
      'Manter Gasto Esperado?',
      'Após pagar, deseja excluir este gasto ou mantê-lo para o próximo mês?',
      [
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await payExpectedExpense({ expectedExpenseId: target.id, data, valor: val, observacao: target.observacao, keepAfterPayment: false });
            onClose();
          }
        },
        {
          text: 'Manter (Não excluir)',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            await payExpectedExpense({ expectedExpenseId: target.id, data, valor: val, observacao: target.observacao, keepAfterPayment: true, monthKey: getCurrentMonthKey() });
            onClose();
          }
        },
        { text: 'Cancelar', style: 'cancel' }
      ]
    );
  };

  return (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.dialog}>
              <Text style={styles.dialogTitle}>Pagar Gasto Esperado</Text>
              <Text style={styles.dialogSubtitle}>
                {target?.descricao}
              </Text>
              <Text style={styles.label}>Valor pago</Text>
              <TextInput
                value={formatCurrencyInput(valorRaw)} onChangeText={setValorRaw} keyboardType="numeric"
                style={[styles.input, { fontSize: 20, fontWeight: '700' }]}
              />
              <Text style={styles.label}>Data</Text>
              <DateTimePickerField value={data} onChange={setData} allowPast={true} />
              <View style={styles.dialogRow}>
                <TouchableOpacity style={styles.dialogBtnGhost} onPress={onClose}>
                  <Text style={styles.modalCancel}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dialogBtnPrimary} onPress={handleConfirm}>
                  <Text style={styles.dialogBtnPrimaryText}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// --- CREATE MODALS ---
function FixoModal({ visible, editing, onClose }: { visible: boolean; editing: FixedExpense | null; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const { items: categories } = useCategories();
  const [descricao, setDescricao] = useState('');
  const [valorRaw, setValorRaw] = useState('');
  const [dia, setDia] = useState('');
  const [categoriaId, setCategoriaId] = useState('');

  React.useEffect(() => {
    if (!visible) return;
    if (editing) {
      setDescricao(editing.descricao);
      setValorRaw(String(Math.round(editing.valor * 100)));
      setDia(editing.diaVencimento ? String(editing.diaVencimento) : '');
      setCategoriaId(editing.categoriaId);
    } else {
      setDescricao(''); setValorRaw(''); setDia(''); setCategoriaId('');
    }
  }, [visible, editing]);

  const handle = async () => {
    if (!descricao.trim()) return Alert.alert('Atenção', 'Informe a descrição.');
    const val = parseCurrencyInput(valorRaw);
    if (val <= 0) return Alert.alert('Atenção', 'Valor inválido.');
    if (!categoriaId) return Alert.alert('Atenção', 'Selecione a categoria.');
    const d = parseInt(dia, 10);
    if (dia && (isNaN(d) || d < 1 || d > 31)) return Alert.alert('Atenção', 'Dia de vencimento inválido.');

    const all = await storage.getFixedExpenses();
    if (editing) {
      const idx = all.findIndex((x) => x.id === editing.id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], descricao: descricao.trim(), valor: val, categoriaId, diaVencimento: dia ? d : undefined };
        await storage.setFixedExpenses(all);
      }
    } else {
      all.push({
        id: `fixo-${Date.now()}`,
        descricao: descricao.trim(),
        valor: val,
        categoriaId,
        diaVencimento: dia ? d : undefined,
        pagoNoMes: {},
        criadoEm: new Date().toISOString(),
      });
      await storage.setFixedExpenses(all);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalCancel}>Cancelar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>{editing ? 'Editar Gasto Fixo' : 'Novo Gasto Fixo'}</Text>
          <TouchableOpacity onPress={handle}><Text style={styles.modalSave}>Salvar</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Descrição</Text>
          <TextInput value={descricao} onChangeText={setDescricao} style={styles.input} />
          <Text style={styles.label}>Valor Mês</Text>
          <TextInput value={formatCurrencyInput(valorRaw)} onChangeText={setValorRaw} keyboardType="numeric" style={[styles.input, styles.inputBig]} />
          <Text style={styles.label}>Dia de Vencimento (1-31, opcional)</Text>
          <TextInput value={dia} onChangeText={setDia} keyboardType="numeric" style={styles.input} />
          <Text style={styles.label}>Categoria</Text>
          <CategorySelectorField categoriaId={categoriaId} onChange={setCategoriaId} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function EsperadoModal({ visible, editing, onClose }: { visible: boolean; editing: ExpectedExpense | null; onClose: () => void }) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const { items: categories } = useCategories();
  const [descricao, setDescricao] = useState('');
  const [valorRaw, setValorRaw] = useState('');
  const [dataVenc, setDataVenc] = useState('');
  const [observacao, setObservacao] = useState('');
  const [categoriaId, setCategoriaId] = useState('');

  React.useEffect(() => {
    if (!visible) return;
    if (editing) {
      setDescricao(editing.descricao);
      setValorRaw(String(Math.round(editing.valor * 100)));
      setDataVenc(editing.dataVencimento || '');
      setObservacao(editing.observacao || '');
      setCategoriaId(editing.categoriaId);
    } else {
      setDescricao(''); setValorRaw(''); setDataVenc(''); setObservacao(''); setCategoriaId('');
    }
  }, [visible, editing]);

  const handle = async () => {
    if (!descricao.trim()) return Alert.alert('Atenção', 'Informe a descrição.');
    const val = parseCurrencyInput(valorRaw);
    if (val <= 0) return Alert.alert('Atenção', 'Valor inválido.');
    if (!categoriaId) return Alert.alert('Atenção', 'Selecione a categoria.');
    if (dataVenc && !/^\d{4}-\d{2}-\d{2}$/.test(dataVenc)) return Alert.alert('Atenção', 'A data deve ser AAAA-MM-DD');

    const all = await storage.getExpectedExpenses();
    if (editing) {
      const idx = all.findIndex((x) => x.id === editing.id);
      if (idx !== -1) {
        all[idx] = { ...all[idx], descricao: descricao.trim(), valor: val, categoriaId, dataVencimento: dataVenc || undefined, observacao: observacao.trim() || undefined };
        await storage.setExpectedExpenses(all);
      }
    } else {
      all.push({
        id: `esperado-${Date.now()}`,
        descricao: descricao.trim(),
        valor: val,
        categoriaId,
        dataVencimento: dataVenc || undefined,
        observacao: observacao.trim() || undefined,
        criadoEm: new Date().toISOString(),
      });
      await storage.setExpectedExpenses(all);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.modalCancel}>Cancelar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>{editing ? 'Editar Gasto Esperado' : 'Novo Gasto Esperado'}</Text>
          <TouchableOpacity onPress={handle}><Text style={styles.modalSave}>Salvar</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Descrição</Text>
          <TextInput value={descricao} onChangeText={setDescricao} style={styles.input} />
          <Text style={styles.label}>Valor Previsto</Text>
          <TextInput value={formatCurrencyInput(valorRaw)} onChangeText={setValorRaw} keyboardType="numeric" style={[styles.input, styles.inputBig]} />
          <Text style={styles.label}>Data Prevista (opcional)</Text>
          <DateTimePickerField value={dataVenc} onChange={setDataVenc} allowPast={true} allowEmpty={true} />
          <Text style={styles.label}>Observação</Text>
          <TextInput value={observacao} onChangeText={setObservacao} style={styles.input} />
          <Text style={styles.label}>Categoria</Text>
          <CategorySelectorField categoriaId={categoriaId} onChange={setCategoriaId} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const getDialogStyles = (colors: any) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: SPACING.xl },
  dialog: { backgroundColor: colors.card, padding: SPACING.lg, borderRadius: RADIUS.lg, width: '100%' },
  dialogTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  dialogSubtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  label: { color: colors.textSecondary, fontSize: 12, marginTop: SPACING.lg, marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600' },
  input: { backgroundColor: colors.cardElevated, color: colors.text, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderRadius: RADIUS.md, fontSize: 15 },
  dialogRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.lg },
  dialogBtnGhost: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  modalCancel: { color: colors.textSecondary, fontSize: 15 },
  dialogBtnPrimary: { backgroundColor: colors.primary, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md },
  dialogBtnPrimaryText: { color: '#0a0a0b', fontSize: 14, fontWeight: '700' },
});

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: SPACING.lg, paddingBottom: SPACING.sm },
  title: { color: colors.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  
  tabsContainer: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },
  tabsRow: { flexDirection: 'row', backgroundColor: colors.cardElevated, borderRadius: RADIUS.md, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: RADIUS.sm },
  tabActive: { backgroundColor: colors.card, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: colors.text },

  totalCard: { backgroundColor: colors.card, marginHorizontal: SPACING.lg, marginBottom: SPACING.md, padding: SPACING.lg, borderRadius: RADIUS.md },
  totalLabel: { color: colors.textMuted, fontSize: 12 },
  totalValue: { color: colors.danger, fontSize: 24, fontWeight: '700', marginTop: 4 },

  list: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  card: { backgroundColor: colors.card, padding: SPACING.md, borderRadius: RADIUS.md, marginBottom: SPACING.sm, borderWidth: 1, borderColor: 'transparent' },
  cardPaidThisMonth: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  cardPendingThisMonth: { borderColor: colors.danger },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: SPACING.sm },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  cardValue: { color: colors.text, fontSize: 14, fontWeight: '600' },
  cardMeta: { color: colors.textSecondary, fontSize: 12 },
  paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primarySoft, paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full },
  paidText: { color: colors.primary, fontSize: 11, fontWeight: '600' },
  footer: { marginTop: SPACING.md, alignItems: 'flex-end' },
  payBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.full },
  payBtnText: { color: '#0a0a0b', fontSize: 13, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: SPACING.xl },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: SPACING.md },
  emptyText: { color: colors.textMuted, fontSize: 13, marginTop: SPACING.xs, textAlign: 'center', lineHeight: 19 },

  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  modalCancel: { color: colors.textSecondary, fontSize: 15 },
  modalSave: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  modalBody: { padding: SPACING.lg, paddingBottom: 60 },
  label: { color: colors.textSecondary, fontSize: 12, marginTop: SPACING.lg, marginBottom: SPACING.sm, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600' },
  input: { backgroundColor: colors.card, color: colors.text, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, borderRadius: RADIUS.md, fontSize: 15 },
  inputBig: { fontSize: 24, fontWeight: '700', paddingVertical: SPACING.lg },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'transparent' },
  catChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  catChipText: { color: colors.text, fontSize: 13, fontWeight: '500' },
});
