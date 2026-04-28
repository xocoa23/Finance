import React, { useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../hooks/useAuth';
import { useCategories } from '../hooks/useStorage';
import { useMonthlyIncome } from '../hooks/useMonthlyIncome';
import { CategoryDot } from '../components/CategoryDot';
import { PinPad } from '../components/PinPad';
import { Icon, IconName } from '../components/Icon';
import { MoneyText } from '../components/MoneyText';
import { HistoricoModal } from './HistoricoModal';
import { storage } from '../services/storage';
import { notifications } from '../services/notifications';
import { COLORS, Category, RADIUS, SPACING, STORAGE_KEYS } from '../types';
import {
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyInput,
  generateId,
} from '../utils/formatters';

const PALETTE = [
  '#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf',
  '#ff8b94', '#c7ceea', '#3ddc97', '#ffc070',
  '#9b59b6', '#3498db', '#e74c3c', '#1abc9c',
];

type ModalType =
  | null
  | 'calc' | 'categorias' | 'seguranca' | 'backup' | 'sobre' | 'historico' | 'changePin' | 'renda';

interface MenuItem {
  id: ModalType;
  icon: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
}

export function MaisScreen() {
  const auth = useAuth();
  const [modal, setModal] = useState<ModalType>(null);
  const [rendaMensal] = useMonthlyIncome();

  const sections: Array<{ title: string; items: MenuItem[] }> = [
    {
      title: 'Análise',
      items: [
        { id: 'historico', icon: 'stats-chart-outline', title: 'Histórico & comparativos', subtitle: 'Mês × mês, ano × ano' },
        { id: 'calc', icon: 'calculator-outline', title: 'Calculadora financeira', subtitle: 'Juros simples e compostos' },
      ],
    },
    {
      title: 'Configurações',
      items: [
        {
          id: 'renda',
          icon: 'wallet-outline',
          title: 'Renda mensal',
          subtitle: rendaMensal > 0 ? formatCurrency(rendaMensal) : 'Ainda não definida',
        },
        { id: 'categorias', icon: 'pricetag-outline', title: 'Categorias', subtitle: 'Personalize cores e nomes' },
        { id: 'seguranca', icon: 'shield-checkmark-outline', title: 'Segurança', subtitle: 'PIN, biometria, dados' },
        { id: 'backup', icon: 'cloud-download-outline', title: 'Backup', subtitle: 'Exportar e importar dados' },
      ],
    },
    {
      title: 'Sobre',
      items: [
        { id: 'sobre', icon: 'information-circle-outline', title: 'Sobre o app' },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Mais</Text>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.row, idx > 0 && styles.rowBorder]}
                  onPress={() => setModal(item.id)}
                  activeOpacity={0.6}
                >
                  <View style={styles.rowIconWrap}>
                    <Icon name={item.icon} size={20} color={item.iconColor ?? COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    {item.subtitle ? <Text style={styles.rowSubtitle}>{item.subtitle}</Text> : null}
                  </View>
                  <Icon name="chevron-forward" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.lockBtn} onPress={() => auth.lock()} activeOpacity={0.7}>
          <Icon name="lock-closed" size={16} color={COLORS.warning} />
          <Text style={styles.lockBtnText}>Bloquear agora</Text>
        </TouchableOpacity>
      </ScrollView>

      <HistoricoModal visible={modal === 'historico'} onClose={() => setModal(null)} />
      <RendaModal visible={modal === 'renda'} onClose={() => setModal(null)} />
      <CalculatorModal visible={modal === 'calc'} onClose={() => setModal(null)} />
      <CategoriasModal visible={modal === 'categorias'} onClose={() => setModal(null)} />
      <SegurancaModal
        visible={modal === 'seguranca'}
        onClose={() => setModal(null)}
        onChangePin={() => setModal('changePin')}
      />
      <ChangePinModal visible={modal === 'changePin'} onClose={() => setModal('seguranca')} />
      <BackupModal visible={modal === 'backup'} onClose={() => setModal(null)} />
      <SobreModal visible={modal === 'sobre'} onClose={() => setModal(null)} />
    </SafeAreaView>
  );
}

function RendaModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [renda, setRenda] = useMonthlyIncome();
  const [valorRaw, setValorRaw] = useState('');

  React.useEffect(() => {
    if (visible) setValorRaw(renda > 0 ? String(Math.round(renda * 100)) : '');
  }, [visible, renda]);

  const handle = async () => {
    const valor = parseCurrencyInput(valorRaw);
    if (valor < 0) return;
    await setRenda(valor);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Cancelar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Renda mensal</Text>
          <TouchableOpacity onPress={handle}>
            <Text style={[styles.cancel, { fontWeight: '700' }]}>Salvar</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <View style={styles.infoCard}>
            <Icon name="wallet" size={20} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>O que é a renda mensal?</Text>
              <Text style={styles.infoText}>
                Seu salário ou rendimento fixo. Não vira lançamento — é só uma referência pra projetar
                quanto vai sobrar depois das contas fixas e despesas do mês.
              </Text>
            </View>
          </View>

          <Text style={styles.label}>Valor</Text>
          <TextInput
            value={formatCurrencyInput(valorRaw)}
            onChangeText={setValorRaw}
            keyboardType="numeric"
            style={[styles.input, styles.inputBig]}
            autoFocus
          />

          <Text style={styles.help}>
            Deixe zerado se preferir registrar tudo apenas como lançamentos reais.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function CalculatorModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [valorRaw, setValorRaw] = useState('');
  const [taxa, setTaxa] = useState('1');
  const [meses, setMeses] = useState('12');

  const principal = parseCurrencyInput(valorRaw);
  const i = parseFloat(taxa.replace(',', '.')) / 100 || 0;
  const n = parseInt(meses, 10) || 0;
  const simples = principal * (1 + i * n);
  const composto = principal * Math.pow(1 + i, n);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Fechar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Calculadora</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <Text style={styles.label}>Valor inicial</Text>
          <TextInput
            value={formatCurrencyInput(valorRaw)} onChangeText={setValorRaw}
            keyboardType="numeric" style={[styles.input, styles.inputBig]}
          />
          <Text style={styles.label}>Taxa de juros (% ao mês)</Text>
          <TextInput value={taxa} onChangeText={setTaxa} keyboardType="numeric" style={styles.input} />
          <Text style={styles.label}>Tempo (meses)</Text>
          <TextInput value={meses} onChangeText={setMeses} keyboardType="numeric" style={styles.input} />

          <View style={styles.resultBlock}>
            <View style={styles.resultHeader}>
              <Icon name="trending-up-outline" size={18} color={COLORS.primary} />
              <Text style={styles.resultLabel}>Juros compostos</Text>
            </View>
            <Text style={[styles.resultValue, { color: COLORS.primary }]}>
              {formatCurrency(composto)}
            </Text>
            <Text style={styles.resultMeta}>
              + {formatCurrency(composto - principal)} em juros
            </Text>
          </View>

          <View style={styles.resultBlock}>
            <View style={styles.resultHeader}>
              <Icon name="trending-up-outline" size={18} color={COLORS.textSecondary} />
              <Text style={styles.resultLabel}>Juros simples</Text>
            </View>
            <Text style={styles.resultValue}>{formatCurrency(simples)}</Text>
            <Text style={styles.resultMeta}>
              + {formatCurrency(simples - principal)} em juros
            </Text>
          </View>

          <Text style={styles.help}>
            Composto cresce sobre o saldo acumulado · simples cresce só sobre o valor inicial.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function CategoriasModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { items, save } = useCategories();
  const [edit, setEdit] = useState<Category | null>(null);
  const [nome, setNome] = useState('');
  const [cor, setCor] = useState(PALETTE[0]);

  const startNew = () => {
    setEdit({ id: generateId(), nome: '', cor: PALETTE[0] });
    setNome('');
    setCor(PALETTE[0]);
  };

  const startEdit = (c: Category) => {
    setEdit(c);
    setNome(c.nome);
    setCor(c.cor);
  };

  const handleSave = async () => {
    if (!edit || !nome.trim()) return;
    const exists = items.some((c) => c.id === edit.id);
    const updated: Category = { ...edit, nome: nome.trim(), cor };
    const next = exists ? items.map((c) => (c.id === edit.id ? updated : c)) : [...items, updated];
    await save(next);
    setEdit(null);
  };

  const handleDelete = async (c: Category) => {
    Alert.alert('Excluir categoria', `Remover "${c.nome}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive',
        onPress: async () => { await save(items.filter((x) => x.id !== c.id)); },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Fechar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Categorias</Text>
          <TouchableOpacity onPress={startNew}>
            <Icon name="add" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          {edit ? (
            <View style={styles.editBlock}>
              <Text style={styles.label}>Nome</Text>
              <TextInput value={nome} onChangeText={setNome} style={styles.input} autoFocus />
              <Text style={styles.label}>Cor</Text>
              <View style={styles.palette}>
                {PALETTE.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.swatch, { backgroundColor: p }, cor === p && styles.swatchActive]}
                    onPress={() => setCor(p)}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg }}>
                <TouchableOpacity style={[styles.actionBtn, styles.actionMuted]} onPress={() => setEdit(null)}>
                  <Text style={styles.actionText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={handleSave}>
                  <Text style={[styles.actionText, { color: '#0a0a0b' }]}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            items.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.catRow}
                onPress={() => startEdit(c)}
                onLongPress={() => handleDelete(c)}
                activeOpacity={0.6}
              >
                <CategoryDot color={c.cor} size={14} />
                <Text style={styles.catRowText}>{c.nome}</Text>
                <Icon name="chevron-forward" size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            ))
          )}
          {!edit && (
            <Text style={styles.help}>Toque para editar · pressione e segure para excluir.</Text>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SegurancaModal({
  visible, onClose, onChangePin,
}: { visible: boolean; onClose: () => void; onChangePin: () => void }) {
  const auth = useAuth();
  const [bio, setBio] = useState(auth.biometricEnabled);

  React.useEffect(() => { setBio(auth.biometricEnabled); }, [auth.biometricEnabled, visible]);

  const toggleBio = async (val: boolean) => {
    if (val && !auth.biometricAvailable) {
      Alert.alert('Biometria indisponível', 'Cadastre uma biometria nas configurações do sistema.');
      return;
    }
    setBio(val);
    await auth.setBiometricEnabled(val);
  };

  const wipeAll = () => {
    Alert.alert(
      'Apagar todos os dados',
      'Remove transações, gastos fixos, parcelas, metas, categorias e PIN. Não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar', style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Tem certeza?',
              'Tudo será perdido permanentemente.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Apagar tudo', style: 'destructive',
                  onPress: async () => {
                    await Promise.all(
                      Object.values(STORAGE_KEYS).map((k) => storage.deleteRaw(k)),
                    );
                    await notifications.cancelAll();
                    Alert.alert('Pronto', 'Dados apagados. Reinicie o app.');
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Fechar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Segurança</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <View style={styles.infoCard}>
            <Icon name="shield-checkmark" size={20} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Como protegemos seus dados</Text>
              <Text style={styles.infoText}>
                PIN: hash SHA-256 + salt no Keychain do iOS · Auto-bloqueio em 5 min · Comprovantes em
                sandbox privado · 100% offline.
              </Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <TouchableOpacity style={styles.row} onPress={onChangePin} activeOpacity={0.6}>
              <View style={styles.rowIconWrap}>
                <Icon name="keypad-outline" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.rowTitle}>Alterar PIN</Text>
              <Icon name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>

            <View style={[styles.row, styles.rowBorder]}>
              <View style={styles.rowIconWrap}>
                <Icon name="finger-print-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{auth.biometricLabel}</Text>
                <Text style={styles.rowSubtitle}>
                  {auth.biometricAvailable ? 'Disponível' : 'Não cadastrada no dispositivo'}
                </Text>
              </View>
              <Switch
                value={bio} onValueChange={toggleBio} disabled={!auth.biometricAvailable}
                trackColor={{ true: COLORS.primary, false: COLORS.border }}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.dangerBtn} onPress={wipeAll} activeOpacity={0.7}>
            <Icon name="trash-outline" size={18} color={COLORS.danger} />
            <Text style={styles.dangerBtnText}>Apagar todos os dados</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ChangePinModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const auth = useAuth();
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>('current');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  const [reset, setReset] = useState(0);

  React.useEffect(() => {
    if (visible) {
      setStep('current');
      setNewPin('');
      setError('');
    }
  }, [visible]);

  const handle = async (pin: string) => {
    setError('');
    if (step === 'current') {
      const ok = await auth.unlockWithPin(pin);
      if (ok) { setStep('new'); setReset((r) => r + 1); }
      else { setError('PIN atual incorreto'); setReset((r) => r + 1); }
    } else if (step === 'new') {
      setNewPin(pin); setStep('confirm'); setReset((r) => r + 1);
    } else {
      if (pin !== newPin) {
        setError('PINs não coincidem'); setStep('new'); setNewPin(''); setReset((r) => r + 1);
      } else {
        await auth.changePin(pin, pin);
        Alert.alert('Sucesso', 'PIN alterado.');
        onClose();
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Cancelar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Alterar PIN</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={[styles.modalBody, { alignItems: 'center', justifyContent: 'center', flex: 1 }]}>
          <PinPad
            title={step === 'current' ? 'PIN atual' : step === 'new' ? 'Novo PIN' : 'Confirme o novo PIN'}
            errorMessage={error} resetSignal={reset} onComplete={handle}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function BackupModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<string>('');

  const exportar = async () => {
    try {
      setStatus('Gerando backup...');
      const payload = await storage.exportAll();
      const json = JSON.stringify(payload, null, 2);
      const filename = `financas-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const path = `${FileSystem.documentDirectory}${filename}`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });

      const Sharing = await import('expo-sharing').catch(() => null);
      if (Sharing && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Salvar backup' });
        setStatus(`Backup salvo: ${filename}`);
      } else {
        setStatus(`Backup salvo localmente em ${path}`);
      }
    } catch (e: any) {
      setStatus(`Erro: ${e.message}`);
    }
  };

  const importar = async () => {
    try {
      const r = await DocumentPicker.getDocumentAsync({
        type: 'application/json', copyToCacheDirectory: true,
      });
      if (r.canceled || !r.assets?.[0]) return;
      const content = await FileSystem.readAsStringAsync(r.assets[0].uri);
      const payload = JSON.parse(content);

      Alert.alert('Confirmar importação', 'Isso substituirá seus dados atuais. Continuar?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Importar', style: 'destructive',
          onPress: async () => {
            await storage.importAll(payload);
            Alert.alert('Pronto', 'Dados importados.');
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert('Erro', `Não foi possível importar: ${e.message}`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Fechar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Backup</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <View style={styles.infoCard}>
            <Icon name="cloud-download-outline" size={20} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>O que é o backup?</Text>
              <Text style={styles.infoText}>
                Arquivo JSON com seus lançamentos, gastos fixos, parcelas, metas e categorias. Útil
                pra trocar de aparelho ou se reinstalar o app.
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Icon name="warning-outline" size={20} color={COLORS.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Cuidados</Text>
              <Text style={styles.infoText}>
                O JSON contém todos seus dados em texto. Salve em local seguro (iCloud / Drive).
                Não envie por canais públicos.
              </Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary, { marginTop: SPACING.sm }]} onPress={exportar}>
            <Icon name="arrow-up-circle-outline" size={18} color="#0a0a0b" />
            <Text style={[styles.actionText, { color: '#0a0a0b', marginLeft: 6 }]}>Exportar backup</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.actionMuted, { marginTop: SPACING.sm }]} onPress={importar}>
            <Icon name="arrow-down-circle-outline" size={18} color={COLORS.text} />
            <Text style={[styles.actionText, { marginLeft: 6 }]}>Importar backup</Text>
          </TouchableOpacity>

          {status ? <Text style={[styles.help, { marginTop: SPACING.lg }]}>{status}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SobreModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalSafe} edges={['top']}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Fechar</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Sobre</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <View style={styles.aboutLogo}>
            <Icon name="wallet" size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.aboutName}>Finanças</Text>
          <Text style={styles.aboutVersion}>Versão 1.0.0</Text>
          <Text style={styles.aboutText}>
            App offline para controle financeiro pessoal. Seus dados nunca saem do dispositivo.
          </Text>
          <Text style={styles.aboutText}>
            React Native + Expo · PIN com SHA-256 + salt · Keychain/Keystore.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 80 },
  header: { marginBottom: SPACING.lg },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },

  section: { marginBottom: SPACING.lg },
  sectionTitle: {
    color: COLORS.textSecondary, fontSize: 11, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: SPACING.sm, marginLeft: SPACING.xs,
  },
  sectionCard: { backgroundColor: COLORS.card, borderRadius: RADIUS.md, overflow: 'hidden' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.md,
    gap: SPACING.md,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: COLORS.borderSoft },
  rowIconWrap: {
    width: 36, height: 36, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.cardElevated,
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { color: COLORS.text, fontSize: 15, fontWeight: '500', flex: 1 },
  rowSubtitle: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },

  lockBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.warningSoft,
    paddingVertical: SPACING.md, borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  lockBtnText: { color: COLORS.warning, fontSize: 14, fontWeight: '600' },

  modalSafe: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderSoft,
  },
  modalTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  cancel: { color: COLORS.primary, fontSize: 15, fontWeight: '600', minWidth: 60 },
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
  help: { color: COLORS.textMuted, fontSize: 12, textAlign: 'center', marginTop: SPACING.md },

  resultBlock: { backgroundColor: COLORS.card, padding: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.md },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultLabel: { color: COLORS.textSecondary, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '600' },
  resultValue: { color: COLORS.text, fontSize: 24, fontWeight: '700', marginTop: SPACING.xs },
  resultMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },

  catRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.card, paddingVertical: SPACING.md, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md, marginBottom: SPACING.xs, gap: SPACING.md,
  },
  catRowText: { color: COLORS.text, fontSize: 15, flex: 1 },

  editBlock: { backgroundColor: COLORS.card, padding: SPACING.lg, borderRadius: RADIUS.md },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginTop: 4 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: COLORS.text },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.md, borderRadius: RADIUS.md, flex: 1,
  },
  actionPrimary: { backgroundColor: COLORS.primary },
  actionMuted: { backgroundColor: COLORS.card },
  actionText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },

  infoCard: {
    flexDirection: 'row', gap: SPACING.md,
    backgroundColor: COLORS.card, padding: SPACING.md,
    borderRadius: RADIUS.md, marginBottom: SPACING.md,
  },
  infoTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  infoText: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 4 },

  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: SPACING.lg,
    backgroundColor: COLORS.dangerSoft, paddingVertical: SPACING.md, borderRadius: RADIUS.md,
  },
  dangerBtnText: { color: COLORS.danger, fontSize: 14, fontWeight: '600' },

  aboutLogo: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primarySoft,
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center',
    marginVertical: SPACING.lg,
  },
  aboutName: { color: COLORS.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  aboutVersion: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: SPACING.lg },
  aboutText: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: SPACING.md, textAlign: 'center' },
});
