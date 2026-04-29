import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCategories } from '../hooks/useStorage';
import { CategoryDot } from './CategoryDot';
import { Icon } from './Icon';
import { RADIUS, SPACING, Category, META_CATEGORY_PREFIX } from '../types';
import { useTheme } from '../hooks/useTheme';
import { generateId } from '../utils/formatters';

const PALETTE = [
  '#ff6b6b',
  '#ff9f43',
  '#feca57',
  '#1dd1a1',
  '#3ddc97',
  '#48dbfb',
  '#54a0ff',
  '#7c8aff',
  '#a55eea',
  '#fd79a8',
  '#b8b8b8',
  '#ffeaa7',
];

interface CategoryManagerProps {
  visible: boolean;
  onClose: () => void;
}

export function CategoryManager({ visible, onClose }: CategoryManagerProps) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const { items, save } = useCategories();
  const [novoNome, setNovoNome] = useState('');
  const [novaCor, setNovaCor] = useState(PALETTE[0]);
  const [editing, setEditing] = useState<Category | null>(null);

  const userCategories = items.filter((c) => !c.id.startsWith(META_CATEGORY_PREFIX));

  const handleAdd = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    if (items.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) {
      Alert.alert('Atenção', 'Já existe categoria com esse nome.');
      return;
    }
    await save([...items, { id: generateId(), nome, cor: novaCor }]);
    setNovoNome('');
    setNovaCor(PALETTE[0]);
  };

  const handleDelete = (cat: Category) => {
    Alert.alert(
      'Excluir categoria',
      `Excluir "${cat.nome}"? Lançamentos antigos vinculados ficam sem categoria.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => save(items.filter((c) => c.id !== cat.id)),
        },
      ],
    );
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    const nome = editing.nome.trim();
    if (!nome) return;
    await save(items.map((c) => (c.id === editing.id ? { ...editing, nome } : c)));
    setEditing(null);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.headerCancel}>Fechar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Categorias</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.sectionLabel}>Suas categorias</Text>
          {userCategories.length === 0 && (
            <Text style={styles.empty}>Nenhuma categoria criada por você ainda.</Text>
          )}
          {userCategories.map((c) => (
            <View key={c.id} style={styles.row}>
              {editing?.id === c.id ? (
                <>
                  <View style={styles.colorPickerInline}>
                    {PALETTE.map((color) => (
                      <Pressable
                        key={color}
                        onPress={() => setEditing({ ...editing, cor: color })}
                        style={[
                          styles.swatch,
                          { backgroundColor: color },
                          editing.cor === color && styles.swatchActive,
                        ]}
                      />
                    ))}
                  </View>
                  <TextInput
                    value={editing.nome}
                    onChangeText={(text) => setEditing({ ...editing, nome: text })}
                    style={styles.editInput}
                    autoFocus
                  />
                  <TouchableOpacity onPress={handleSaveEdit} style={styles.iconBtn}>
                    <Icon name="checkmark" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditing(null)} style={styles.iconBtn}>
                    <Icon name="close" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <CategoryDot color={c.cor} size={14} />
                  <Text style={styles.rowName}>{c.nome}</Text>
                  <TouchableOpacity onPress={() => setEditing(c)} style={styles.iconBtn}>
                    <Icon name="create-outline" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(c)} style={styles.iconBtn}>
                    <Icon name="trash-outline" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          ))}

          <Text style={styles.sectionLabel}>Nova categoria</Text>
          <View style={styles.colorPicker}>
            {PALETTE.map((color) => (
              <Pressable
                key={color}
                onPress={() => setNovaCor(color)}
                style={[
                  styles.swatch,
                  { backgroundColor: color },
                  novaCor === color && styles.swatchActive,
                ]}
              />
            ))}
          </View>
          <View style={styles.addRow}>
            <TextInput
              value={novoNome}
              onChangeText={setNovoNome}
              placeholder="Nome da categoria"
              placeholderTextColor={colors.textMuted}
              style={styles.addInput}
            />
            <TouchableOpacity onPress={handleAdd} style={styles.addBtn} activeOpacity={0.8}>
              <Icon name="add" size={18} color="#0a0a0b" />
              <Text style={styles.addBtnText}>Criar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.notice}>
            <Icon name="information-circle-outline" size={16} color={colors.primary} />
            <Text style={styles.noticeText}>
              Categorias auto-geradas pelas Metas (ex: "Meta: Viagem") não aparecem aqui — são gerenciadas direto na aba Metas.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  headerCancel: { color: colors.textSecondary, fontSize: 15 },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  body: { padding: SPACING.lg, paddingBottom: 60 },
  sectionLabel: {
    color: colors.textSecondary, fontSize: 12,
    fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: colors.card,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.xs,
  },
  rowName: { color: colors.text, fontSize: 14, flex: 1 },
  iconBtn: { padding: 4 },
  editInput: {
    flex: 1,
    backgroundColor: colors.cardElevated,
    color: colors.text,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    fontSize: 14,
  },
  colorPicker: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  colorPickerInline: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  swatch: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 2, borderColor: 'transparent',
  },
  swatchActive: { borderColor: colors.text },
  addRow: { flexDirection: 'row', gap: SPACING.sm, alignItems: 'center' },
  addInput: {
    flex: 1,
    backgroundColor: colors.card,
    color: colors.text,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    fontSize: 14,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
  },
  addBtnText: { color: '#0a0a0b', fontSize: 14, fontWeight: '700' },
  notice: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.primarySoft,
    padding: SPACING.md, borderRadius: RADIUS.md,
    marginTop: SPACING.lg, gap: SPACING.sm,
  },
  noticeText: { color: colors.text, fontSize: 12, flex: 1, lineHeight: 17 },
});
