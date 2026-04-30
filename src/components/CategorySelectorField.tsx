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
import { useTheme } from '../hooks/useTheme';
import { Category, META_CATEGORY_PREFIX, RADIUS, SPACING } from '../types';
import { generateId } from '../utils/formatters';
import { CategoryDot } from './CategoryDot';

const PALETTE = [
  '#ff6b6b', '#ff9f43', '#feca57', '#1dd1a1',
  '#3ddc97', '#48dbfb', '#54a0ff', '#7c8aff',
  '#a55eea', '#fd79a8', '#b8b8b8', '#ffeaa7',
];

interface Props {
  categoriaId: string;
  onChange: (id: string) => void;
}

export function CategorySelectorField({ categoriaId, onChange }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { items, save } = useCategories();
  const [creating, setCreating] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novaCor, setNovaCor] = useState(PALETTE[0]);

  const userCategories = items.filter((c) => !c.id.startsWith(META_CATEGORY_PREFIX));

  const handleCreate = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    if (items.some((c) => c.nome.toLowerCase() === nome.toLowerCase())) {
      Alert.alert('Atenção', 'Já existe uma categoria com esse nome.');
      return;
    }
    const nova: Category = { id: generateId(), nome, cor: novaCor };
    await save([...items, nova]);
    onChange(nova.id);
    setCreating(false);
    setNovoNome('');
    setNovaCor(PALETTE[0]);
  };

  return (
    <>
      <View style={styles.grid}>
        {userCategories.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.chip, categoriaId === c.id && styles.chipActive]}
            onPress={() => onChange(c.id)}
            activeOpacity={0.7}
          >
            <CategoryDot color={c.cor} size={10} />
            <Text style={styles.chipText}>{c.nome}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.chip, styles.chipNew]}
          onPress={() => setCreating(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.chipNewText}>+ Nova</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={creating} transparent animationType="fade" onRequestClose={() => setCreating(false)}>
        <Pressable style={styles.overlay} onPress={() => setCreating(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>Nova categoria</Text>

            <TextInput
              value={novoNome}
              onChangeText={setNovoNome}
              placeholder="Nome"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoFocus
            />

            <Text style={styles.paletteLabel}>Cor</Text>
            <View style={styles.palette}>
              {PALETTE.map((color) => (
                <TouchableOpacity
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

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => setCreating(false)}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnConfirm]} onPress={handleCreate}>
                <Text style={styles.btnConfirmText}>Criar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.card,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: 'transparent',
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '500' },
  chipNew: { borderColor: colors.border, borderStyle: 'dashed' },
  chipNewText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    padding: SPACING.xl, paddingBottom: 40,
  },
  sheetTitle: { color: colors.text, fontSize: 17, fontWeight: '700', marginBottom: SPACING.lg },
  input: {
    backgroundColor: colors.cardElevated,
    color: colors.text,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderRadius: RADIUS.md, fontSize: 15,
    marginBottom: SPACING.md,
  },
  paletteLabel: {
    color: colors.textSecondary, fontSize: 12, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.xl },
  swatch: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 2, borderColor: 'transparent',
  },
  swatchActive: { borderColor: colors.text },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  btn: { flex: 1, alignItems: 'center', paddingVertical: SPACING.md, borderRadius: RADIUS.md },
  btnCancel: { backgroundColor: colors.cardElevated },
  btnCancelText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  btnConfirm: { backgroundColor: colors.primary },
  btnConfirmText: { color: '#0a0a0b', fontSize: 15, fontWeight: '700' },
});
