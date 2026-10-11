import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable,
  SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import {
  Account, Audience, Category, Goal, MonthlyPoint, Profile, Summary, Transaction,
  TransactionStatus, TransactionType, addAccount, addCard, addCardPurchase,
  addCategory, addTransaction, centsFromInput, clearAssistantHistory, createGoal,
  deleteTransaction, exportBackup, getAccounts, getAssistantHistory, getCardPurchases,
  getCards, getCategories, getExpenseBreakdown, getGoals, getLessonProgress,
  getMonthlySeries, getProfile, getSummary, getTransactions, getUpcoming, inputFromCents,
  localDate, monthBounds, money, prepareDatabase, restoreBackup, saveAssistantMessage, saveLessonProgress,
  saveProfile, setSetting, updateGoalSaved, updateTransaction, getSettings, getTransaction,
} from './src/database';
import { DAILY_TIPS, LESSONS, Lesson } from './src/content';

const PURPLE = '#4B1D8C';
const VIOLET = '#7C3AED';
const LAVENDER = '#A78BFA';
const PALE = '#E9DDFB';
const BG = '#F8F7FC';
const INK = '#241B32';
const MUTED = '#81768F';
const LINE = '#EAE4F2';
const GREEN = '#16845B';
const RED = '#D0445B';

type Screen = 'home' | 'transactions' | 'cashflow' | 'assistant' | 'evolui' | 'accounts' | 'goals' | 'reports' | 'cards' | 'settings';
type ModalKind = 'transaction' | 'account' | 'goal' | 'card' | 'purchase' | 'category' | null;

