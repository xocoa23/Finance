import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTransactions, useCategories } from '../hooks/useStorage';
import { CategorySelectorField } from './CategorySelectorField';
import { Icon } from './Icon';
import { RADIUS, SPACING, TransactionType } from '../types';
import { useTheme } from '../hooks/useTheme';
import { formatCurrencyInput, parseCurrencyInput, generateId } from '../utils/formatters';

interface Props {
  visible: boolean;
  comprovanteUri: string;
  onClose: () => void;
}

export function QuickUploadModal({ visible, comprovanteUri, onClose }: Props) {
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { add } = useTransactions();

  const [tipo, setTipo] = useState<TransactionType>('despesa');
  const [valorStr, setValorStr] = useState('R$ 0,00');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState('');
  const [categoriaId, setCategoriaId] = useState('cat-outros');

  useEffect(() => {
    if (visible) {
      setTipo('despesa');
      setValorStr('R$ 0,00');
      setDescricao('');
      setCategoriaId('cat-outros');
      const now = new Date();
      setData(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);
    }
  }, [visible]);

  const handleSave = () => {
    const valor = parseCurrencyInput(valorStr);
    if (valor <= 0) {
      Alert.alert('Valor inválido', 'Digite um valor maior que zero.');
      return;
    }
    if (!descricao.trim()) {
      Alert.alert('Descrição obrigatória', 'Digite uma descrição para o lançamento.');
      return;
    }
    add({
      id: generateId(),
      descricao: descricao.trim(),
      tipo,
      valor,
      data,
      categoriaId,
      comprovanteUri,
      criadoEm: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>Novo lançamento</Text>
            <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
              <Text style={styles.saveText}>Salvar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {/* Comprovante preview */}
            {comprovanteUri ? (
              <View style={styles.imageWrap}>
                <Image source={{ uri: comprovanteUri }} style={styles.image} resizeMode="cover" />
                <View style={styles.imageBadge}>
                  <Icon name="attach-outline" size={12} color={colors.primary} />
                  <Text style={styles.imageBadgeText}>Comprovante anexado</Text>
                </View>
              </View>
            ) : null}

            {/* Tipo toggle */}
            <View style={styles.tipoRow}>
              <TouchableOpacity
                style={[styles.tipoBtn, tipo === 'despesa' && styles.tipoBtnDanger]}
                onPress={() => { setTipo('despesa'); if (tipo !== 'despesa') setCategoriaId('cat-outros'); }}
              >
                <Icon name="arrow-down-outline" size={14} color={tipo === 'despesa' ? '#fff' : colors.textSecondary} />
                <Text style={[styles.tipoBtnText, tipo === 'despesa' && { color: '#fff' }]}>Despesa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tipoBtn, tipo === 'receita' && styles.tipoBtnPrimary]}
                onPress={() => { setTipo('receita'); if (tipo !== 'receita') setCategoriaId('cat-salario'); }}
              >
                <Icon name="arrow-up-outline" size={14} color={tipo === 'receita' ? '#0a0a0b' : colors.textSecondary} />
                <Text style={[styles.tipoBtnText, tipo === 'receita' && { color: '#0a0a0b' }]}>Receita</Text>
              </TouchableOpacity>
            </View>

            {/* Valor */}
            <TextInput
              style={styles.valorInput}
              value={valorStr}
              onChangeText={(t) => setValorStr(formatCurrencyInput(t))}
              keyboardType="numeric"
              selectTextOnFocus
              placeholderTextColor={colors.textMuted}
            />

            {/* Descrição */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Descrição</Text>
              <TextInput
                style={styles.fieldInput}
                value={descricao}
                onChangeText={setDescricao}
                placeholder="Ex: Almoço, Supermercado..."
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Data */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Data</Text>
              <TextInput
                style={styles.fieldInput}
                value={data}
                onChangeText={setData}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={colors.textMuted}
                keyboardType="numbers-and-punctuation"
              />
            </View>

            {/* Categoria */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Categoria</Text>
              <CategorySelectorField categoriaId={categoriaId} onChange={setCategoriaId} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '90%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  cancelBtn: { width: 70 },
  cancelText: { color: colors.textSecondary, fontSize: 15 },
  sheetTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  saveBtn: { width: 70, alignItems: 'flex-end' },
  saveText: { color: colors.primary, fontSize: 15, fontWeight: '700' },
  body: { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 40 },

  imageWrap: {
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  image: { width: '100%', height: 140 },
  imageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    backgroundColor: colors.card,
  },
  imageBadgeText: { color: colors.primary, fontSize: 12, fontWeight: '500' },

  tipoRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  tipoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: colors.card,
  },
  tipoBtnDanger: { backgroundColor: colors.danger },
  tipoBtnPrimary: { backgroundColor: colors.primary },
  tipoBtnText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },

  valorInput: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    letterSpacing: -0.5,
  },

  field: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: 6,
  },
  fieldLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldInput: { color: colors.text, fontSize: 15 },
});
