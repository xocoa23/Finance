import React, { useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  FlatList,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useTransactions, useCategories } from '../hooks/useStorage';
import { TransactionCard } from '../components/TransactionCard';
import { CategoryDot } from '../components/CategoryDot';
import { FABButton } from '../components/FABButton';
import { Icon } from '../components/Icon';
import { COLORS, RADIUS, SPACING, Transaction, TransactionType } from '../types';
import {
  formatCurrencyInput,
  parseCurrencyInput,
  generateId,
} from '../utils/formatters';

const FILTER_TYPES: Array<{ key: 'all' | TransactionType; label: string }> = [
  { key: 'all', label: 'Todos' },
  { key: 'receita', label: 'Receitas' },
  { key: 'despesa', label: 'Despesas' },
];

export function LancamentosScreen() {
  const { items, add, update, remove } = useTransactions();
  const { items: categories } = useCategories();

  const [filterType, setFilterType] = useState<'all' | TransactionType>('all');
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    return items.filter((t) => {
      if (filterType !== 'all' && t.tipo !== filterType) return false;
      if (filterCat && t.categoriaId !== filterCat) return false;
      return true;
    });
  }, [items, filterType, filterCat]);

  const findCategory = (id: string) => categories.find((c) => c.id === id);

  const openActionSheet = (transaction: Transaction) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const handleEdit = () => {
      setEditing(transaction);
      setModalOpen(true);
    };
    const handleDelete = () => {
      Alert.alert('Excluir lançamento', 'Esta ação não pode ser desfeita.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => remove(transaction.id) },
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
      Alert.alert(transaction.descricao, undefined, [
        { text: 'Editar', onPress: handleEdit },
        { text: 'Excluir', style: 'destructive', onPress: handleDelete },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  };

  const openNew = () => {
    setEditing(null);
    setModalOpen(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Lançamentos</Text>
        <Text style={styles.subtitle}>{filtered.length} {filtered.length === 1 ? 'item' : 'itens'}</Text>
      </View>

      <View style={styles.filtersWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTER_TYPES.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, filterType === f.key && styles.chipActive]}
              onPress={() => setFilterType(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, filterType === f.key && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={styles.divider} />
          {filterCat && (
            <TouchableOpacity style={styles.chip} onPress={() => setFilterCat(null)}>
              <Icon name="close" size={14} color={COLORS.textSecondary} />
              <Text style={[styles.chipText, { marginLeft: 4 }]}>Limpar</Text>
            </TouchableOpacity>
          )}
          {categories.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, filterCat === c.id && styles.chipActive]}
              onPress={() => setFilterCat(filterCat === c.id ? null : c.id)}
              activeOpacity={0.7}
            >
              <CategoryDot color={c.cor} size={8} />
              <Text style={[styles.chipText, filterCat === c.id && styles.chipTextActive, { marginLeft: 6 }]}>
                {c.nome}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable onLongPress={() => openActionSheet(item)} onPress={() => openActionSheet(item)}>
            <TransactionCard transaction={item} category={findCategory(item.categoriaId)} />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="document-text-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyTitle}>Nenhum lançamento</Text>
            <Text style={styles.emptyText}>Toque em + para adicionar uma receita ou despesa.</Text>
          </View>
        }
      />

      <FABButton onPress={openNew} />

      <TransactionModal
        visible={modalOpen}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={async (t) => {
          if (editing) await update(t);
          else await add(t);
          setModalOpen(false);
          setEditing(null);
        }}
      />
    </SafeAreaView>
  );
}

interface ModalProps {
  visible: boolean;
  editing: Transaction | null;
  onClose: () => void;
  onSave: (t: Transaction) => Promise<void>;
}

function TransactionModal({ visible, editing, onClose, onSave }: ModalProps) {
  const { items: categories } = useCategories();
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState<TransactionType>('despesa');
  const [valorRaw, setValorRaw] = useState('');
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [categoriaId, setCategoriaId] = useState(categories[0]?.id ?? '');
  const [observacao, setObservacao] = useState('');
  const [comprovanteUri, setComprovanteUri] = useState<string | undefined>(undefined);

  React.useEffect(() => {
    if (!visible) return;
    if (editing) {
      setDescricao(editing.descricao);
      setTipo(editing.tipo);
      setValorRaw(String(Math.round(editing.valor * 100)));
      setData(editing.data);
      setCategoriaId(editing.categoriaId);
      setObservacao(editing.observacao ?? '');
      setComprovanteUri(editing.comprovanteUri);
    } else {
      setDescricao('');
      setTipo('despesa');
      setValorRaw('');
      setData(new Date().toISOString().slice(0, 10));
      setCategoriaId(categories[0]?.id ?? '');
      setObservacao('');
      setComprovanteUri(undefined);
    }
  }, [visible, editing, categories]);

  const saveLocalFile = async (sourceUri: string, ext: string): Promise<string> => {
    const dir = `${FileSystem.documentDirectory}comprovantes/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
    const dest = `${dir}${generateId()}.${ext}`;
    await FileSystem.copyAsync({ from: sourceUri, to: dest });
    return dest;
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão negada', 'Habilite a câmera nas configurações.');
      return;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!r.canceled && r.assets[0]) {
      const uri = await saveLocalFile(r.assets[0].uri, 'jpg');
      setComprovanteUri(uri);
    }
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permissão negada');
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (!r.canceled && r.assets[0]) {
      const uri = await saveLocalFile(r.assets[0].uri, 'jpg');
      setComprovanteUri(uri);
    }
  };

  const pickPdf = async () => {
    const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (!r.canceled && r.assets?.[0]) {
      const uri = await saveLocalFile(r.assets[0].uri, 'pdf');
      setComprovanteUri(uri);
    }
  };

  const handleSave = async () => {
    if (!descricao.trim()) return Alert.alert('Atenção', 'Informe a descrição.');
    const valor = parseCurrencyInput(valorRaw);
    if (valor <= 0) return Alert.alert('Atenção', 'Informe um valor.');
    if (!categoriaId) return Alert.alert('Atenção', 'Selecione uma categoria.');

    await onSave({
      id: editing?.id ?? generateId(),
      descricao: descricao.trim(),
      tipo,
      valor,
      data,
      categoriaId,
      observacao: observacao.trim() || undefined,
      comprovanteUri,
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
          <Text style={styles.modalTitle}>{editing ? 'Editar' : 'Novo lançamento'}</Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={styles.modalSave}>Salvar</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.modalBody}>
          <View style={styles.segment}>
            <TouchableOpacity
              style={[styles.segmentBtn, tipo === 'despesa' && styles.segmentBtnDanger]}
              onPress={() => setTipo('despesa')}
              activeOpacity={0.7}
            >
              <Icon
                name="arrow-down-circle"
                size={16}
                color={tipo === 'despesa' ? COLORS.danger : COLORS.textSecondary}
              />
              <Text style={[styles.segmentText, tipo === 'despesa' && { color: COLORS.danger }]}>
                Despesa
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, tipo === 'receita' && styles.segmentBtnPrimary]}
              onPress={() => setTipo('receita')}
              activeOpacity={0.7}
            >
              <Icon
                name="arrow-up-circle"
                size={16}
                color={tipo === 'receita' ? COLORS.primary : COLORS.textSecondary}
              />
              <Text style={[styles.segmentText, tipo === 'receita' && { color: COLORS.primary }]}>
                Receita
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Valor</Text>
          <TextInput
            value={formatCurrencyInput(valorRaw)}
            onChangeText={setValorRaw}
            keyboardType="numeric"
            style={[styles.input, styles.inputBig]}
          />

          <Text style={styles.label}>Descrição</Text>
          <TextInput
            value={descricao}
            onChangeText={setDescricao}
            placeholder="Ex: Mercado, Aluguel"
            placeholderTextColor={COLORS.textMuted}
            style={styles.input}
          />

          <Text style={styles.label}>Data</Text>
          <TextInput
            value={data}
            onChangeText={setData}
            placeholder="2026-04-28"
            placeholderTextColor={COLORS.textMuted}
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

          <Text style={styles.label}>Observação</Text>
          <TextInput
            value={observacao}
            onChangeText={setObservacao}
            multiline
            style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]}
            placeholder="Notas adicionais (opcional)"
            placeholderTextColor={COLORS.textMuted}
          />

          <Text style={styles.label}>Comprovante</Text>
          <View style={styles.attachRow}>
            <TouchableOpacity style={styles.attachBtn} onPress={pickFromCamera} activeOpacity={0.7}>
              <Icon name="camera-outline" size={18} color={COLORS.text} />
              <Text style={styles.attachText}>Câmera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachBtn} onPress={pickFromGallery} activeOpacity={0.7}>
              <Icon name="image-outline" size={18} color={COLORS.text} />
              <Text style={styles.attachText}>Galeria</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachBtn} onPress={pickPdf} activeOpacity={0.7}>
              <Icon name="document-outline" size={18} color={COLORS.text} />
              <Text style={styles.attachText}>PDF</Text>
            </TouchableOpacity>
          </View>
          {comprovanteUri && (
            <View style={styles.previewBox}>
              {comprovanteUri.endsWith('.pdf') ? (
                <View style={styles.pdfBadge}>
                  <Icon name="document-text" size={32} color={COLORS.primary} />
                  <Text style={styles.previewText}>PDF anexado</Text>
                </View>
              ) : (
                <Image source={{ uri: comprovanteUri }} style={styles.previewImg} />
              )}
              <TouchableOpacity onPress={() => setComprovanteUri(undefined)} style={styles.removeBtn}>
                <Icon name="trash-outline" size={16} color={COLORS.danger} />
                <Text style={[styles.attachText, { color: COLORS.danger, marginLeft: 6 }]}>Remover</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, paddingBottom: SPACING.md },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  filtersWrap: { paddingBottom: SPACING.sm },
  filters: { paddingHorizontal: SPACING.md, gap: SPACING.sm, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  chipText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: COLORS.primary, fontWeight: '600' },
  divider: { width: 1, height: 18, backgroundColor: COLORS.border, marginHorizontal: SPACING.xs },
  list: { padding: SPACING.lg, paddingBottom: 100 },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginTop: SPACING.md,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginTop: SPACING.xs,
    textAlign: 'center',
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
  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.sm,
    gap: 6,
  },
  segmentBtnPrimary: { backgroundColor: COLORS.primarySoft },
  segmentBtnDanger: { backgroundColor: COLORS.dangerSoft },
  segmentText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 14 },
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
  attachRow: { flexDirection: 'row', gap: SPACING.sm },
  attachBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  attachText: { color: COLORS.text, fontSize: 13, fontWeight: '500' },
  previewBox: {
    backgroundColor: COLORS.card,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  pdfBadge: { alignItems: 'center', gap: 6 },
  previewImg: { width: 140, height: 140, borderRadius: RADIUS.md },
  previewText: { color: COLORS.text, fontSize: 13 },
  removeBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
});