const ptLongDate = (iso: string) => {
  if (!iso) return '—';
  const parts = iso.slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
};
const shortMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
};
const typeLabel = (type: TransactionType) => type === 'income' ? 'Entrada' : type === 'expense' ? 'Saída' : 'Transferência';
const statusLabel = (status: TransactionStatus) => status === 'done' ? 'Realizado' : status === 'planned' ? 'Previsto' : 'Cancelado';
const todayIso = localDate();

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}
function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, autoCapitalize }: any) {
  return <View style={styles.fieldWrap}><Label>{label}</Label><TextInput
    value={value} onChangeText={onChangeText} placeholder={placeholder ?? ''}
    placeholderTextColor="#A99EB5" keyboardType={keyboardType ?? 'default'}
    multiline={multiline} autoCapitalize={autoCapitalize ?? 'sentences'}
    style={[styles.input, multiline && { minHeight: 82, textAlignVertical: 'top' }]}
  /></View>;
}
function PrimaryButton({ title, onPress, disabled, variant = 'primary' }: { title: string; onPress: () => void; disabled?: boolean; variant?: 'primary' | 'secondary' | 'danger' }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }: { pressed: boolean }) => [styles.button, variant === 'secondary' && styles.buttonSecondary, variant === 'danger' && styles.buttonDanger, disabled && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}><Text style={[styles.buttonText, variant === 'secondary' && { color: PURPLE }]}>{title}</Text></Pressable>;
}
function Chip({ title, active, onPress }: { title: string; active?: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{title}</Text></Pressable>;
}
function SectionHeading({ title, right, onRight }: { title: string; right?: string; onRight?: () => void }) {
  return <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text>{right ? <Pressable onPress={onRight}><Text style={styles.link}>{right}</Text></Pressable> : null}</View>;
}
function EmptyState({ title, text }: { title: string; text: string }) {
  return <View style={styles.empty}><Text style={styles.emptyIcon}>✦</Text><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyText}>{text}</Text></View>;
}
function ProgressBar({ ratio, color = VIOLET }: { ratio: number; color?: string }) {
  return <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, ratio * 100))}%`, backgroundColor: color }]} /></View>;
}
function MiniBars({ data, valueKey, color, formatter }: { data: any[]; valueKey: string; color: string; formatter?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((x) => Number(x[valueKey] ?? 0)));
  if (!data.length) return <Text style={styles.muted}>Ainda não há dados suficientes para o gráfico.</Text>;
  return <View style={styles.barsWrap}>{data.map((point, index) => {
    const value = Number(point[valueKey] ?? 0);
    const height = Math.max(value > 0 ? 5 : 2, Math.round((value / max) * 98));
    return <View key={`${point.month ?? point.label}-${index}`} style={styles.barColumn}>
      <Text style={styles.barValue}>{formatter ? formatter(value) : ''}</Text>
      <View style={styles.barTrack}><View style={[styles.bar, { height, backgroundColor: color }]} /></View>
      <Text style={styles.barLabel}>{point.label}</Text>
    </View>;
  })}</View>;
}

export default function App() {
  const [db, setDb] = useState<SQLite.SQLiteDatabase | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [fatalError, setFatalError] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [modal, setModal] = useState<ModalKind>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [goalModalInitial, setGoalModalInitial] = useState<Goal | null>(null);
  const [loadingAction, setLoadingAction] = useState(false);
  const [summary, setSummary] = useState<Summary>({ income_cents: 0, expense_cents: 0, net_cents: 0, balance_cents: 0, planned_income_cents: 0, planned_expense_cents: 0, pending_count: 0 });
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthly, setMonthly] = useState<MonthlyPoint[]>([]);
  const [expenseBreakdown, setExpenseBreakdown] = useState<{ name: string; icon: string; total_cents: number }[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [progress, setProgress] = useState<{ lesson_id: string; completed_at: string; favorite: number }[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [cardPurchases, setCardPurchases] = useState<any[]>([]);
  const [assistantHistory, setAssistantHistory] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [showValues, setShowValues] = useState(true);
  const [movementFilter, setMovementFilter] = useState<'all' | 'income' | 'expense' | 'transfer'>('all');
  const [educationFilter, setEducationFilter] = useState('Todos');
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [profileName, setProfileName] = useState('');
  const [onboardingAudience, setOnboardingAudience] = useState<Audience>('personal');
  const [onboardingChallenges, setOnboardingChallenges] = useState<string[]>(['Organizar gastos']);
  const [onboardingGoal, setOnboardingGoal] = useState('Ter controle do meu dinheiro');
  const [firstAccount, setFirstAccount] = useState('Minha conta');
  const [firstBalance, setFirstBalance] = useState('0,00');

  const refresh = useCallback(async (database: SQLite.SQLiteDatabase) => {
    const [p, s, a, c, t, m, b, g, pr, cardsResult, hist, settingResult] = await Promise.all([
      getProfile(database), getSummary(database), getAccounts(database), getCategories(database), getTransactions(database),
      getMonthlySeries(database, 6), getExpenseBreakdown(database, `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`, localDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))),
      getGoals(database), getLessonProgress(database), getCards(database), getAssistantHistory(database), getSettings(database),
    ]);
    setProfile(p); setSummary(s); setAccounts(a); setCategories(c); setTransactions(t); setMonthly(m); setExpenseBreakdown(b); setGoals(g); setProgress(pr); setCards(cardsResult); setAssistantHistory(hist); setSettings(settingResult);
    setShowValues(settingResult.privacy_hide_values !== 'true');
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const database = await SQLite.openDatabaseAsync('evogest.db');
        await prepareDatabase(database);
        if (!active) return;
        setDb(database);
        await refresh(database);
      } catch (error: any) {
        if (active) setFatalError(error?.message ?? 'Não foi possível abrir o banco de dados local.');
      } finally {
        if (active) setInitializing(false);
      }
    })();
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    if (profile && accounts.length === 0 && screen !== 'settings') setScreen('accounts');
  }, [profile, accounts.length]);

  const categoriesFor = useCallback((type: TransactionType) => categories.filter((cat) => cat.kind === (type === 'income' ? 'income' : 'expense')), [categories]);
  const fmt = useCallback((cents: number) => showValues ? money(cents) : 'R$ •••••', [showValues]);

  const refreshCardPurchases = useCallback(async (cardId: number) => {
    if (!db) return;
    setCardPurchases(await getCardPurchases(db, cardId));
  }, [db]);

  const showTransactionForm = (item?: Transaction) => {
    setEditingTransaction(item ?? null);
    setModal('transaction');
  };

  const deleteTx = (item: Transaction) => {
    Alert.alert('Excluir movimentação?', `“${item.description}” será removida do histórico e dos cálculos.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        if (!db) return;
        try { await deleteTransaction(db, item.id); await refresh(db); }
        catch { Alert.alert('Não foi possível excluir', 'Confira se a movimentação está sendo usada por outra operação.'); }
      } },
    ]);
  };

  const submitTransaction = async (data: Omit<Transaction, 'id'>) => {
    if (!db) return;
    setLoadingAction(true);
    try {
      if (editingTransaction) await updateTransaction(db, editingTransaction.id, data);
      else await addTransaction(db, data);
      setModal(null); setEditingTransaction(null); await refresh(db);
      Alert.alert('Movimentação salva', 'Os saldos e relatórios foram atualizados localmente.');
    } catch (error: any) { Alert.alert('Verifique os dados', error?.message ?? 'Não foi possível salvar a movimentação.'); }
    finally { setLoadingAction(false); }
  };

  const submitOnboarding = async () => {
    if (!db) return;
    setLoadingAction(true);
    try {
      await saveProfile(db, { name: profileName.trim(), audience: onboardingAudience, challenges: onboardingChallenges, primary_goal: onboardingGoal });
      if (firstAccount.trim()) await addAccount(db, firstAccount.trim(), onboardingAudience === 'business' ? 'Caixa do negócio' : 'Conta principal', centsFromInput(firstBalance));
      await refresh(db); setScreen('home');
    } catch (error: any) { Alert.alert('Não foi possível configurar', error?.message ?? 'Tente novamente.'); }
    finally { setLoadingAction(false); }
  };

  const submitAccount = async (data: { name: string; type: string; balance: string }) => {
    if (!db) return;
    try { await addAccount(db, data.name, data.type, centsFromInput(data.balance)); await refresh(db); setModal(null); }
    catch (error: any) { Alert.alert('Não foi possível salvar a conta', error?.message ?? 'Confira os dados.'); }
  };

  const submitGoal = async (data: { name: string; target: string; saved: string; date: string; kind: 'personal' | 'business'; id?: number }) => {
    if (!db) return;
    try {
      if (data.id) await updateGoalSaved(db, data.id, centsFromInput(data.saved));
      else await createGoal(db, data.name, centsFromInput(data.target), centsFromInput(data.saved), data.date, data.kind);
      await refresh(db); setModal(null);
    } catch (error: any) { Alert.alert('Não foi possível salvar a meta', error?.message ?? 'Confira os dados.'); }
  };

  const submitCategory = async (name: string, kind: 'income' | 'expense', icon: string) => {
    if (!db) return;
    try { await addCategory(db, name, kind, icon || '•'); await refresh(db); setModal(null); }
    catch (error: any) { Alert.alert('Não foi possível criar a categoria', error?.message?.includes('UNIQUE') ? 'Já existe uma categoria com esse nome.' : (error?.message ?? 'Confira os dados.')); }
  };

  const submitCard = async (name: string, limit: string, close: string, due: string) => {
    if (!db) return;
    try { await addCard(db, name, centsFromInput(limit), Number(close) || 1, Number(due) || 10); await refresh(db); setModal(null); }
    catch (error: any) { Alert.alert('Não foi possível cadastrar o cartão', error?.message ?? 'Confira os dados.'); }
  };

  const submitPurchase = async (data: { description: string; amount: string; categoryId: number | null; date: string; installments: string; notes: string }) => {
    if (!db || !selectedCard) return;
    try { await addCardPurchase(db, selectedCard, data.description, centsFromInput(data.amount), data.categoryId, data.date, Math.max(1, Number(data.installments) || 1), data.notes); await refresh(db); await refreshCardPurchases(selectedCard); setModal(null); }
    catch (error: any) { Alert.alert('Não foi possível registrar a compra', error?.message ?? 'Confira os dados.'); }
  };

  const sendAssistantQuestion = async (questionOverride?: string) => {
    if (!db) return;
    const question = (questionOverride ?? assistantQuestion).trim();
    if (!question) return;
    const answer = await buildLocalAnswer(db, question, summary, fmt);
    await saveAssistantMessage(db, question, answer);
    setAssistantQuestion(''); await refresh(db);
  };

  const exportData = async () => {
    if (!db) return;
    try {
      const backup = await exportBackup(db);
      const uri = `${FileSystem.documentDirectory}evogest-backup-${localDate()}.json`;
      await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup, null, 2), { encoding: FileSystem.EncodingType.UTF8 });
      const available = await Sharing.isAvailableAsync();
      if (available) await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Exportar backup EvoGest' });
      else Alert.alert('Backup criado', `Arquivo salvo localmente: ${uri}`);
    } catch (error: any) { Alert.alert('Falha no backup', error?.message ?? 'Não foi possível criar o arquivo.'); }
  };

  const importData = async () => {
    if (!db) return;
    try {
      const pick = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/json'], copyToCacheDirectory: true, multiple: false });
      if (pick.canceled || !pick.assets?.[0]) return;
      const content = await FileSystem.readAsStringAsync(pick.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
      const parsed = JSON.parse(content);
      Alert.alert('Restaurar backup?', 'A restauração substituirá os dados atuais deste aplicativo. Faça um backup antes de continuar.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Restaurar', style: 'destructive', onPress: async () => {
          try { await restoreBackup(db, parsed); await refresh(db); Alert.alert('Backup restaurado', 'Os dados foram importados para este dispositivo.'); }
          catch (error: any) { Alert.alert('Não foi possível restaurar', error?.message ?? 'O arquivo é inválido.'); }
        } },
      ]);
    } catch (error: any) { Alert.alert('Falha na importação', error?.message ?? 'Não foi possível abrir o arquivo.'); }
  };

  const exportCsv = async () => {
    if (!db) return;
    try {
      const rows = await getTransactions(db, 5000);
      const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const lines = [['Data','Tipo','Descrição','Categoria','Conta','Status','Valor_centavos'].join(';')];
      for (const t of rows) lines.push([t.transaction_date, typeLabel(t.type), escape(t.description), escape(t.category_name ?? ''), escape(t.account_name ?? ''), statusLabel(t.status), String(t.amount_cents)].join(';'));
      const uri = `${FileSystem.documentDirectory}evogest-movimentacoes-${localDate()}.csv`;
      await FileSystem.writeAsStringAsync(uri, '\uFEFF' + lines.join('\n'), { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: 'Exportar movimentações' });
      else Alert.alert('Arquivo criado', uri);
    } catch (error: any) { Alert.alert('Falha na exportação', error?.message ?? 'Não foi possível exportar os registros.'); }
  };

  const toggleHideValues = async () => {
    if (!db) return;
    const next = showValues ? 'true' : 'false';
    await setSetting(db, 'privacy_hide_values', next);
    setShowValues(!showValues);
    setSettings((prev) => ({ ...prev, privacy_hide_values: next }));
  };

  const clearData = () => {
    if (!db) return;
    Alert.alert('Apagar todos os dados?', 'Essa ação é irreversível. Exporte um backup antes. O aplicativo voltará ao onboarding inicial.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar dados', style: 'destructive', onPress: async () => {
        try {
          await db.execAsync('DELETE FROM card_purchases; DELETE FROM cards; DELETE FROM transactions; DELETE FROM goals; DELETE FROM lesson_progress; DELETE FROM assistant_history; DELETE FROM accounts; DELETE FROM profile;');
          await refresh(db); setScreen('home');
        } catch { Alert.alert('Erro', 'Não foi possível apagar os dados.'); }
      } },
    ]);
  };

  if (initializing) return <SafeAreaView style={styles.center}><StatusBar barStyle="dark-content" backgroundColor={BG} /><ActivityIndicator size="large" color={VIOLET} /><Text style={styles.loadingText}>Preparando seu espaço financeiro...</Text></SafeAreaView>;
  if (fatalError) return <SafeAreaView style={styles.center}><StatusBar barStyle="dark-content" backgroundColor={BG} /><Text style={styles.brandMark}>E</Text><Text style={styles.screenTitle}>Não foi possível abrir o EvoGest</Text><Text style={styles.bodyText}>{fatalError}</Text><Text style={styles.bodyText}>Se esta instalação foi feita a partir de uma versão anterior, não desinstale o aplicativo antes de verificar se há um backup válido.</Text></SafeAreaView>;
  if (!db) return null;
  if (!profile) return <Onboarding
    profileName={profileName} setProfileName={setProfileName} audience={onboardingAudience} setAudience={setOnboardingAudience}
    challenges={onboardingChallenges} setChallenges={setOnboardingChallenges} goal={onboardingGoal} setGoal={setOnboardingGoal}
    accountName={firstAccount} setAccountName={setFirstAccount} balance={firstBalance} setBalance={setFirstBalance}
    submitting={loadingAction} onSubmit={submitOnboarding}
  />;

  const title = ({ home: 'Visão geral', transactions: 'Movimentações', cashflow: 'Fluxo de caixa', assistant: 'Evo Assistente', evolui: 'EvoGest Evolui', accounts: 'Minhas contas', goals: 'Metas financeiras', reports: 'Relatórios', cards: 'Cartões', settings: 'Configurações' } as Record<Screen, string>)[screen];

  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="dark-content" backgroundColor={BG} />
    <View style={styles.appHeader}>
      <View style={styles.brandRow}><View style={styles.brandIcon}><Text style={styles.brandIconText}>E↗</Text></View><View><Text style={styles.brandTitle}>EvoGest</Text><Text style={styles.brandSubtitle}>Sua gestão evolui.</Text></View></View>
      <View style={styles.headerButtons}><Pressable onPress={toggleHideValues} style={styles.iconButton}><Text style={styles.iconButtonText}>{showValues ? '◉' : '◎'}</Text></Pressable><Pressable onPress={() => setScreen('settings')} style={styles.iconButton}><Text style={styles.iconButtonText}>☰</Text></Pressable></View>
    </View>
    <View style={styles.screenHead}><Text style={styles.screenTitle}>{title}</Text>{screen === 'transactions' || screen === 'home' ? <Pressable style={styles.addButton} onPress={() => showTransactionForm()}><Text style={styles.addButtonText}>＋</Text></Pressable> : null}</View>
    <ScrollView style={styles.page} contentContainerStyle={styles.pageContent} keyboardShouldPersistTaps="handled">
      {screen === 'home' && <HomeScreen summary={summary} accounts={accounts} transactions={transactions} monthly={monthly} breakdown={expenseBreakdown} goals={goals} fmt={fmt} onNavigate={setScreen} onAdd={() => showTransactionForm()} onSelectTx={showTransactionForm} />}
      {screen === 'transactions' && <TransactionsScreen transactions={transactions.filter((t) => movementFilter === 'all' || t.type === movementFilter)} filter={movementFilter} setFilter={setMovementFilter} fmt={fmt} onAdd={() => showTransactionForm()} onEdit={showTransactionForm} onDelete={deleteTx} />}
      {screen === 'cashflow' && <CashflowScreen summary={summary} monthly={monthly} upcoming={awaitlessUpcoming(transactions)} fmt={fmt} />}
      {screen === 'assistant' && <AssistantScreen history={assistantHistory} question={assistantQuestion} setQuestion={setAssistantQuestion} onSend={() => sendAssistantQuestion()} onQuickAsk={sendAssistantQuestion} fmt={fmt} onClear={() => Alert.alert('Limpar conversa?', 'O histórico local do assistente será apagado.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Limpar', style: 'destructive', onPress: async () => { await clearAssistantHistory(db); await refresh(db); } }])} />}
      {screen === 'evolui' && <EvoluiScreen progress={progress} filter={educationFilter} setFilter={setEducationFilter} onOpen={setSelectedLesson} fmt={fmt} />}
      {screen === 'accounts' && <AccountsScreen accounts={accounts} fmt={fmt} onAdd={() => setModal('account')} onReports={() => setScreen('reports')} />}
      {screen === 'goals' && <GoalsScreen goals={goals} fmt={fmt} onAdd={() => setModal('goal')} onEdit={(goal: Goal) => { setGoalModalInitial(goal); setModal('goal'); }} />}
      {screen === 'reports' && <ReportsScreen summary={summary} monthly={monthly} breakdown={expenseBreakdown} fmt={fmt} onExportCsv={exportCsv} onBackup={exportData} />}
      {screen === 'cards' && <CardsScreen cards={cards} purchases={cardPurchases} selectedCard={selectedCard} onChoose={async (id: number) => { setSelectedCard(id); await refreshCardPurchases(id); }} onAddCard={() => setModal('card')} onAddPurchase={() => { if (!selectedCard) { Alert.alert('Selecione um cartão', 'Escolha um cartão para registrar uma compra.'); return; } setModal('purchase'); }} fmt={fmt} />}
      {screen === 'settings' && <SettingsScreen showValues={showValues} onToggleValues={toggleHideValues} onExport={exportData} onImport={importData} onExportCsv={exportCsv} onClearHistory={async () => { await clearAssistantHistory(db); await refresh(db); }} onClearAll={clearData} onAddCategory={() => setModal('category')} />}
    </ScrollView>
    <BottomNav screen={screen} onChange={setScreen} />

    <TransactionModal visible={modal === 'transaction'} initial={editingTransaction} accounts={accounts} categories={categories} saving={loadingAction} onClose={() => { setModal(null); setEditingTransaction(null); }} onSave={submitTransaction} />
    <AccountModal visible={modal === 'account'} onClose={() => setModal(null)} onSave={submitAccount} />
    <GoalModal visible={modal === 'goal'} initial={goalModalInitial} audience={profile.audience} onClose={() => { setModal(null); setGoalModalInitial(null); }} onSave={submitGoal} />
    <CardModal visible={modal === 'card'} onClose={() => setModal(null)} onSave={submitCard} />
    <PurchaseModal visible={modal === 'purchase'} categories={categoriesFor('expense')} onClose={() => setModal(null)} onSave={submitPurchase} />
    <CategoryModal visible={modal === 'category'} onClose={() => setModal(null)} onSave={submitCategory} />
    <LessonModal lesson={selectedLesson} completed={!!progress.find((p) => p.lesson_id === selectedLesson?.id && p.completed_at)} favorite={!!progress.find((p) => p.lesson_id === selectedLesson?.id && p.favorite)} onClose={() => setSelectedLesson(null)} onComplete={async () => { if (db && selectedLesson) { await saveLessonProgress(db, selectedLesson.id, true); await refresh(db); } }} onFavorite={async () => { if (db && selectedLesson) { const old = progress.find((p) => p.lesson_id === selectedLesson.id); await saveLessonProgress(db, selectedLesson.id, !!old?.completed_at, !old?.favorite); await refresh(db); } }} />
  </SafeAreaView>;
}


