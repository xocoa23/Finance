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
import { useGoals } from '../hooks/useStorage';
import { ProgressBar } from '../components/ProgressBar';
import { FABButton } from '../components/FABButton';
import { DateTimePickerField } from '../components/DateTimePickerField';
import { Icon } from '../components/Icon';
import { MoneyText } from '../components/MoneyText';
import { Goal, RADIUS, SPACING } from '../types';
import { useTheme } from '../hooks/useTheme';
import { formatCurrencyInput, parseCurrencyInput, generateId } from '../utils/formatters';
import {
  contributeToGoal,
  applyGoalsInterest,
  syncMetaCategoryName,
  deleteGoal,
} from '../services/linker';
import { storage } from '../services/storage';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function MetasScreen() {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const { items, add, update } = useGoals();
  const [editing, setEditing] = useState<Goal | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [contribTarget, setContribTarget] = useState<{ goal: Goal; tipo: 'manual' | 'fixo' } | null>(null);

  useEffect(() => {
    applyGoalsInterest().catch(() => {});
  }, []);

  const openActionSheet = (item: Goal) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const handleEdit = () => { setEditing(item); setModalOpen(true); };
    const handleDelete = () => {
      const hasContribs = (item.aportes?.length ?? 0) > 0;
      const cleanup = (cascade: boolean) => deleteGoal(item.id, cascade);
      if (!hasContribs) {
        Alert.alert('Excluir meta', 'Confirma exclusão?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Excluir', style: 'destructive', onPress: () => cleanup(false) },
        ]);
        return;
      }
      Alert.alert(
        'Excluir meta',
        'Existem aportes (lançamentos) registrados. O que fazer com eles?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Manter lançamentos', onPress: () => cleanup(false) },
          { text: 'Excluir tudo', style: 'destructive', onPress: () => cleanup(true) },
        ],
      );
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
          const hasFixo = !!item.valorMensalFixo && item.valorMensalFixo > 0;
          const hasRendimento = !!item.taxaRendimentoAnual && item.taxaRendimentoAnual > 0;
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
                {(hasFixo || hasRendimento) && (
                  <View style={styles.metaRow}>
                    {hasFixo && (
                      <View style={styles.metaBadge}>
                        <Icon name="repeat-outline" size={12} color={colors.primary} />
                        <Text style={styles.metaBadgeText}>
                          R$ {item.valorMensalFixo!.toFixed(2).replace('.', ',')}/mês
                        </Text>
                      </View>
                    )}
                    {hasRendimento && (
                      <View style={styles.metaBadge}>
                        <Icon name="trending-up-outline" size={12} color={colors.warning} />
                        <Text style={[styles.metaBadgeText, { color: colors.warning }]}>
                          {item.taxaRendimentoAnual!.toFixed(2)}% a.a.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
                <View style={{ marginTop: SPACING.md }}>
                  <ProgressBar progress={progress} />
                </View>
                {!concluido && (
                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={styles.addBtn}
                      onPress={() => setContribTarget({ goal: item, tipo: 'manual' })}
                      activeOpacity={0.7}
                    >
                      <Icon name="add" size={16} color={colors.primary} />
                      <Text style={styles.addBtnText}>Adicionar valor</Text>
                    </TouchableOpacity>
                    {hasFixo && (
                      <TouchableOpacity
                        style={[styles.addBtn, styles.addBtnFixo]}
                        onPress={() => setContribTarget({ goal: item, tipo: 'fixo' })}
                        activeOpacity={0.7}
                      >
                        <Icon name="repeat" size={16} color="#0a0a0b" />
                        <Text style={[styles.addBtnText, { color: '#0a0a0b' }]}>
                          + R$ {item.valorMensalFixo!.toFixed(2).replace('.', ',')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {concluido && (
                  <View style={styles.atingidaCard}>
                    <Icon name="trophy" size={16} color={colors.warning} />
                    <Text style={styles.atingidaText}>Meta atingida</Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="flag-outline" size={48} color={colors.textMuted} />
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
          if (editing) {
            await update(g);
            await syncMetaCategoryName(g);
          } else {
            await add(g);
            await syncMetaCategoryName(g);
          }
          setModalOpen(false);
          setEditing(null);
        }}
      />

      <ContributionModal
        target={contribTarget}
        onClose={() => setContribTarget(null)}
      />
    </SafeAreaView>
  );
}

interface ContribModalProps {
  target: { goal: Goal; tipo: 'manual' | 'fixo' } | null;
  onClose: () => void;
}

function ContributionModal({ target, onClose }: ContribModalProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const [valorRaw, setValorRaw] = useState('');
  const [data, setData] = useState(todayISO());

  React.useEffect(() => {
    if (target) {
      setData(todayISO());
      if (target.tipo === 'fixo' && target.goal.valorMensalFixo) {
        setValorRaw(String(Math.round(target.goal.valorMensalFixo * 100)));
      } else {
        setValorRaw('');
      }
    }
  }, [target]);

  const handle = async () => {
    if (!target) return;
    const valor = parseCurrencyInput(valorRaw);
    if (valor <= 0) {
      Alert.alert('Atenção', 'Informe um valor válido.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      Alert.alert('Atenção', 'Use o formato AAAA-MM-DD para a data.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await contributeToGoal({
      goalId: target.goal.id,
      valor,
      data,
      tipo: target.tipo,
    });
    onClose();
  };

  return (
    <Modal visible={!!target} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.dialog}>
              <Text style={styles.dialogTitle}>
                {target?.tipo === 'fixo' ? 'Aporte mensal' : 'Adicionar valor'}
              </Text>
              <Text style={styles.dialogSubtitle}>{target?.goal.nome}</Text>
              <Text style={styles.label}>Valor</Text>
              <TextInput
                value={formatCurrencyInput(valorRaw)}
                onChangeText={setValorRaw}
                keyboardType="numeric"
                style={[styles.input, { fontSize: 22, fontWeight: '600' }]}
                editable={target?.tipo !== 'fixo'}
                autoFocus={target?.tipo !== 'fixo'}
              />
              <Text style={styles.label}>Data</Text>
              <DateTimePickerField value={data} onChange={setData} allowPast={true} />
              <View style={styles.dialogRow}>
                <TouchableOpacity style={styles.dialogBtnGhost} onPress={onClose}>
                  <Text style={styles.modalCancel}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dialogBtnPrimary} onPress={handle}>
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

interface ModalProps {
  visible: boolean;
  editing: Goal | null;
  onClose: () => void;
  onSave: (g: Goal) => Promise<void>;
}

function GoalModal({ visible, editing, onClose, onSave }: ModalProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const [nome, setNome] = useState('');
  const [objRaw, setObjRaw] = useState('');
  const [atualRaw, setAtualRaw] = useState('');
  const [taxa, setTaxa] = useState('');
  const [mensalRaw, setMensalRaw] = useState('');

  React.useEffect(() => {
    if (!visible) return;
    if (editing) {
      setNome(editing.nome);
      setObjRaw(String(Math.round(editing.valorObjetivo * 100)));
      setAtualRaw(String(Math.round(editing.valorAtual * 100)));
      setTaxa(editing.taxaRendimentoAnual ? String(editing.taxaRendimentoAnual) : '');
      setMensalRaw(editing.valorMensalFixo ? String(Math.round(editing.valorMensalFixo * 100)) : '');
    } else {
      setNome('');
      setObjRaw('');
      setAtualRaw('');
      setTaxa('');
      setMensalRaw('');
    }
  }, [visible, editing]);

  const handle = async () => {
    if (!nome.trim()) return Alert.alert('Atenção', 'Informe o nome.');
    const objetivo = parseCurrencyInput(objRaw);
    const atual = parseCurrencyInput(atualRaw);
    const mensal = parseCurrencyInput(mensalRaw);
    const taxaNum = taxa.trim() ? Number(taxa.replace(',', '.')) : undefined;
    if (objetivo <= 0) return Alert.alert('Atenção', 'Informe o valor objetivo.');
    if (taxaNum !== undefined && (isNaN(taxaNum) || taxaNum < 0 || taxaNum > 1000)) {
      return Alert.alert('Atenção', 'Taxa de rendimento inválida (use entre 0 e 1000).');
    }

    await onSave({
      id: editing?.id ?? generateId(),
      nome: nome.trim(),
      valorObjetivo: objetivo,
      valorAtual: atual,
      taxaRendimentoAnual: taxaNum,
      valorMensalFixo: mensal > 0 ? mensal : undefined,
      aportes: editing?.aportes ?? [],
      ultimaCapitalizacao: editing?.ultimaCapitalizacao ?? new Date().toISOString(),
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
        <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Nome</Text>
          <TextInput
            value={nome}
            onChangeText={setNome}
            placeholder="Ex: Viagem, Reserva de emergência"
            placeholderTextColor={colors.textMuted}
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
          <Text style={styles.label}>Aporte mensal fixo (opcional)</Text>
          <TextInput
            value={formatCurrencyInput(mensalRaw)}
            onChangeText={setMensalRaw}
            keyboardType="numeric"
            style={styles.input}
            placeholder="Deixe zero pra desativar"
          />
          <Text style={styles.label}>Taxa de rendimento anual % (opcional)</Text>
          <TextInput
            value={taxa}
            onChangeText={setTaxa}
            keyboardType="numeric"
            placeholder="Ex: 12 (juros compostos mensais)"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <View style={styles.notice}>
            <Icon name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.noticeText}>
              Aportes criam Lançamentos automaticamente na categoria "Meta: {nome || '...'}", descontando do saldo. O aporte mensal fixo aparece na "Projeção do mês" do Dashboard. Rendimento aplica juros compostos automaticamente a cada mês.
            </Text>
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

  list: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  card: {
    backgroundColor: colors.card,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  percent: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  valuesRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: SPACING.xs },
  valorAtual: { color: colors.text, fontSize: 18, fontWeight: '700' },
  valorObj: { color: colors.textSecondary, fontSize: 13 },

  metaRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm, flexWrap: 'wrap' },
  metaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.cardElevated,
    paddingHorizontal: SPACING.sm, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  metaBadgeText: { color: colors.primary, fontSize: 11, fontWeight: '600' },

  btnRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  addBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.cardElevated,
    paddingVertical: SPACING.sm, borderRadius: RADIUS.md,
  },
  addBtnFixo: { backgroundColor: colors.primary },
  addBtnText: { color: colors.primary, fontSize: 13, fontWeight: '600' },

  atingidaCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: SPACING.md,
    backgroundColor: colors.warningSoft,
    paddingVertical: SPACING.sm, borderRadius: RADIUS.md,
  },
  atingidaText: { color: colors.warning, fontSize: 13, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: SPACING.xl },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '600', marginTop: SPACING.md },
  emptyText: { color: colors.textMuted, fontSize: 13, marginTop: SPACING.xs, textAlign: 'center', lineHeight: 19 },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center', justifyContent: 'center', padding: SPACING.xl,
  },
  dialog: { backgroundColor: colors.card, padding: SPACING.lg, borderRadius: RADIUS.lg, width: '100%' },
  dialogTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  dialogSubtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  dialogRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.lg },
  dialogBtnGhost: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  dialogBtnPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md,
  },
  dialogBtnPrimaryText: { color: '#0a0a0b', fontSize: 14, fontWeight: '700' },
  quickBtn: {
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    backgroundColor: colors.cardElevated, borderRadius: RADIUS.full,
  },
  quickText: { color: colors.primary, fontSize: 12, fontWeight: '600' },

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
  input: {
    backgroundColor: colors.cardElevated, color: colors.text,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderRadius: RADIUS.md, fontSize: 15,
  },
  inputBig: { fontSize: 22, fontWeight: '600', paddingVertical: SPACING.lg },
  notice: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    padding: SPACING.md, borderRadius: RADIUS.md,
    marginTop: SPACING.lg, gap: SPACING.sm,
  },
  noticeText: { color: colors.text, fontSize: 12, flex: 1, lineHeight: 17 },
});