function Onboarding(props: any) {
  const audienceOptions: { key: Audience; title: string; text: string }[] = [
    { key: 'personal', title: 'Finanças pessoais', text: 'Organize gastos, orçamento e metas.' },
    { key: 'business', title: 'Meu negócio', text: 'Controle caixa, receitas e despesas.' },
    { key: 'both', title: 'Pessoal e empresarial', text: 'Mantenha as duas visões organizadas.' },
    { key: 'freelancer', title: 'Autônomo ou profissional liberal', text: 'Lide com renda variável e recebimentos.' },
  ];
  const challenges = ['Organizar gastos', 'Economizar', 'Sair das dívidas', 'Aumentar a renda', 'Melhorar o caixa do negócio', 'Aprender sobre finanças'];
  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" backgroundColor={BG} /><ScrollView contentContainerStyle={styles.onboardingPage} keyboardShouldPersistTaps="handled">
    <View style={styles.onboardingLogo}><Text style={styles.onboardingLogoText}>E↗</Text></View>
    <Text style={styles.onboardingEyebrow}>BEM-VINDO AO</Text><Text style={styles.onboardingTitle}>EvoGest</Text><Text style={styles.onboardingSubtitle}>Sua gestão evolui. Seus resultados também.</Text>
    <Card><Text style={styles.cardTitle}>Vamos conhecer você</Text><Text style={styles.bodyText}>Seus dados ficam neste celular. Não é necessário criar conta nem estar conectado à internet.</Text>
      <Field label="Como podemos chamar você? (opcional)" value={props.profileName} onChangeText={props.setProfileName} placeholder="Seu nome" />
      <Label>Como você pretende usar o EvoGest?</Label>
      {audienceOptions.map((option) => <Pressable key={option.key} onPress={() => props.setAudience(option.key)} style={[styles.choice, props.audience === option.key && styles.choiceSelected]}><View style={[styles.radio, props.audience === option.key && styles.radioSelected]} /> <View style={{ flex: 1 }}><Text style={styles.choiceTitle}>{option.title}</Text><Text style={styles.choiceText}>{option.text}</Text></View></Pressable>)}
      <Label>O que você quer melhorar primeiro?</Label>
      <View style={styles.chipWrap}>{challenges.map((item) => <Chip key={item} title={item} active={props.challenges.includes(item)} onPress={() => props.setChallenges((old: string[]) => old.includes(item) ? old.filter((x) => x !== item) : [...old, item])} />)}</View>
      <Label>Seu objetivo prioritário</Label>
      <View style={styles.chipWrap}>{['Ter controle do meu dinheiro', 'Economizar', 'Sair das dívidas', 'Construir reserva', 'Melhorar o caixa', 'Aumentar o lucro'].map((item) => <Chip key={item} title={item} active={props.goal === item} onPress={() => props.setGoal(item)} />)}</View>
    </Card>
    <Card><Text style={styles.cardTitle}>Comece com uma conta</Text><Text style={styles.bodyText}>Informe o saldo atual aproximado. Você poderá alterá-lo depois.</Text><Field label="Nome da conta" value={props.accountName} onChangeText={props.setAccountName} placeholder="Minha conta" /><Field label="Saldo inicial (R$)" value={props.balance} onChangeText={props.setBalance} placeholder="0,00" keyboardType="decimal-pad" /></Card>
    <PrimaryButton title={props.submitting ? 'Configurando...' : 'Começar a usar o EvoGest →'} disabled={props.submitting} onPress={props.onSubmit} />
    <Text style={styles.privacyNote}>Privacidade desde o primeiro acesso · Armazenamento local · Sem conta na nuvem</Text>
  </ScrollView></SafeAreaView>;
}

function HomeScreen({ summary, accounts, transactions, monthly, breakdown, goals, fmt, onNavigate, onAdd, onSelectTx }: any) {
  const hasData = transactions.length > 0 || accounts.some((a: Account) => a.opening_cents !== 0);
  const maxExpense = Math.max(1, ...breakdown.map((x: any) => x.total_cents));
  return <View>
    <View style={styles.hero}><View style={styles.heroCircle} /><Text style={styles.heroEyebrow}>SALDO ATUAL CONSOLIDADO</Text><Text style={styles.heroBalance}>{fmt(summary.balance_cents)}</Text><View style={styles.heroBottom}><Text style={styles.heroSmall}>{accounts.length} conta(s) cadastrada(s)</Text><View style={styles.heroPill}><Text style={styles.heroPillText}>● Dados locais</Text></View></View></View>
    <View style={styles.statGrid}><Stat title="Entradas do mês" value={fmt(summary.income_cents)} icon="↙" color={GREEN} /><Stat title="Saídas do mês" value={fmt(summary.expense_cents)} icon="↗" color={RED} /><Stat title="Resultado do mês" value={fmt(summary.net_cents)} icon="∑" color={summary.net_cents >= 0 ? VIOLET : RED} /><Stat title="Contas previstas" value={String(summary.pending_count)} icon="◷" color={PURPLE} /></View>
    {!hasData && <Card><EmptyState title="Seu painel começa aqui" text="Registre uma entrada ou saída para começar a visualizar sua evolução financeira." /><PrimaryButton title="＋ Registrar movimentação" onPress={onAdd} /></Card>}
    <Card><SectionHeading title="Evolução mensal" right="Ver relatório" onRight={() => onNavigate('reports')} /><Text style={styles.muted}>Entradas realizadas nos últimos 6 meses</Text><MiniBars data={monthly} valueKey="income_cents" color={VIOLET} formatter={(v) => v > 0 ? `${Math.round(v / 100)}` : ''} /></Card>
    <Card><SectionHeading title="Despesas por categoria" right="Ver movimentações" onRight={() => onNavigate('transactions')} />{breakdown.length === 0 ? <Text style={styles.muted}>Cadastre despesas realizadas para preencher este gráfico.</Text> : breakdown.slice(0, 5).map((item: any) => <View key={item.name} style={styles.categoryRow}><Text style={styles.categoryIcon}>{item.icon}</Text><View style={{ flex: 1 }}><View style={styles.rowBetween}><Text style={styles.categoryName}>{item.name}</Text><Text style={styles.categoryAmount}>{fmt(item.total_cents)}</Text></View><ProgressBar ratio={item.total_cents / maxExpense} color={VIOLET} /></View></View>)}</Card>
    <Card><SectionHeading title="Metas financeiras" right="Ver todas" onRight={() => onNavigate('goals')} />{goals.length === 0 ? <Text style={styles.muted}>Crie uma meta para acompanhar seu progresso.</Text> : goals.slice(0, 2).map((goal: Goal) => <View key={goal.id} style={styles.goalSummary}><View style={styles.rowBetween}><Text style={styles.categoryName}>{goal.name}</Text><Text style={styles.goalPercent}>{Math.min(100, Math.round(goal.saved_cents / goal.target_cents * 100))}%</Text></View><ProgressBar ratio={goal.saved_cents / goal.target_cents} /><Text style={styles.muted}>{fmt(goal.saved_cents)} de {fmt(goal.target_cents)}</Text></View>)}<PrimaryButton title="＋ Criar meta" variant="secondary" onPress={() => onNavigate('goals')} /></Card>
    <Card><SectionHeading title="Últimas movimentações" right="Ver todas" onRight={() => onNavigate('transactions')} />{transactions.length === 0 ? <Text style={styles.muted}>Suas últimas movimentações aparecerão aqui.</Text> : transactions.slice(0, 5).map((t: Transaction) => <TransactionRow key={t.id} item={t} fmt={fmt} onPress={() => onSelectTx(t)} />)}</Card>
    <Card style={styles.tipCard}><Text style={styles.tipEyebrow}>✦ EVOGEST EVOLUI</Text><Text style={styles.cardTitle}>Pequenos passos constroem bons hábitos.</Text><Text style={styles.bodyText}>Faça uma revisão das suas movimentações e escolha uma ação financeira que caiba na sua realidade.</Text><PrimaryButton title="Aprender mais" onPress={() => onNavigate('evolui')} /></Card>
    <View style={styles.quickGrid}>{[
      ['▤', 'Contas', 'accounts'], ['◎', 'Fluxo de caixa', 'cashflow'], ['◇', 'Assistente', 'assistant'], ['✦', 'Educação', 'evolui'], ['▣', 'Cartões', 'cards'], ['▥', 'Relatórios', 'reports'],
    ].map(([icon, title, target]) => <Pressable key={target} style={styles.quickTile} onPress={() => onNavigate(target)}><Text style={styles.quickIcon}>{icon}</Text><Text style={styles.quickTitle}>{title}</Text></Pressable>)}</View>
  </View>;
}
function Stat({ title, value, icon, color }: { title: string; value: string; icon: string; color: string }) {
  return <View style={styles.statCard}><View style={[styles.statIcon, { backgroundColor: `${color}16` }]}><Text style={[styles.statIconText, { color }]}>{icon}</Text></View><Text style={styles.statTitle}>{title}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>{value}</Text></View>;
}
function TransactionRow({ item, fmt, onPress, onDelete }: { item: Transaction; fmt: (v: number) => string; onPress?: () => void; onDelete?: () => void }) {
  const positive = item.type === 'income';
  return <Pressable onPress={onPress} style={styles.txRow}><View style={[styles.txIcon, { backgroundColor: item.type === 'income' ? '#E5F6EF' : item.type === 'transfer' ? PALE : '#FCE8ED' }]}><Text style={[styles.txIconText, { color: item.type === 'income' ? GREEN : item.type === 'transfer' ? PURPLE : RED }]}>{item.type === 'income' ? '↙' : item.type === 'transfer' ? '⇄' : '↗'}</Text></View><View style={styles.txMiddle}><Text style={styles.txTitle}>{item.description}</Text><Text style={styles.txSubtitle}>{item.category_name ?? typeLabel(item.type)} · {ptLongDate(item.transaction_date)}</Text><Text style={styles.txSubtitle}>{item.account_name ?? ''}{item.status !== 'done' ? ` · ${statusLabel(item.status)}` : ''}</Text></View><View style={styles.txRight}><Text style={[styles.txAmount, { color: positive ? GREEN : item.type === 'transfer' ? PURPLE : INK }]}>{positive ? '+' : item.type === 'transfer' ? '↔ ' : '−'}{fmt(item.amount_cents)}</Text>{onDelete ? <Pressable onPress={(event: any) => { event.stopPropagation(); onDelete(); }}><Text style={styles.deleteLink}>Excluir</Text></Pressable> : null}</View></Pressable>;
}
function TransactionsScreen({ transactions, filter, setFilter, fmt, onAdd, onEdit, onDelete }: any) {
  const [search, setSearch] = useState('');
  const filtered = transactions.filter((t: Transaction) => `${t.description} ${t.category_name ?? ''} ${t.account_name ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  return <View><Card><Field label="Buscar movimentação" value={search} onChangeText={setSearch} placeholder="Descrição, categoria ou conta" /><View style={styles.chipWrap}>{[['all','Todas'],['income','Entradas'],['expense','Saídas'],['transfer','Transferências']].map(([key, label]) => <Chip key={key} title={label} active={filter === key} onPress={() => setFilter(key)} />)}</View><PrimaryButton title="＋ Nova movimentação" onPress={onAdd} /></Card>
    <Card><SectionHeading title={`${filtered.length} registro(s)`} />{filtered.length === 0 ? <EmptyState title="Nenhuma movimentação encontrada" text="Cadastre uma entrada, saída ou transferência, ou mude o filtro." /> : filtered.map((t: Transaction) => <TransactionRow key={t.id} item={t} fmt={fmt} onPress={() => onEdit(t)} onDelete={() => onDelete(t)} />)}</Card>
  </View>;
}
function CashflowScreen({ summary, monthly, upcoming, fmt }: any) {
  const [view, setView] = useState<'income' | 'expense' | 'net'>('net');
  const key = view === 'income' ? 'income_cents' : view === 'expense' ? 'expense_cents' : 'net_cents';
  const max = Math.max(1, ...monthly.map((m: any) => Math.abs(m[key])));
  return <View><Card style={styles.cashflowHero}><Text style={styles.heroEyebrow}>RESULTADO REALIZADO DO MÊS</Text><Text style={styles.cashflowTotal}>{fmt(summary.net_cents)}</Text><Text style={styles.heroSmall}>Entradas menos saídas registradas como realizadas.</Text></Card>
    <Card><SectionHeading title="Movimento nos últimos seis meses" /><View style={styles.chipWrap}><Chip title="Entradas" active={view === 'income'} onPress={() => setView('income')} /><Chip title="Saídas" active={view === 'expense'} onPress={() => setView('expense')} /><Chip title="Resultado" active={view === 'net'} onPress={() => setView('net')} /></View><View style={styles.cashBars}>{monthly.map((m: MonthlyPoint) => <View key={m.month} style={styles.cashBarCol}><Text style={[styles.cashBarNumber, { color: m[key] < 0 ? RED : PURPLE }]}>{m[key] === 0 ? '—' : `${Math.round(Math.abs(m[key]) / 100)}`}</Text><View style={styles.cashBarTrack}><View style={[styles.cashBar, { height: Math.max(3, Math.round(Math.abs(m[key]) / max * 120)), backgroundColor: m[key] < 0 ? RED : view === 'expense' ? '#B19AE9' : VIOLET }]} /></View><Text style={styles.cashBarLabel}>{m.label}</Text></View>)}</View><Text style={styles.muted}>Valores históricos são calculados com as movimentações locais marcadas como realizadas. A projeção abaixo considera apenas compromissos cadastrados.</Text></Card>
    <Card><SectionHeading title="Compromissos previstos neste mês" />{summary.planned_income_cents === 0 && summary.planned_expense_cents === 0 ? <EmptyState title="Sem compromissos previstos" text="Ao cadastrar lançamentos futuros, você poderá acompanhar entradas e saídas esperadas." /> : <><View style={styles.rowBetween}><Text style={styles.bodyText}>Entradas previstas</Text><Text style={[styles.moneyText, { color: GREEN }]}>{fmt(summary.planned_income_cents)}</Text></View><View style={styles.rowBetween}><Text style={styles.bodyText}>Saídas previstas</Text><Text style={[styles.moneyText, { color: RED }]}>{fmt(summary.planned_expense_cents)}</Text></View><View style={styles.rowBetween}><Text style={styles.bodyText}>Saldo previsto líquido</Text><Text style={styles.moneyText}>{fmt(summary.planned_income_cents - summary.planned_expense_cents)}</Text></View></>}</Card>
    <Card><SectionHeading title="Próximos compromissos cadastrados" />{upcoming.length === 0 ? <Text style={styles.muted}>Nenhum compromisso previsto nos registros recentes. Cadastre vencimentos futuros para acompanhar o caixa.</Text> : upcoming.slice(0, 8).map((t: Transaction) => <View key={t.id} style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={styles.categoryName}>{t.description}</Text><Text style={styles.muted}>{ptLongDate(t.due_date ?? t.transaction_date)}</Text></View><Text style={styles.categoryAmount}>{fmt(t.amount_cents)}</Text></View>)}</Card>
  </View>;
}
function awaitlessUpcoming(transactions: Transaction[]) { return transactions.filter((t) => t.status === 'planned').sort((a, b) => String(a.due_date ?? a.transaction_date).localeCompare(String(b.due_date ?? b.transaction_date))); }

function AssistantScreen({ history, question, setQuestion, onSend, onQuickAsk, fmt, onClear }: any) {
  const quick = ['Quanto gastei este mês?', 'Qual foi meu resultado?', 'Para onde vai meu dinheiro?', 'Quais são minhas prioridades?', 'Como posso economizar?'];
  return <View><Card style={styles.assistantIntro}><View style={styles.assistantOrb}><Text style={styles.assistantOrbText}>E</Text></View><Text style={styles.cardTitle}>Seu copiloto financeiro</Text><Text style={styles.bodyText}>O Evo Assistente usa regras locais e seus registros neste aparelho. Ele não envia perguntas nem dados para uma IA na internet.</Text><View style={styles.localPill}><Text style={styles.localPillText}>● Funciona offline</Text></View></Card>
    <Card><SectionHeading title="Experimente perguntar" />{quick.map((q: string) => <Pressable key={q} onPress={() => onQuickAsk(q)} style={styles.quickQuestion}><Text style={styles.quickQuestionText}>{q}</Text><Text style={styles.quickArrow}>↗</Text></Pressable>)}</Card>
    <Card><SectionHeading title="Conversa local" right="Limpar" onRight={onClear} />{history.length === 0 ? <EmptyState title="Comece uma conversa" text="Pergunte sobre saldos, gastos, resultados e hábitos financeiros." /> : history.slice(0, 8).reverse().map((item: any) => <View key={item.id} style={styles.chatPair}><View style={styles.userBubble}><Text style={styles.userBubbleText}>{item.question}</Text></View><View style={styles.answerBubble}><Text style={styles.answerLabel}>EVO ASSISTENTE · LOCAL</Text><Text style={styles.answerText}>{item.answer}</Text></View></View>)}<Field label="Sua pergunta" value={question} onChangeText={setQuestion} placeholder="Ex.: quanto gastei com alimentação?" multiline /><PrimaryButton title="Perguntar ao assistente" onPress={onSend} /></Card>
  </View>;
}

function EvoluiScreen({ progress, filter, setFilter, onOpen }: any) {
  const completed = progress.filter((p: any) => !!p.completed_at).length;
  const favoriteIds = new Set(progress.filter((p: any) => !!p.favorite).map((p: any) => p.lesson_id));
  const categories = ['Todos', 'Organização', 'Orçamento', 'Economia', 'Dívidas', 'Investimentos', 'Pequenos negócios', 'Planejamento', 'Segurança', 'Hábitos'];
  const lessons = LESSONS.filter((lesson) => filter === 'Todos' || lesson.category === filter || (filter === 'Favoritos' && favoriteIds.has(lesson.id)));
  const tip = DAILY_TIPS[new Date().getDate() % DAILY_TIPS.length];
  return <View><View style={styles.evoluiHero}><Text style={styles.heroEyebrow}>EVOGEST EVOLUI</Text><Text style={styles.evoluiTitle}>Prosperidade começa com clareza.</Text><Text style={styles.bodyText}>Aprenda em pequenos passos e aplique o conhecimento às suas decisões.</Text><View style={styles.learningProgress}><View><Text style={styles.learningProgressBig}>{completed}/{LESSONS.length}</Text><Text style={styles.learningProgressSmall}>lições concluídas</Text></View><View style={{ flex: 1 }}><ProgressBar ratio={completed / LESSONS.length} color={VIOLET} /></View></View></View>
    <Card style={styles.tipCard}><Text style={styles.tipEyebrow}>✦ DICA DO DIA · {tip.category.toUpperCase()}</Text><Text style={styles.cardTitle}>{tip.title}</Text><Text style={styles.bodyText}>{tip.text}</Text></Card>
    <Card><SectionHeading title="Trilhas de aprendizado" /><View style={styles.chipWrap}>{categories.map((item) => <Chip key={item} title={item} active={filter === item} onPress={() => setFilter(item)} />)}<Chip title="Favoritos" active={filter === 'Favoritos'} onPress={() => setFilter('Favoritos')} /></View>{lessons.map((lesson) => { const state = progress.find((p: any) => p.lesson_id === lesson.id); return <Pressable key={lesson.id} onPress={() => onOpen(lesson)} style={styles.lessonRow}><View style={styles.lessonIcon}><Text style={styles.lessonIconText}>{state?.completed_at ? '✓' : '✦'}</Text></View><View style={{ flex: 1 }}><Text style={styles.lessonTitle}>{lesson.title}</Text><Text style={styles.txSubtitle}>{lesson.category} · {lesson.duration} · {lesson.level}</Text><Text style={styles.lessonSummary}>{lesson.summary}</Text></View><Text style={styles.quickArrow}>{state?.favorite ? '★' : '›'}</Text></Pressable>; })}</Card>
    <Card><Text style={styles.cardTitle}>Uma ideia importante</Text><Text style={styles.bodyText}>Prosperar não é uma competição nem uma promessa de enriquecer rapidamente. O objetivo é conhecer sua realidade, escolher ações viáveis e melhorar suas decisões com o tempo.</Text></Card>
  </View>;
}

function AccountsScreen({ accounts, fmt, onAdd, onReports }: any) {
  return <View><Card style={styles.accountsHero}><Text style={styles.heroEyebrow}>SALDO CONSOLIDADO</Text><Text style={styles.cashflowTotal}>{fmt(accounts.reduce((sum: number, a: Account) => sum + Number(a.balance_cents ?? a.opening_cents), 0))}</Text><Text style={styles.heroSmall}>Soma das contas ativas e das movimentações realizadas registradas.</Text></Card><Card><SectionHeading title="Contas cadastradas" right="Relatórios" onRight={onReports} />{accounts.length === 0 ? <EmptyState title="Cadastre sua primeira conta" text="O EvoGest utiliza os saldos que você informa e as movimentações realizadas." /> : accounts.map((a: Account) => <View key={a.id} style={styles.accountRow}><View style={styles.accountIcon}><Text style={styles.accountIconText}>{a.type.toLowerCase().includes('caixa') ? '▣' : '▤'}</Text></View><View style={{ flex: 1 }}><Text style={styles.categoryName}>{a.name}</Text><Text style={styles.muted}>{a.type} · Saldo inicial {fmt(a.opening_cents)}</Text></View><Text style={styles.accountBalance}>{fmt(a.balance_cents ?? a.opening_cents)}</Text></View>)}<PrimaryButton title="＋ Adicionar conta" onPress={onAdd} /></Card><Card><Text style={styles.cardTitle}>Atenção ao saldo</Text><Text style={styles.bodyText}>O EvoGest não consulta seu banco automaticamente. Para manter os saldos corretos, registre as movimentações ou ajuste o saldo inicial ao começar a usar o aplicativo.</Text></Card></View>;
}
function GoalsScreen({ goals, fmt, onAdd, onEdit }: any) {
  return <View><Card style={styles.goalHero}><Text style={styles.heroEyebrow}>SEUS PRÓXIMOS PASSOS</Text><Text style={styles.cardTitle}>Transforme intenção em plano.</Text><Text style={styles.bodyText}>Defina um objetivo, acompanhe o progresso e ajuste o ritmo conforme sua realidade.</Text><PrimaryButton title="＋ Criar meta" onPress={onAdd} /></Card>{goals.length === 0 ? <Card><EmptyState title="Nenhuma meta cadastrada" text="Comece com uma meta simples e viável para a sua situação." /></Card> : goals.map((goal: Goal) => { const ratio = Math.min(1, goal.saved_cents / goal.target_cents); return <Card key={goal.id}><View style={styles.rowBetween}><Text style={styles.cardTitle}>{goal.name}</Text><Text style={styles.goalPercent}>{Math.round(ratio * 100)}%</Text></View><ProgressBar ratio={ratio} /><View style={styles.rowBetween}><Text style={styles.muted}>Acumulado</Text><Text style={styles.moneyText}>{fmt(goal.saved_cents)}</Text></View><View style={styles.rowBetween}><Text style={styles.muted}>Meta</Text><Text style={styles.moneyText}>{fmt(goal.target_cents)}</Text></View><Text style={styles.muted}>{goal.target_date ? `Prazo: ${ptLongDate(goal.target_date)}` : 'Sem prazo definido'} · {goal.kind === 'business' ? 'Negócio' : 'Pessoal'}</Text><PrimaryButton title="Atualizar valor acumulado" variant="secondary" onPress={() => onEdit(goal)} /></Card>; })}</View>;
}
function ReportsScreen({ summary, monthly, breakdown, fmt, onExportCsv, onBackup }: any) {
  return <View><Card><Text style={styles.cardTitle}>Resumo do mês</Text><View style={styles.reportMetric}><Text style={styles.bodyText}>Entradas realizadas</Text><Text style={[styles.moneyText, { color: GREEN }]}>{fmt(summary.income_cents)}</Text></View><View style={styles.reportMetric}><Text style={styles.bodyText}>Saídas realizadas</Text><Text style={[styles.moneyText, { color: RED }]}>{fmt(summary.expense_cents)}</Text></View><View style={styles.reportMetric}><Text style={styles.bodyText}>Resultado financeiro</Text><Text style={styles.moneyText}>{fmt(summary.net_cents)}</Text></View><View style={styles.reportMetric}><Text style={styles.bodyText}>Saldo das contas</Text><Text style={styles.moneyText}>{fmt(summary.balance_cents)}</Text></View></Card>
    <Card><SectionHeading title="Resultado por mês" /><MiniBars data={monthly} valueKey="net_cents" color={PURPLE} formatter={(v) => `${Math.round(v / 100)}`} /><Text style={styles.muted}>Resultado calculado com entradas e saídas realizadas. Não representa necessariamente lucro contábil.</Text></Card>
    <Card><SectionHeading title="Categorias de despesa" />{breakdown.length === 0 ? <Text style={styles.muted}>Ainda não existem despesas realizadas suficientes.</Text> : breakdown.map((b: any) => <View key={b.name} style={styles.rowBetween}><Text style={styles.categoryName}>{b.icon} {b.name}</Text><Text style={styles.categoryAmount}>{fmt(b.total_cents)}</Text></View>)}</Card>
    <Card><SectionHeading title="Exportar dados" /><Text style={styles.bodyText}>Os arquivos são gerados localmente. O aplicativo só compartilha um arquivo se você escolher uma opção na janela do Android.</Text><PrimaryButton title="Exportar movimentações CSV" onPress={onExportCsv} /><View style={{ height: 9 }} /><PrimaryButton title="Criar backup completo (JSON)" variant="secondary" onPress={onBackup} /></Card></View>;
}
function CardsScreen({ cards, purchases, selectedCard, onChoose, onAddCard, onAddPurchase, fmt }: any) {
  const selected = cards.find((c: any) => c.id === selectedCard);
  return <View><Card><SectionHeading title="Cartões de crédito" right="＋ Adicionar" onRight={onAddCard} />{cards.length === 0 ? <EmptyState title="Cadastre seu cartão" text="Registre manualmente compras, limite e parcelas. Não há sincronização com a administradora." /> : cards.map((c: any) => <Pressable key={c.id} onPress={() => onChoose(c.id)} style={[styles.creditCardTile, selectedCard === c.id && styles.creditCardSelected]}><View style={styles.rowBetween}><Text style={[styles.creditCardName, selectedCard === c.id && { color: '#FFFFFF' }]}>{c.name}</Text><Text style={[styles.creditCardBadge, selectedCard === c.id && { color: '#E9DDFB' }]}>EvoGest</Text></View><Text style={[styles.creditCardAmount, selectedCard === c.id && { color: '#FFFFFF' }]}>{fmt(c.used_cents ?? 0)}</Text><Text style={[styles.creditCardFoot, selectedCard === c.id && { color: '#E9DDFB' }]}>em compras registradas · Limite {fmt(c.limit_cents)}</Text><Text style={[styles.creditCardFoot, selectedCard === c.id && { color: '#E9DDFB' }]}>Fecha dia {c.closing_day} · Vence dia {c.due_day}</Text></Pressable>)}</Card>
    {selected && <Card><SectionHeading title={`Compras · ${selected.name}`} right="＋ Registrar" onRight={onAddPurchase} />{purchases.length === 0 ? <Text style={styles.muted}>Nenhuma compra registrada neste cartão.</Text> : purchases.map((p: any) => <View key={p.id} style={styles.txRow}><View style={styles.txIcon}><Text style={styles.txIconText}>▣</Text></View><View style={styles.txMiddle}><Text style={styles.txTitle}>{p.description}</Text><Text style={styles.txSubtitle}>{ptLongDate(p.purchase_date)} · {p.installments} parcela(s)</Text></View><Text style={styles.txAmount}>{fmt(p.amount_cents)}</Text></View>)}</Card>}
    <Card><Text style={styles.cardTitle}>Importante</Text><Text style={styles.bodyText}>As compras registradas aqui são um controle auxiliar. Elas não são inseridas automaticamente como despesas pagas no fluxo de caixa. Use o pagamento da fatura como uma movimentação coerente e evite lançar a mesma despesa duas vezes nos seus relatórios.</Text></Card></View>;
}
function SettingsScreen({ showValues, onToggleValues, onExport, onImport, onExportCsv, onClearHistory, onClearAll, onAddCategory }: any) {
  return <View><Card><SectionHeading title="Privacidade e visualização" /><View style={styles.rowBetween}><View style={{ flex: 1 }}><Text style={styles.categoryName}>Ocultar valores financeiros</Text><Text style={styles.muted}>Esconde valores nos principais cartões e listas.</Text></View><Pressable onPress={onToggleValues} style={[styles.toggle, !showValues && styles.toggleOn]}><View style={[styles.toggleKnob, !showValues && styles.toggleKnobOn]} /></Pressable></View><View style={styles.settingsDivider} /><Text style={styles.cardTitle}>Seus dados, seu dispositivo</Text><Text style={styles.bodyText}>O EvoGest utiliza banco de dados local criptografado com SQLCipher e uma chave protegida pelo armazenamento seguro do Android nesta configuração de build. A perda do arquivo de chave ou do aparelho pode impedir a recuperação sem backup válido.</Text></Card>
    <Card><SectionHeading title="Categorias" /><Text style={styles.bodyText}>Personalize as categorias para que os relatórios reflitam sua realidade.</Text><PrimaryButton title="＋ Criar categoria personalizada" onPress={onAddCategory} /></Card>
    <Card><SectionHeading title="Backup e portabilidade" /><PrimaryButton title="Criar backup completo" onPress={onExport} /><View style={{ height: 8 }} /><PrimaryButton title="Restaurar backup de arquivo" variant="secondary" onPress={onImport} /><View style={{ height: 8 }} /><PrimaryButton title="Exportar movimentações CSV" variant="secondary" onPress={onExportCsv} /><Text style={[styles.muted, { marginTop: 10 }]}>O compartilhamento de arquivos é iniciado somente após sua ação. Se você escolher outro aplicativo para receber o arquivo, esses dados poderão sair do EvoGest.</Text></Card>
    <Card><SectionHeading title="Assistente e dados" /><PrimaryButton title="Apagar histórico do assistente" variant="secondary" onPress={onClearHistory} /><View style={{ height: 8 }} /><PrimaryButton title="Apagar todos os dados locais" variant="danger" onPress={onClearAll} /></Card>
    <Card><SectionHeading title="Sobre o EvoGest" /><Text style={styles.cardTitle}>Sua gestão evolui.</Text><Text style={styles.bodyText}>Versão inicial local · Sem conta na nuvem · Sem API remota · Sem sincronização automática.</Text><Text style={styles.muted}>O app não acessa automaticamente suas contas bancárias. Os dados financeiros são inseridos por você ou importados de arquivos escolhidos por você.</Text></Card></View>;
}

function TransactionModal({ visible, initial, accounts, categories, saving, onClose, onSave }: any) {
  const [type, setType] = useState<TransactionType>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [date, setDate] = useState(todayIso);
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<TransactionStatus>('done');
  const [notes, setNotes] = useState('');
  const [recurrence, setRecurrence] = useState<'none' | 'weekly' | 'monthly' | 'yearly'>('none');
  useEffect(() => {
    if (!visible) return;
    setType(initial?.type ?? 'expense'); setDescription(initial?.description ?? ''); setAmount(initial ? inputFromCents(initial.amount_cents) : '');
    setCategoryId(initial?.category_id ?? null); setAccountId(initial?.account_id ?? accounts[0]?.id ?? null); setToAccountId(initial?.to_account_id ?? accounts.find((a: Account) => a.id !== accounts[0]?.id)?.id ?? null);
    setDate(initial?.transaction_date ?? todayIso); setDueDate(initial?.due_date ?? ''); setStatus(initial?.status ?? 'done'); setNotes(initial?.notes ?? ''); setRecurrence(initial?.recurrence_frequency ?? 'none');
  }, [visible, initial, accounts]);
  const catList = categories.filter((c: Category) => c.kind === (type === 'income' ? 'income' : 'expense'));
  const save = () => {
    if (!description.trim()) { Alert.alert('Descrição obrigatória', 'Informe o que é esta movimentação.'); return; }
    const cents = centsFromInput(amount);
    if (cents <= 0) { Alert.alert('Valor inválido', 'Informe um valor maior que zero.'); return; }
    if (!accountId) { Alert.alert('Conta necessária', 'Cadastre uma conta antes de registrar movimentações.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { Alert.alert('Data inválida', 'Use AAAA-MM-DD, por exemplo 2026-10-10.'); return; }
    if (type !== 'transfer' && !categoryId) { Alert.alert('Categoria necessária', 'Escolha uma categoria.'); return; }
    onSave({ type, amount_cents: cents, description, category_id: type === 'transfer' ? null : categoryId, account_id: accountId, to_account_id: type === 'transfer' ? toAccountId : null, transaction_date: date, due_date: dueDate || null, status, notes, recurrence_frequency: type === 'transfer' ? 'none' : recurrence, recurrence_group: initial?.recurrence_group ?? null });
  };
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen"><SafeAreaView style={styles.modalSafe}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{initial ? 'Editar movimentação' : 'Nova movimentação'}</Text><Pressable onPress={onClose}><Text style={styles.modalClose}>✕</Text></Pressable></View><ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
    <View style={styles.chipWrap}>{[['income','Entrada'],['expense','Saída'],['transfer','Transferência']].map(([key, label]) => <Chip key={key} title={label} active={type === key} onPress={() => setType(key as TransactionType)} />)}</View>
    <Field label="Descrição" value={description} onChangeText={setDescription} placeholder={type === 'income' ? 'Ex.: salário' : type === 'transfer' ? 'Ex.: transferência entre contas' : 'Ex.: mercado'} />
    <Field label="Valor (R$)" value={amount} onChangeText={setAmount} placeholder="0,00" keyboardType="decimal-pad" />
    <Label>{type === 'transfer' ? 'Conta de origem' : 'Conta'}</Label><View style={styles.chipWrap}>{accounts.map((a: Account) => <Chip key={a.id} title={a.name} active={accountId === a.id} onPress={() => setAccountId(a.id)} />)}</View>
    {type === 'transfer' && <><Label>Conta de destino</Label><View style={styles.chipWrap}>{accounts.filter((a: Account) => a.id !== accountId).map((a: Account) => <Chip key={a.id} title={a.name} active={toAccountId === a.id} onPress={() => setToAccountId(a.id)} />)}</View></>}
    {type !== 'transfer' && <><Label>Categoria</Label><View style={styles.chipWrap}>{catList.map((c: Category) => <Chip key={c.id} title={`${c.icon} ${c.name}`} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />)}</View></>}
    <Field label="Data (AAAA-MM-DD)" value={date} onChangeText={setDate} placeholder={todayIso} />
    <Field label="Vencimento (opcional, AAAA-MM-DD)" value={dueDate} onChangeText={setDueDate} placeholder="AAAA-MM-DD" />
    <Label>Status da movimentação</Label><View style={styles.chipWrap}><Chip title="Realizada" active={status === 'done'} onPress={() => setStatus('done')} /><Chip title="Prevista" active={status === 'planned'} onPress={() => setStatus('planned')} /><Chip title="Cancelada" active={status === 'cancelled'} onPress={() => setStatus('cancelled')} /></View>
    {!initial && type !== 'transfer' ? <><Label>Repetição automática</Label><View style={styles.chipWrap}><Chip title="Não repetir" active={recurrence === 'none'} onPress={() => setRecurrence('none')} /><Chip title="Semanal" active={recurrence === 'weekly'} onPress={() => setRecurrence('weekly')} /><Chip title="Mensal" active={recurrence === 'monthly'} onPress={() => setRecurrence('monthly')} /><Chip title="Anual" active={recurrence === 'yearly'} onPress={() => setRecurrence('yearly')} /></View>{recurrence !== 'none' ? <Text style={styles.muted}>Serão criadas até 12 ocorrências futuras previstas (3 para frequência anual). A edição da ocorrência principal atualiza os compromissos futuros da série.</Text> : null}</> : initial?.recurrence_group ? <Text style={styles.muted}>Esta movimentação pertence a uma série recorrente. A edição de uma ocorrência não altera as demais, exceto quando você edita a movimentação principal da série.</Text> : null}
    <Field label="Observações (opcional)" value={notes} onChangeText={setNotes} placeholder="Detalhes adicionais" multiline />
    <PrimaryButton title={saving ? 'Salvando...' : 'Salvar movimentação'} disabled={saving} onPress={save} />
  </ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>;
}
function AccountModal({ visible, onClose, onSave }: any) {
  const [name, setName] = useState(''); const [type, setType] = useState('Conta digital'); const [balance, setBalance] = useState('0,00');
  useEffect(() => { if (visible) { setName(''); setType('Conta digital'); setBalance('0,00'); } }, [visible]);
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalShade}><View style={styles.smallModal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Adicionar conta</Text><Pressable onPress={onClose}><Text style={styles.modalClose}>✕</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled"><Field label="Nome da conta" value={name} onChangeText={setName} placeholder="Ex.: Banco principal" /><Label>Tipo</Label><View style={styles.chipWrap}>{['Conta bancária','Conta digital','Dinheiro','Caixa do negócio','Poupança','Outra'].map((x) => <Chip key={x} title={x} active={type === x} onPress={() => setType(x)} />)}</View><Field label="Saldo inicial (R$)" value={balance} onChangeText={setBalance} placeholder="0,00" keyboardType="decimal-pad" /><PrimaryButton title="Salvar conta" onPress={() => { if (!name.trim()) { Alert.alert('Nome obrigatório', 'Informe o nome da conta.'); return; } onSave({ name, type, balance }); }} /></ScrollView></View></View></Modal>;
}
function GoalModal({ visible, initial, audience, onClose, onSave }: any) {
  const [name, setName] = useState(''); const [target, setTarget] = useState(''); const [saved, setSaved] = useState('0,00'); const [date, setDate] = useState(''); const [kind, setKind] = useState<'personal' | 'business'>('personal');
  useEffect(() => { if (visible) { setName(initial?.name ?? ''); setTarget(initial ? inputFromCents(initial.target_cents) : ''); setSaved(initial ? inputFromCents(initial.saved_cents) : '0,00'); setDate(initial?.target_date ?? ''); setKind(initial?.kind ?? (audience === 'business' ? 'business' : 'personal')); } }, [visible, initial, audience]);
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalShade}><View style={styles.smallModal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{initial ? 'Atualizar progresso' : 'Nova meta'}</Text><Pressable onPress={onClose}><Text style={styles.modalClose}>✕</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled"><Field label="Nome da meta" value={name} onChangeText={setName} placeholder="Ex.: Reserva financeira" /><Field label="Valor da meta (R$)" value={target} onChangeText={setTarget} placeholder="1000,00" keyboardType="decimal-pad" /><Field label="Valor acumulado (R$)" value={saved} onChangeText={setSaved} placeholder="0,00" keyboardType="decimal-pad" /><Field label="Prazo (opcional, AAAA-MM-DD)" value={date} onChangeText={setDate} placeholder="2027-06-30" /><View style={styles.chipWrap}><Chip title="Pessoal" active={kind === 'personal'} onPress={() => setKind('personal')} /><Chip title="Negócio" active={kind === 'business'} onPress={() => setKind('business')} /></View><PrimaryButton title={initial ? 'Atualizar meta' : 'Criar meta'} onPress={() => onSave({ name, target, saved, date, kind, id: initial?.id })} /></ScrollView></View></View></Modal>;
}
function CardModal({ visible, onClose, onSave }: any) {
  const [name, setName] = useState(''); const [limit, setLimit] = useState(''); const [close, setClose] = useState('1'); const [due, setDue] = useState('10');
  useEffect(() => { if (visible) { setName(''); setLimit(''); setClose('1'); setDue('10'); } }, [visible]);
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalShade}><View style={styles.smallModal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Novo cartão</Text><Pressable onPress={onClose}><Text style={styles.modalClose}>✕</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled"><Field label="Nome" value={name} onChangeText={setName} placeholder="Cartão principal" /><Field label="Limite total (R$)" value={limit} onChangeText={setLimit} placeholder="3000,00" keyboardType="decimal-pad" /><Field label="Dia de fechamento (1–28)" value={close} onChangeText={setClose} keyboardType="number-pad" /><Field label="Dia de vencimento (1–28)" value={due} onChangeText={setDue} keyboardType="number-pad" /><PrimaryButton title="Salvar cartão" onPress={() => onSave(name, limit, close, due)} /></ScrollView></View></View></Modal>;
}
function PurchaseModal({ visible, categories, onClose, onSave }: any) {
  const [description, setDescription] = useState(''); const [amount, setAmount] = useState(''); const [categoryId, setCategoryId] = useState<number | null>(null); const [date, setDate] = useState(todayIso); const [installments, setInstallments] = useState('1'); const [notes, setNotes] = useState('');
  useEffect(() => { if (visible) { setDescription(''); setAmount(''); setCategoryId(categories[0]?.id ?? null); setDate(todayIso); setInstallments('1'); setNotes(''); } }, [visible, categories]);
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalShade}><View style={styles.smallModal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Registrar compra</Text><Pressable onPress={onClose}><Text style={styles.modalClose}>✕</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled"><Field label="Descrição" value={description} onChangeText={setDescription} placeholder="Ex.: compra de mercado" /><Field label="Valor total (R$)" value={amount} onChangeText={setAmount} placeholder="200,00" keyboardType="decimal-pad" /><Label>Categoria</Label><View style={styles.chipWrap}>{categories.map((c: Category) => <Chip key={c.id} title={c.name} active={categoryId === c.id} onPress={() => setCategoryId(c.id)} />)}</View><Field label="Data (AAAA-MM-DD)" value={date} onChangeText={setDate} /><Field label="Número de parcelas" value={installments} onChangeText={setInstallments} keyboardType="number-pad" /><Field label="Observações" value={notes} onChangeText={setNotes} multiline /><PrimaryButton title="Salvar compra" onPress={() => onSave({ description, amount, categoryId, date, installments, notes })} /></ScrollView></View></View></Modal>;
}
function CategoryModal({ visible, onClose, onSave }: any) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'income' | 'expense'>('expense');
  const [icon, setIcon] = useState('•');
  useEffect(() => { if (visible) { setName(''); setKind('expense'); setIcon('•'); } }, [visible]);
  const icons = ['•','🏠','🍽️','🚗','💼','🧾','🛍️','💰','📚','💳','📦','📣','✦'];
  return <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}><View style={styles.modalShade}><View style={styles.smallModal}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Nova categoria</Text><Pressable onPress={onClose}><Text style={styles.modalClose}>✕</Text></Pressable></View><ScrollView keyboardShouldPersistTaps="handled"><Field label="Nome da categoria" value={name} onChangeText={setName} placeholder="Ex.: Pets ou manutenção" /><Label>Tipo</Label><View style={styles.chipWrap}><Chip title="Entrada" active={kind === 'income'} onPress={() => setKind('income')} /><Chip title="Saída" active={kind === 'expense'} onPress={() => setKind('expense')} /></View><Label>Ícone</Label><View style={styles.chipWrap}>{icons.map((x) => <Chip key={x} title={x} active={icon === x} onPress={() => setIcon(x)} />)}</View><PrimaryButton title="Salvar categoria" onPress={() => { if (!name.trim()) { Alert.alert('Nome obrigatório', 'Informe o nome da categoria.'); return; } onSave(name, kind, icon); }} /></ScrollView></View></View></Modal>;
}

function LessonModal({ lesson, completed, favorite, onClose, onComplete, onFavorite }: any) {
  return <Modal visible={!!lesson} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen"><SafeAreaView style={styles.modalSafe}>{lesson && <><View style={styles.modalHeader}><Text style={styles.modalTitle}>EvoGest Evolui</Text><Pressable onPress={onClose}><Text style={styles.modalClose}>✕</Text></Pressable></View><ScrollView contentContainerStyle={styles.lessonModalContent}><Text style={styles.lessonCategory}>{lesson.category.toUpperCase()} · {lesson.duration.toUpperCase()}</Text><Text style={styles.lessonModalTitle}>{lesson.title}</Text><Text style={styles.bodyText}>{lesson.summary}</Text>{lesson.body.map((paragraph: string, i: number) => <Text key={i} style={styles.lessonParagraph}>{paragraph}</Text>)}<View style={styles.actionBox}><Text style={styles.actionEyebrow}>AÇÃO PRÁTICA</Text><Text style={styles.cardTitle}>{lesson.action}</Text></View><PrimaryButton title={completed ? '✓ Lição concluída' : 'Marcar como concluída'} onPress={onComplete} variant={completed ? 'secondary' : 'primary'} /><View style={{ height: 9 }} /><PrimaryButton title={favorite ? '★ Remover dos favoritos' : '☆ Adicionar aos favoritos'} onPress={onFavorite} variant="secondary" /><Text style={styles.muted}>Conteúdo educativo geral. As decisões financeiras devem considerar sua situação real e os riscos envolvidos.</Text></ScrollView></>}</SafeAreaView></Modal>;
}
function BottomNav({ screen, onChange }: { screen: Screen; onChange: (s: Screen) => void }) {
  const items: { key: Screen; icon: string; label: string }[] = [
    { key: 'home', icon: '⌂', label: 'Início' }, { key: 'transactions', icon: '↔', label: 'Movtos.' },
    { key: 'cashflow', icon: '▥', label: 'Fluxo' }, { key: 'assistant', icon: '✧', label: 'Assistente' }, { key: 'evolui', icon: '✦', label: 'Evolui' },
  ];
  return <View style={styles.bottomNav}>{items.map((item) => <Pressable key={item.key} onPress={() => onChange(item.key)} style={styles.navItem}><View style={[styles.navIconWrap, screen === item.key && styles.navIconActive]}><Text style={[styles.navIcon, screen === item.key && styles.navIconSelected]}>{item.icon}</Text></View><Text style={[styles.navLabel, screen === item.key && styles.navLabelActive]}>{item.label}</Text></Pressable>)}</View>;
}

async function buildLocalAnswer(db: SQLite.SQLiteDatabase, question: string, summary: Summary, fmt: (cents: number) => string): Promise<string> {
  const q = question.toLocaleLowerCase('pt-BR');
  const { start, end } = monthBounds();
  if (q.includes('gastei') || q.includes('despesa') || q.includes('saída') || q.includes('saida') || q.includes('gasto')) {
    const top = await getExpenseBreakdown(db, start, end);
    if (!summary.expense_cents) return 'Ainda não há despesas marcadas como realizadas neste mês. Registre suas saídas para que eu possa analisar os valores reais.';
    const largest = top[0];
    return `Neste mês, suas despesas realizadas somam ${fmt(summary.expense_cents)}. ${largest ? `A maior categoria registrada é ${largest.name}, com ${fmt(largest.total_cents)}.` : ''} Compare esse valor com as receitas e revise as categorias mais relevantes antes de decidir onde ajustar o orçamento.`;
  }
  if (q.includes('receita') || q.includes('ganhei') || q.includes('entrada') || q.includes('faturamento')) {
    return `Você registrou ${fmt(summary.income_cents)} em entradas realizadas neste mês. Esse valor representa as entradas cadastradas no EvoGest, não uma consulta automática ao banco. Confira se todos os recebimentos foram registrados e se as transferências estão classificadas corretamente.`;
  }
  if (q.includes('saldo') || q.includes('dinheiro disponível') || q.includes('quanto tenho')) {
    const acc = await getAccounts(db);
    const detail = acc.map((a) => `${a.name}: ${fmt(a.balance_cents ?? a.opening_cents)}`).join('\n');
    return `O saldo consolidado das contas cadastradas é ${fmt(summary.balance_cents)}.\n${detail || 'Nenhuma conta cadastrada.'}\nEsse total considera saldos iniciais e movimentações marcadas como realizadas. Não inclui automaticamente contas bancárias que você ainda não cadastrou.`;
  }
  if (q.includes('resultado') || q.includes('lucro') || q.includes('prejuízo') || q.includes('prejuizo')) {
    return `O resultado financeiro registrado neste mês é ${fmt(summary.net_cents)}: entradas realizadas (${fmt(summary.income_cents)}) menos saídas realizadas (${fmt(summary.expense_cents)}). Para um pequeno negócio, esse indicador não é necessariamente lucro contábil; custos, tributos e critérios de competência podem exigir análise adicional.`;
  }
  if (q.includes('conta') || q.includes('venc') || q.includes('receber') || q.includes('pagar')) {
    const upcoming = await getUpcoming(db, 30);
    if (!upcoming.length) return 'Não encontrei compromissos marcados como previstos nos próximos 30 dias. Isso pode significar que não há compromissos cadastrados, e não necessariamente que você não tenha contas a pagar ou receber.';
    const total = upcoming.reduce((s, t) => s + t.amount_cents, 0);
    return `Há ${upcoming.length} compromisso(s) previsto(s) nos próximos 30 dias, totalizando ${fmt(total)} em valores registrados. Confira datas e status para confirmar se os pagamentos e recebimentos estão corretos.`;
  }
  if (q.includes('categoria') || q.includes('maior gasto') || q.includes('mais gastei')) {
    const top = await getExpenseBreakdown(db, start, end);
    if (!top.length) return 'Ainda não há despesas realizadas suficientes para comparar categorias. Registre as saídas e escolha uma categoria para cada lançamento.';
    return `As maiores categorias de despesas deste mês são: ${top.slice(0, 3).map((x, i) => `${i + 1}. ${x.name}: ${fmt(x.total_cents)}`).join('; ')}. Use essa análise como ponto de partida; despesas altas podem ser essenciais e nem sempre devem ser reduzidas.`;
  }
  if (q.includes('econom') || q.includes('poupar') || q.includes('reserva')) {
    if (!summary.income_cents) return 'Para começar, registre suas entradas e despesas. Depois, podemos observar quanto sobra em um mês típico. Se sua renda estiver comprometida com necessidades essenciais, priorize compreender as obrigações e buscar alternativas viáveis antes de definir uma meta de economia.';
    const rate = Math.round(summary.net_cents / Math.max(summary.income_cents, 1) * 100);
    return `Seu resultado registrado equivale a ${rate}% das entradas deste mês. Isso é um retrato do período, não uma previsão. Uma primeira ação é revisar despesas por categoria e definir uma meta que caiba depois das necessidades essenciais e compromissos. O EvoGest não presume que todo usuário tenha sobra para poupar.`;
  }
  if (q.includes('negócio') || q.includes('empresa') || q.includes('capital de giro') || q.includes('caixa')) {
    return `No período atual, as entradas realizadas somam ${fmt(summary.income_cents)} e as saídas realizadas somam ${fmt(summary.expense_cents)}. Também há ${summary.pending_count} compromisso(s) previsto(s) no mês. Para avaliar o caixa do negócio, revise as datas de recebimentos e pagamentos, custos, tributos e possíveis atrasos. O EvoGest não consulta seus bancos nem confirma recebimentos automaticamente.`;
  }
  return 'Posso ajudar com saldos, entradas, despesas, categorias, contas previstas, resultados e hábitos financeiros. Experimente uma pergunta como “Quanto gastei este mês?” ou “Qual foi meu resultado?”. Minhas respostas usam regras locais e os dados cadastrados neste aparelho; não sou uma IA generativa remota.';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: BG, padding: 26 }, loadingText: { color: MUTED, marginTop: 14, fontSize: 14 },
  appHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10 }, brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, brandIcon: { height: 43, width: 43, borderRadius: 14, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center' }, brandIconText: { color: '#FFFFFF', fontWeight: '900', fontSize: 17 }, brandTitle: { color: INK, fontSize: 18, fontWeight: '900', letterSpacing: -0.5 }, brandSubtitle: { color: MUTED, fontSize: 11, marginTop: 1 }, headerButtons: { flexDirection: 'row', gap: 8 }, iconButton: { height: 38, width: 38, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center' }, iconButtonText: { color: PURPLE, fontSize: 20, fontWeight: '700' },
  screenHead: { paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, screenTitle: { fontSize: 24, color: INK, fontWeight: '900', letterSpacing: -0.7 }, addButton: { backgroundColor: VIOLET, height: 39, width: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, addButtonText: { fontSize: 26, color: '#FFFFFF', lineHeight: 28 }, page: { flex: 1 }, pageContent: { paddingHorizontal: 15, paddingBottom: 22, gap: 12 }, card: { backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#EFEAF5', padding: 16, shadowColor: '#291344', shadowOpacity: 0.035, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  hero: { backgroundColor: PURPLE, borderRadius: 24, padding: 22, overflow: 'hidden', position: 'relative' }, heroCircle: { position: 'absolute', width: 185, height: 185, borderRadius: 92, backgroundColor: '#FFFFFF', opacity: 0.055, right: -34, top: -75 }, heroEyebrow: { color: '#D8C8F5', fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, heroBalance: { color: '#FFFFFF', fontSize: 34, fontWeight: '900', letterSpacing: -0.8, marginTop: 8 }, heroBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15 }, heroSmall: { color: '#D5C9E8', fontSize: 12 }, heroPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 100, backgroundColor: '#FFFFFF1D' }, heroPillText: { fontSize: 10, fontWeight: '700', color: '#EFE5FF' }, statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, statCard: { width: '48%', flexGrow: 1, backgroundColor: '#FFFFFF', padding: 13, borderRadius: 18, borderWidth: 1, borderColor: '#EFEAF5', minHeight: 115 }, statIcon: { height: 29, width: 29, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, statIconText: { fontSize: 18, fontWeight: '800' }, statTitle: { color: MUTED, fontSize: 11, fontWeight: '600' }, statValue: { color: INK, fontSize: 16, fontWeight: '800', marginTop: 5 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }, sectionTitle: { color: INK, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 }, link: { color: VIOLET, fontSize: 12, fontWeight: '700' }, cardTitle: { color: INK, fontSize: 16, fontWeight: '800', marginBottom: 7 }, bodyText: { color: '#6F647A', fontSize: 13, lineHeight: 20 }, muted: { color: MUTED, fontSize: 11, lineHeight: 16 }, label: { color: '#665A75', fontSize: 12, fontWeight: '700', marginTop: 13, marginBottom: 7 }, fieldWrap: { marginBottom: 2 }, input: { backgroundColor: '#FBFAFD', borderWidth: 1, borderColor: '#E8E1F0', borderRadius: 13, paddingHorizontal: 13, paddingVertical: 11, color: INK, fontSize: 14, minHeight: 46 }, button: { backgroundColor: VIOLET, alignItems: 'center', justifyContent: 'center', borderRadius: 13, minHeight: 46, paddingHorizontal: 16, marginTop: 10 }, buttonSecondary: { backgroundColor: PALE, borderWidth: 1, borderColor: '#D9C9F6' }, buttonDanger: { backgroundColor: '#B92C49' }, buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' }, chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 5, marginBottom: 7 }, chip: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 100, borderWidth: 1, borderColor: '#E4DCEC', backgroundColor: '#FFFFFF' }, chipActive: { backgroundColor: PURPLE, borderColor: PURPLE }, chipText: { fontSize: 11, color: '#6D617A', fontWeight: '700' }, chipTextActive: { color: '#FFFFFF' },
  barsWrap: { flexDirection: 'row', gap: 8, alignItems: 'flex-end', height: 138, marginTop: 12 }, barColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' }, barValue: { fontSize: 9, color: MUTED, height: 15 }, barTrack: { height: 99, width: '65%', alignItems: 'center', justifyContent: 'flex-end', backgroundColor: '#F4F0F9', borderRadius: 8, overflow: 'hidden' }, bar: { width: '100%', borderRadius: 7, minHeight: 2 }, barLabel: { fontSize: 10, color: MUTED, marginTop: 6, textTransform: 'capitalize' }, categoryRow: { marginTop: 13 }, categoryIcon: { fontSize: 17, marginRight: 8, width: 25 }, rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, categoryName: { color: INK, fontSize: 13, fontWeight: '700' }, categoryAmount: { color: INK, fontSize: 12, fontWeight: '800' }, progressTrack: { height: 7, backgroundColor: '#F0ECF5', borderRadius: 100, overflow: 'hidden', marginTop: 6, marginBottom: 5 }, progressFill: { height: '100%', borderRadius: 100 }, goalSummary: { marginTop: 9 }, goalPercent: { color: PURPLE, fontSize: 12, fontWeight: '900' }, txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F0ECF5', gap: 9 }, txIcon: { height: 38, width: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, txIconText: { fontSize: 18, fontWeight: '800' }, txMiddle: { flex: 1 }, txTitle: { fontSize: 12, color: INK, fontWeight: '800' }, txSubtitle: { color: MUTED, fontSize: 10, marginTop: 3 }, txRight: { alignItems: 'flex-end', maxWidth: '42%' }, txAmount: { color: INK, fontSize: 11, fontWeight: '800' }, deleteLink: { color: RED, fontSize: 10, marginTop: 5, fontWeight: '700' },
  tipCard: { backgroundColor: '#F1EAFE', borderColor: '#E5D8FC' }, tipEyebrow: { fontSize: 10, color: PURPLE, fontWeight: '900', letterSpacing: 0.8, marginBottom: 8 }, quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 8 }, quickTile: { width: '31.5%', flexGrow: 1, backgroundColor: '#FFFFFF', borderRadius: 17, borderColor: LINE, borderWidth: 1, padding: 14, minHeight: 88 }, quickIcon: { color: VIOLET, fontSize: 22, marginBottom: 9 }, quickTitle: { color: INK, fontSize: 11, fontWeight: '800' }, empty: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8 }, emptyIcon: { color: VIOLET, fontSize: 26, marginBottom: 6 }, emptyTitle: { color: INK, fontSize: 14, fontWeight: '800', textAlign: 'center', marginBottom: 5 }, emptyText: { color: MUTED, fontSize: 12, textAlign: 'center', lineHeight: 18 },
  bottomNav: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#EBE5F1', paddingTop: 8, paddingBottom: Platform.OS === 'android' ? 7 : 4, minHeight: 62 }, navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 }, navIconWrap: { width: 33, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }, navIconActive: { backgroundColor: PALE }, navIcon: { fontSize: 19, color: MUTED }, navIconSelected: { color: PURPLE, fontWeight: '900' }, navLabel: { color: MUTED, fontSize: 9, fontWeight: '600' }, navLabelActive: { color: PURPLE, fontWeight: '900' },
  cashflowHero: { backgroundColor: '#2A164A' }, cashflowTotal: { color: '#FFFFFF', fontSize: 29, fontWeight: '900', marginTop: 8, marginBottom: 5 }, cashBars: { flexDirection: 'row', height: 165, alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, marginTop: 10 }, cashBarCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' }, cashBarNumber: { fontSize: 9, fontWeight: '700', height: 15 }, cashBarTrack: { height: 122, width: '70%', borderRadius: 7, backgroundColor: '#F3EFF8', overflow: 'hidden', justifyContent: 'flex-end' }, cashBar: { width: '100%', borderRadius: 7 }, cashBarLabel: { fontSize: 10, color: MUTED, marginTop: 5 }, moneyText: { fontSize: 13, fontWeight: '900', color: INK },
  assistantIntro: { backgroundColor: '#F0E8FF', borderColor: '#E1D3F8' }, assistantOrb: { height: 48, width: 48, borderRadius: 18, backgroundColor: PURPLE, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, assistantOrbText: { color: '#FFFFFF', fontSize: 27, fontWeight: '900' }, localPill: { alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 6, borderRadius: 99, backgroundColor: '#E1F5E9', marginTop: 11 }, localPillText: { color: GREEN, fontSize: 10, fontWeight: '800' }, quickQuestion: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 1, borderColor: LINE, padding: 12, marginTop: 7 }, quickQuestionText: { color: INK, fontSize: 12, fontWeight: '700', flex: 1 }, quickArrow: { color: VIOLET, fontWeight: '900', fontSize: 17 }, chatPair: { marginBottom: 13, gap: 8 }, userBubble: { alignSelf: 'flex-end', backgroundColor: PURPLE, padding: 11, borderRadius: 14, borderBottomRightRadius: 4, maxWidth: '90%' }, userBubbleText: { color: '#FFFFFF', fontSize: 12, lineHeight: 18 }, answerBubble: { alignSelf: 'stretch', backgroundColor: '#F8F5FC', borderWidth: 1, borderColor: '#EAE1F7', padding: 13, borderRadius: 14, borderTopLeftRadius: 4 }, answerLabel: { fontSize: 9, color: VIOLET, fontWeight: '900', letterSpacing: 0.8, marginBottom: 6 }, answerText: { color: '#554963', fontSize: 12, lineHeight: 19 },
  evoluiHero: { backgroundColor: '#F0E8FF', borderColor: '#E4D8FA', borderWidth: 1, borderRadius: 24, padding: 20, marginBottom: 0 }, evoluiTitle: { color: PURPLE, fontSize: 24, fontWeight: '900', letterSpacing: -0.6, marginTop: 10, marginBottom: 7 }, learningProgress: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 18 }, learningProgressBig: { color: PURPLE, fontSize: 24, fontWeight: '900' }, learningProgressSmall: { color: MUTED, fontSize: 10 }, lessonRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F0ECF5' }, lessonIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: PALE, alignItems: 'center', justifyContent: 'center' }, lessonIconText: { color: PURPLE, fontWeight: '900', fontSize: 16 }, lessonTitle: { fontSize: 12, color: INK, fontWeight: '900', marginBottom: 3 }, lessonSummary: { color: '#7C7188', fontSize: 11, lineHeight: 16, marginTop: 5 }, lessonModalContent: { padding: 20, paddingBottom: 40 }, lessonCategory: { fontSize: 10, color: VIOLET, fontWeight: '900', letterSpacing: 1, marginTop: 14 }, lessonModalTitle: { color: INK, fontSize: 29, lineHeight: 35, fontWeight: '900', marginTop: 10, marginBottom: 12 }, lessonParagraph: { color: '#5B5068', fontSize: 15, lineHeight: 24, marginTop: 19 }, actionBox: { backgroundColor: '#F0E8FF', padding: 16, borderRadius: 17, marginTop: 25, marginBottom: 10 }, actionEyebrow: { color: VIOLET, fontSize: 10, fontWeight: '900', letterSpacing: 0.8, marginBottom: 7 },
  accountsHero: { backgroundColor: '#2A164A' }, accountRow: { flexDirection: 'row', gap: 10, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F0ECF5', paddingVertical: 12 }, accountIcon: { height: 38, width: 38, borderRadius: 13, backgroundColor: PALE, alignItems: 'center', justifyContent: 'center' }, accountIconText: { color: PURPLE, fontSize: 17, fontWeight: '900' }, accountBalance: { color: INK, fontWeight: '900', fontSize: 12 }, goalHero: { backgroundColor: '#F0E8FF' }, reportMetric: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F0ECF5' }, creditCardTile: { backgroundColor: '#321357', borderRadius: 18, padding: 16, marginTop: 9 }, creditCardSelected: { backgroundColor: '#6A2FB4', borderColor: '#C6A7F7', borderWidth: 2 }, creditCardName: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' }, creditCardBadge: { color: '#CDB9EE', fontSize: 10, fontWeight: '900' }, creditCardAmount: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 23 }, creditCardFoot: { color: '#D4C4E9', fontSize: 10, marginTop: 6 },
  settingsDivider: { height: 1, backgroundColor: LINE, marginVertical: 14 }, toggle: { width: 48, height: 27, borderRadius: 20, backgroundColor: '#D9D0E4', justifyContent: 'center', padding: 3 }, toggleOn: { backgroundColor: VIOLET }, toggleKnob: { height: 21, width: 21, borderRadius: 11, backgroundColor: '#FFFFFF' }, toggleKnobOn: { alignSelf: 'flex-end' },
  onboardingPage: { padding: 18, paddingBottom: 35, gap: 13 }, onboardingLogo: { alignSelf: 'center', marginTop: 15, backgroundColor: PURPLE, width: 74, height: 74, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }, onboardingLogoText: { fontSize: 30, color: '#FFFFFF', fontWeight: '900' }, onboardingEyebrow: { color: VIOLET, fontSize: 10, fontWeight: '900', letterSpacing: 2, textAlign: 'center', marginTop: 5 }, onboardingTitle: { color: INK, fontSize: 36, fontWeight: '900', textAlign: 'center', letterSpacing: -1.3 }, onboardingSubtitle: { color: MUTED, fontSize: 13, textAlign: 'center', marginBottom: 7 }, choice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: LINE, borderRadius: 13, padding: 12, marginTop: 7, backgroundColor: '#FFFFFF' }, choiceSelected: { borderColor: VIOLET, backgroundColor: '#F8F3FF' }, radio: { borderWidth: 1.5, borderColor: '#B5A9C3', borderRadius: 20, width: 18, height: 18 }, radioSelected: { borderWidth: 5, borderColor: VIOLET }, choiceTitle: { color: INK, fontWeight: '800', fontSize: 12 }, choiceText: { color: MUTED, fontSize: 10, marginTop: 3 }, privacyNote: { color: MUTED, fontSize: 10, textAlign: 'center', lineHeight: 16, marginTop: 6 },
  modalSafe: { flex: 1, backgroundColor: BG }, modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#160B2480' }, smallModal: { backgroundColor: BG, maxHeight: '92%', borderTopLeftRadius: 25, borderTopRightRadius: 25, padding: 19, paddingBottom: 26 }, modalHeader: { paddingHorizontal: 18, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: LINE }, modalTitle: { color: INK, fontSize: 18, fontWeight: '900' }, modalClose: { color: MUTED, fontSize: 22, paddingHorizontal: 5 }, modalContent: { padding: 18, paddingBottom: 35, gap: 2 },
});
