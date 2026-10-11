import type { SQLiteDatabase } from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

const DB_KEY_NAME = 'evogest.sqlite.encryption-key.v1';

export type Audience = 'personal' | 'business' | 'both' | 'freelancer';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'done' | 'planned' | 'cancelled';

export type Profile = {
  id: number;
  name: string;
  audience: Audience;
  challenges: string[];
  primary_goal: string;
  created_at: string;
};

export type Account = {
  id: number;
  name: string;
  type: string;
  opening_cents: number;
  opening_date: string;
  color: string;
  active: number;
  balance_cents?: number;
};

export type Category = {
  id: number;
  name: string;
  kind: 'income' | 'expense';
  icon: string;
  is_system: number;
};

export type Transaction = {
  id: number;
  type: TransactionType;
  amount_cents: number;
  description: string;
  category_id: number | null;
  account_id: number;
  to_account_id: number | null;
  transaction_date: string;
  due_date: string | null;
  status: TransactionStatus;
  notes: string;
  recurrence_frequency?: 'none' | 'weekly' | 'monthly' | 'yearly';
  recurrence_group?: string | null;
  category_name?: string;
  category_icon?: string;
  account_name?: string;
  destination_name?: string;
};

export type Goal = {
  id: number;
  name: string;
  target_cents: number;
  saved_cents: number;
  target_date: string | null;
  priority: string;
  kind: 'personal' | 'business';
  created_at: string;
};

export type Summary = {
  income_cents: number;
  expense_cents: number;
  net_cents: number;
  balance_cents: number;
  planned_income_cents: number;
  planned_expense_cents: number;
  pending_count: number;
};

export type MonthlyPoint = {
  month: string;
  label: string;
  income_cents: number;
  expense_cents: number;
  net_cents: number;
};

export const INCOME_CATEGORIES = [
  ['Salário', '💼'], ['Freelance', '🧑‍💻'], ['Comissões', '📈'],
  ['Vendas', '🛍️'], ['Serviços', '🧾'], ['Rendimentos', '💰'], ['Outras receitas', '➕'],
] as const;

export const EXPENSE_CATEGORIES = [
  ['Moradia', '🏠'], ['Alimentação', '🍽️'], ['Transporte', '🚗'],
  ['Saúde', '🩺'], ['Educação', '📚'], ['Lazer', '🎉'], ['Assinaturas', '📱'],
  ['Compras', '🛒'], ['Impostos', '🧮'], ['Dívidas', '💳'], ['Fornecedores', '📦'],
  ['Marketing', '📣'], ['Folha de pagamento', '👥'], ['Software', '💻'], ['Outras despesas', '➖'],
] as const;

export function localDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function monthBounds(date = new Date()) {
  const start = localDate(new Date(date.getFullYear(), date.getMonth(), 1));
  const end = localDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  return { start, end };
}

export function money(cents: number | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents ?? 0) / 100);
}

export function centsFromInput(value: string): number {
  const raw = value.trim().replace(/R\$/gi, '').replace(/\s/g, '');
  if (!raw) return 0;
  let normalized = raw;
  if (raw.includes(',')) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if ((raw.match(/\./g) ?? []).length > 1 || !/\.\d{1,2}$/.test(raw) && raw.includes('.')) {
    normalized = raw.replace(/\./g, '');
  }
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number * 100);
}

export function inputFromCents(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export async function prepareDatabase(db: SQLiteDatabase): Promise<void> {
  let key = await SecureStore.getItemAsync(DB_KEY_NAME);
  if (!key) {
    key = `${Crypto.randomUUID().replace(/-/g, '')}${Crypto.randomUUID().replace(/-/g, '')}`;
    await SecureStore.setItemAsync(DB_KEY_NAME, key, {
      keychainService: DB_KEY_NAME,
    });
  }
  // expo-sqlite is configured with SQLCipher in app.json. The key must be applied before querying tables.
  await db.execAsync(`PRAGMA key = '${key.replace(/'/g, "''")}';`);
  await db.getFirstAsync('PRAGMA user_version');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await db.execAsync('PRAGMA journal_mode = WAL;');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT '',
      audience TEXT NOT NULL DEFAULT 'personal',
      challenges_json TEXT NOT NULL DEFAULT '[]',
      primary_goal TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'Conta',
      opening_cents INTEGER NOT NULL DEFAULT 0,
      opening_date TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#7C3AED',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('income','expense')),
      icon TEXT NOT NULL DEFAULT '•',
      is_system INTEGER NOT NULL DEFAULT 0,
      UNIQUE(name, kind)
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
      amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
      description TEXT NOT NULL,
      category_id INTEGER,
      account_id INTEGER NOT NULL,
      to_account_id INTEGER,
      transaction_date TEXT NOT NULL,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'done' CHECK(status IN ('done','planned','cancelled')),
      notes TEXT NOT NULL DEFAULT '',
      recurrence_frequency TEXT NOT NULL DEFAULT 'none',
      recurrence_group TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
      FOREIGN KEY(to_account_id) REFERENCES accounts(id) ON DELETE RESTRICT
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_status_type_date ON transactions(status,type,transaction_date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category_status_date ON transactions(category_id,status,transaction_date);
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_cents INTEGER NOT NULL CHECK(target_cents > 0),
      saved_cents INTEGER NOT NULL DEFAULT 0 CHECK(saved_cents >= 0),
      target_date TEXT,
      priority TEXT NOT NULL DEFAULT 'Média',
      kind TEXT NOT NULL DEFAULT 'personal' CHECK(kind IN ('personal','business')),
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS lesson_progress (
      lesson_id TEXT PRIMARY KEY,
      completed_at TEXT NOT NULL,
      favorite INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS assistant_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      limit_cents INTEGER NOT NULL DEFAULT 0,
      closing_day INTEGER NOT NULL DEFAULT 1,
      due_day INTEGER NOT NULL DEFAULT 10,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS card_purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      category_id INTEGER,
      purchase_date TEXT NOT NULL,
      installments INTEGER NOT NULL DEFAULT 1,
      notes TEXT NOT NULL DEFAULT '',
      FOREIGN KEY(card_id) REFERENCES cards(id) ON DELETE CASCADE,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_card_purchases_card_date ON card_purchases(card_id,purchase_date);
    CREATE INDEX IF NOT EXISTS idx_card_purchases_date ON card_purchases(purchase_date);
  `);

  const transactionColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(transactions)');
  if (!transactionColumns.some((column) => column.name === 'recurrence_frequency')) {
    await db.execAsync("ALTER TABLE transactions ADD COLUMN recurrence_frequency TEXT NOT NULL DEFAULT 'none'");
  }
  if (!transactionColumns.some((column) => column.name === 'recurrence_group')) {
    await db.execAsync('ALTER TABLE transactions ADD COLUMN recurrence_group TEXT');
  }

  const now = new Date().toISOString();
  for (const [name, icon] of INCOME_CATEGORIES) {
    await db.runAsync('INSERT OR IGNORE INTO categories(name,kind,icon,is_system) VALUES(?,?,?,1)', name, 'income', icon);
  }
  for (const [name, icon] of EXPENSE_CATEGORIES) {
    await db.runAsync('INSERT OR IGNORE INTO categories(name,kind,icon,is_system) VALUES(?,?,?,1)', name, 'expense', icon);
  }
  await db.runAsync('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', 'currency', 'BRL');
  await db.runAsync('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', 'dark_mode', 'false');
  await db.runAsync('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', 'privacy_hide_values', 'false');
  await db.execAsync('PRAGMA user_version = 1;');
  void now;
}

export async function getProfile(db: SQLiteDatabase): Promise<Profile | null> {
  const row = await db.getFirstAsync<any>('SELECT * FROM profile WHERE id=1');
  if (!row) return null;
  let challenges: string[] = [];
  try { challenges = JSON.parse(row.challenges_json || '[]'); } catch { challenges = []; }
  return { id: row.id, name: row.name, audience: row.audience, challenges, primary_goal: row.primary_goal, created_at: row.created_at };
}

export async function saveProfile(db: SQLiteDatabase, data: Omit<Profile, 'id' | 'created_at'>): Promise<void> {
  const existing = await db.getFirstAsync<{ created_at: string }>('SELECT created_at FROM profile WHERE id=1');
  await db.runAsync(
    `INSERT INTO profile(id,name,audience,challenges_json,primary_goal,created_at) VALUES(1,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name,audience=excluded.audience,challenges_json=excluded.challenges_json,primary_goal=excluded.primary_goal`,
    data.name.trim(), data.audience, JSON.stringify(data.challenges), data.primary_goal, existing?.created_at ?? new Date().toISOString(),
  );
}

export async function addAccount(db: SQLiteDatabase, name: string, type: string, openingCents: number, openingDate = localDate()): Promise<void> {
  await db.runAsync('INSERT INTO accounts(name,type,opening_cents,opening_date,color,active,created_at) VALUES(?,?,?,?,?,1,?)', name.trim(), type, openingCents, openingDate, '#7C3AED', new Date().toISOString());
}

export async function getAccounts(db: SQLiteDatabase): Promise<Account[]> {
  return db.getAllAsync<Account>(
    `SELECT a.*, a.opening_cents + COALESCE(SUM(CASE WHEN t.status='done' AND t.transaction_date >= a.opening_date THEN
      CASE WHEN t.type='income' AND t.account_id=a.id THEN t.amount_cents
           WHEN t.type='expense' AND t.account_id=a.id THEN -t.amount_cents
           WHEN t.type='transfer' AND t.account_id=a.id THEN -t.amount_cents
           WHEN t.type='transfer' AND t.to_account_id=a.id THEN t.amount_cents
           ELSE 0 END ELSE 0 END),0) AS balance_cents
     FROM accounts a LEFT JOIN transactions t ON (t.account_id=a.id OR t.to_account_id=a.id)
     WHERE a.active=1 GROUP BY a.id ORDER BY a.id ASC`,
  );
}

export async function addTransaction(db: SQLiteDatabase, tx: Omit<Transaction, 'id'>): Promise<void> {
  const now = new Date().toISOString();
  if (!tx.description.trim()) throw new Error('Informe uma descrição.');
  if (!Number.isSafeInteger(tx.amount_cents) || tx.amount_cents <= 0) throw new Error('Informe um valor maior que zero.');
  if (tx.type === 'transfer' && (!tx.to_account_id || tx.to_account_id === tx.account_id)) throw new Error('Selecione duas contas diferentes para a transferência.');
  if (tx.type !== 'transfer' && tx.category_id == null) throw new Error('Selecione uma categoria.');
  const frequency = tx.type === 'transfer' ? 'none' : (tx.recurrence_frequency ?? 'none');
  const recurrenceGroup = frequency === 'none' ? null : Crypto.randomUUID();
  const insertOne = async (date: string, dueDate: string | null, status: TransactionStatus, master = false) => {
    await db.runAsync(
      `INSERT INTO transactions(type,amount_cents,description,category_id,account_id,to_account_id,transaction_date,due_date,status,notes,recurrence_frequency,recurrence_group,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      tx.type, tx.amount_cents, tx.description.trim(), tx.category_id, tx.account_id, tx.to_account_id,
      date, dueDate, status, tx.notes || '', master ? frequency : 'none', recurrenceGroup, now, now,
    );
  };
  await db.withTransactionAsync(async () => {
    await insertOne(tx.transaction_date, tx.due_date || null, tx.status, frequency !== 'none');
    if (frequency !== 'none') {
      for (let step = 1; step <= (frequency === 'yearly' ? 3 : 12); step++) {
        const nextDate = nextRecurringDate(tx.transaction_date, frequency, step);
        if (tx.due_date && tx.transaction_date !== tx.due_date) {
          const dueOffset = Math.round((new Date(`${tx.due_date}T12:00:00`).getTime() - new Date(`${tx.transaction_date}T12:00:00`).getTime()) / 86400000);
          const nextDue = localDate(new Date(new Date(`${nextDate}T12:00:00`).getTime() + dueOffset * 86400000));
          await insertOne(nextDate, nextDue, 'planned');
        } else {
          await insertOne(nextDate, nextDate, 'planned');
        }
      }
    }
  });
}

function nextRecurringDate(dateText: string, frequency: 'weekly' | 'monthly' | 'yearly' | 'none', step: number): string {
  const [year, month, day] = dateText.split('-').map(Number);
  if (frequency === 'weekly') return localDate(new Date(year, month - 1, day + 7 * step));
  if (frequency === 'monthly') {
    const targetMonth = month - 1 + step;
    const yearTarget = year + Math.floor(targetMonth / 12);
    const monthTarget = targetMonth % 12;
    const lastDay = new Date(yearTarget, monthTarget + 1, 0).getDate();
    return localDate(new Date(yearTarget, monthTarget, Math.min(day, lastDay)));
  }
  if (frequency === 'yearly') {
    const yearTarget = year + step;
    const lastDay = new Date(yearTarget, month, 0).getDate();
    return localDate(new Date(yearTarget, month - 1, Math.min(day, lastDay)));
  }
  return dateText;
}

export async function updateTransaction(db: SQLiteDatabase, id: number, tx: Omit<Transaction, 'id'>): Promise<void> {
  const now = new Date().toISOString();
  if (!tx.description.trim()) throw new Error('Informe uma descrição.');
  if (!Number.isSafeInteger(tx.amount_cents) || tx.amount_cents <= 0) throw new Error('Informe um valor maior que zero.');
  if (tx.type === 'transfer' && (!tx.to_account_id || tx.to_account_id === tx.account_id)) throw new Error('Selecione duas contas diferentes para a transferência.');
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE transactions SET type=?,amount_cents=?,description=?,category_id=?,account_id=?,to_account_id=?,transaction_date=?,due_date=?,status=?,notes=?,recurrence_frequency=?,recurrence_group=?,updated_at=? WHERE id=?`,
      tx.type, tx.amount_cents, tx.description.trim(), tx.category_id, tx.account_id, tx.to_account_id,
      tx.transaction_date, tx.due_date || null, tx.status, tx.notes || '', tx.recurrence_frequency ?? 'none', tx.recurrence_group ?? null, now, id,
    );
    // Editing the recurring master also updates its remaining planned occurrences. Editing one occurrence alone does not.
    if (tx.recurrence_frequency && tx.recurrence_frequency !== 'none' && tx.recurrence_group) {
      await db.runAsync(
        `UPDATE transactions SET type=?,amount_cents=?,description=?,category_id=?,account_id=?,to_account_id=?,notes=?,updated_at=?
         WHERE recurrence_group=? AND id<>? AND status='planned'`,
        tx.type, tx.amount_cents, tx.description.trim(), tx.category_id, tx.account_id, tx.to_account_id,
        tx.notes || '', now, tx.recurrence_group, id,
      );
    }
  });
}

export async function deleteTransaction(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM transactions WHERE id=?', id);
}

export async function getTransaction(db: SQLiteDatabase, id: number): Promise<Transaction | null> {
  return (await db.getFirstAsync<Transaction>('SELECT * FROM transactions WHERE id=?', id)) ?? null;
}

export async function getTransactions(db: SQLiteDatabase, limit = 100): Promise<Transaction[]> {
  return db.getAllAsync<Transaction>(
    `SELECT t.*, c.name AS category_name, c.icon AS category_icon, a.name AS account_name, d.name AS destination_name
     FROM transactions t LEFT JOIN categories c ON c.id=t.category_id
     LEFT JOIN accounts a ON a.id=t.account_id LEFT JOIN accounts d ON d.id=t.to_account_id
     ORDER BY t.transaction_date DESC, t.id DESC LIMIT ?`, limit,
  );
}

export async function getCategories(db: SQLiteDatabase, kind?: 'income' | 'expense'): Promise<Category[]> {
  if (kind) return db.getAllAsync<Category>('SELECT * FROM categories WHERE kind=? ORDER BY is_system DESC,name', kind);
  return db.getAllAsync<Category>('SELECT * FROM categories ORDER BY kind,is_system DESC,name');
}

export async function addCategory(db: SQLiteDatabase, name: string, kind: 'income' | 'expense', icon = '•'): Promise<void> {
  await db.runAsync('INSERT INTO categories(name,kind,icon,is_system) VALUES(?,?,?,0)', name.trim(), kind, icon);
}

export async function getSummary(db: SQLiteDatabase, date = new Date()): Promise<Summary> {
  const { start, end } = monthBounds(date);
  const row = await db.getFirstAsync<any>(
    `SELECT
      COALESCE(SUM(CASE WHEN type='income' AND status='done' AND transaction_date BETWEEN ? AND ? THEN amount_cents ELSE 0 END),0) income_cents,
      COALESCE(SUM(CASE WHEN type='expense' AND status='done' AND transaction_date BETWEEN ? AND ? THEN amount_cents ELSE 0 END),0) expense_cents,
      COALESCE(SUM(CASE WHEN type='income' AND status='planned' AND COALESCE(due_date,transaction_date) BETWEEN ? AND ? THEN amount_cents ELSE 0 END),0) planned_income_cents,
      COALESCE(SUM(CASE WHEN type='expense' AND status='planned' AND COALESCE(due_date,transaction_date) BETWEEN ? AND ? THEN amount_cents ELSE 0 END),0) planned_expense_cents,
      COALESCE(SUM(CASE WHEN status='planned' AND COALESCE(due_date,transaction_date) BETWEEN ? AND ? THEN 1 ELSE 0 END),0) pending_count
     FROM transactions`, start, end, start, end, start, end, start, end, start, end,
  );
  const accounts = await getAccounts(db);
  const income = Number(row?.income_cents ?? 0);
  const expense = Number(row?.expense_cents ?? 0);
  return {
    income_cents: income, expense_cents: expense, net_cents: income - expense,
    balance_cents: accounts.reduce((sum, account) => sum + Number(account.balance_cents ?? account.opening_cents), 0),
    planned_income_cents: Number(row?.planned_income_cents ?? 0),
    planned_expense_cents: Number(row?.planned_expense_cents ?? 0), pending_count: Number(row?.pending_count ?? 0),
  };
}

export async function getExpenseBreakdown(db: SQLiteDatabase, start: string, end: string) {
  return db.getAllAsync<{ name: string; icon: string; total_cents: number }>(
    `SELECT COALESCE(c.name,'Sem categoria') name, COALESCE(c.icon,'•') icon, SUM(t.amount_cents) total_cents
     FROM transactions t LEFT JOIN categories c ON c.id=t.category_id
     WHERE t.type='expense' AND t.status='done' AND t.transaction_date BETWEEN ? AND ?
     GROUP BY c.name,c.icon ORDER BY total_cents DESC`, start, end,
  );
}

export async function getMonthlySeries(db: SQLiteDatabase, count = 6): Promise<MonthlyPoint[]> {
  const result: MonthlyPoint[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = localDate(monthDate);
    const end = localDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
    const row = await db.getFirstAsync<any>(
      `SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount_cents ELSE 0 END),0) income,
              COALESCE(SUM(CASE WHEN type='expense' THEN amount_cents ELSE 0 END),0) expense
       FROM transactions WHERE status='done' AND type IN ('income','expense') AND transaction_date BETWEEN ? AND ?`, start, end,
    );
    const income = Number(row?.income ?? 0);
    const expense = Number(row?.expense ?? 0);
    result.push({ month: start.slice(0, 7), label: monthDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), income_cents: income, expense_cents: expense, net_cents: income - expense });
  }
  return result;
}

export async function getUpcoming(db: SQLiteDatabase, days = 30) {
  const start = localDate();
  const end = localDate(new Date(Date.now() + days * 86400000));
  return db.getAllAsync<Transaction>(
    `SELECT t.*, c.name category_name, a.name account_name FROM transactions t
     LEFT JOIN categories c ON c.id=t.category_id LEFT JOIN accounts a ON a.id=t.account_id
     WHERE t.status='planned' AND COALESCE(t.due_date,t.transaction_date) BETWEEN ? AND ?
     ORDER BY COALESCE(t.due_date,t.transaction_date) LIMIT 100`, start, end,
  );
}

export async function createGoal(db: SQLiteDatabase, name: string, target: number, saved: number, due: string, kind: 'personal' | 'business' = 'personal'): Promise<void> {
  if (!name.trim()) throw new Error('Informe o nome da meta.');
  if (target <= 0) throw new Error('O valor da meta precisa ser maior que zero.');
  await db.runAsync('INSERT INTO goals(name,target_cents,saved_cents,target_date,priority,kind,created_at) VALUES(?,?,?,?,?,?,?)', name.trim(), target, Math.max(0, saved), due || null, 'Média', kind, new Date().toISOString());
}

export async function updateGoalSaved(db: SQLiteDatabase, id: number, saved: number): Promise<void> {
  await db.runAsync('UPDATE goals SET saved_cents=? WHERE id=?', Math.max(0, saved), id);
}

export async function getGoals(db: SQLiteDatabase): Promise<Goal[]> {
  return db.getAllAsync<Goal>('SELECT * FROM goals ORDER BY CASE WHEN saved_cents>=target_cents THEN 1 ELSE 0 END, target_date IS NULL, target_date');
}

export async function saveLessonProgress(db: SQLiteDatabase, lessonId: string, completed: boolean, favorite?: boolean): Promise<void> {
  const old = await db.getFirstAsync<{ favorite: number }>('SELECT favorite FROM lesson_progress WHERE lesson_id=?', lessonId);
  const f = favorite === undefined ? (old?.favorite ?? 0) : (favorite ? 1 : 0);
  if (completed) {
    await db.runAsync('INSERT INTO lesson_progress(lesson_id,completed_at,favorite) VALUES(?,?,?) ON CONFLICT(lesson_id) DO UPDATE SET completed_at=excluded.completed_at,favorite=excluded.favorite', lessonId, new Date().toISOString(), f);
  } else if (old) {
    await db.runAsync('UPDATE lesson_progress SET favorite=? WHERE lesson_id=?', f, lessonId);
  } else {
    await db.runAsync('INSERT INTO lesson_progress(lesson_id,completed_at,favorite) VALUES(?,?,?)', lessonId, '', f);
  }
}

export async function getLessonProgress(db: SQLiteDatabase) {
  return db.getAllAsync<{ lesson_id: string; completed_at: string; favorite: number }>('SELECT * FROM lesson_progress');
}

export async function saveAssistantMessage(db: SQLiteDatabase, question: string, answer: string): Promise<void> {
  await db.runAsync('INSERT INTO assistant_history(question,answer,created_at) VALUES(?,?,?)', question, answer, new Date().toISOString());
}

export async function getAssistantHistory(db: SQLiteDatabase) {
  return db.getAllAsync<{ id: number; question: string; answer: string; created_at: string }>('SELECT * FROM assistant_history ORDER BY id DESC LIMIT 30');
}

export async function clearAssistantHistory(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM assistant_history');
}

export async function getSettings(db: SQLiteDatabase): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key,value FROM settings');
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, value);
}

export async function exportBackup(db: SQLiteDatabase) {
  const tableNames = ['profile', 'accounts', 'categories', 'transactions', 'goals', 'lesson_progress', 'assistant_history', 'settings', 'cards', 'card_purchases'];
  const tables: Record<string, unknown[]> = {};
  for (const table of tableNames) tables[table] = await db.getAllAsync<any>(`SELECT * FROM ${table}`);
  return { app: 'GestVolt', format_version: 2, exported_at: new Date().toISOString(), tables };
}

export async function restoreBackup(db: SQLiteDatabase, raw: unknown): Promise<void> {
  const backup = raw as any;
  const allowed = ['profile', 'accounts', 'categories', 'transactions', 'goals', 'lesson_progress', 'assistant_history', 'settings', 'cards', 'card_purchases'];
  if (!backup || !['GestVolt', 'EvoGest'].includes(backup.app) || ![1, 2].includes(backup.format_version) || !backup.tables || allowed.some((table) => !Array.isArray(backup.tables[table]))) {
    throw new Error('O arquivo não é um backup GestVolt válido ou usa uma versão incompatível.');
  }
  for (const table of allowed) if (!Array.isArray(backup.tables[table])) throw new Error(`Dados inválidos na tabela ${table}.`);
  await db.withTransactionAsync(async () => {
    await db.execAsync('DELETE FROM card_purchases; DELETE FROM cards; DELETE FROM transactions; DELETE FROM goals; DELETE FROM lesson_progress; DELETE FROM assistant_history; DELETE FROM accounts; DELETE FROM categories; DELETE FROM profile; DELETE FROM settings;');
    const insertRows = async (table: string, columns: string[], rows: any[]) => {
      for (const row of rows ?? []) {
        if (!row) continue;
        const placeholders = columns.map(() => '?').join(',');
        const sql = `INSERT INTO ${table}(${columns.join(',')}) VALUES(${placeholders})`;
        await db.runAsync(sql, ...columns.map((column) => column === 'recurrence_frequency' ? (row[column] ?? 'none') : (row[column] ?? null)));
      }
    };
    await insertRows('categories', ['id','name','kind','icon','is_system'], backup.tables.categories ?? []);
    await insertRows('accounts', ['id','name','type','opening_cents','opening_date','color','active','created_at'], backup.tables.accounts ?? []);
    await insertRows('profile', ['id','name','audience','challenges_json','primary_goal','created_at'], backup.tables.profile ?? []);
    await insertRows('transactions', ['id','type','amount_cents','description','category_id','account_id','to_account_id','transaction_date','due_date','status','notes','recurrence_frequency','recurrence_group','created_at','updated_at'], backup.tables.transactions ?? []);
    await insertRows('goals', ['id','name','target_cents','saved_cents','target_date','priority','kind','created_at'], backup.tables.goals ?? []);
    await insertRows('lesson_progress', ['lesson_id','completed_at','favorite'], backup.tables.lesson_progress ?? []);
    await insertRows('assistant_history', ['id','question','answer','created_at'], backup.tables.assistant_history ?? []);
    await insertRows('settings', ['key','value'], backup.tables.settings ?? []);
    await insertRows('cards', ['id','name','limit_cents','closing_day','due_day','created_at'], backup.tables.cards ?? []);
    await insertRows('card_purchases', ['id','card_id','description','amount_cents','category_id','purchase_date','installments','notes'], backup.tables.card_purchases ?? []);
  });
}

export async function addCard(db: SQLiteDatabase, name: string, limitCents: number, closingDay: number, dueDay: number): Promise<void> {
  if (!name.trim()) throw new Error('Informe o nome do cartão.');
  await db.runAsync('INSERT INTO cards(name,limit_cents,closing_day,due_day,created_at) VALUES(?,?,?,?,?)', name.trim(), limitCents, closingDay, dueDay, new Date().toISOString());
}

export async function getCards(db: SQLiteDatabase) {
  return db.getAllAsync<{ id: number; name: string; limit_cents: number; closing_day: number; due_day: number }>(
    `SELECT c.*, COALESCE(SUM(p.amount_cents),0) used_cents FROM cards c LEFT JOIN card_purchases p ON p.card_id=c.id GROUP BY c.id ORDER BY c.id DESC`,
  );
}

export async function addCardPurchase(db: SQLiteDatabase, cardId: number, description: string, amountCents: number, categoryId: number | null, date: string, installments: number, notes = ''): Promise<void> {
  if (!description.trim() || amountCents <= 0 || installments < 1) throw new Error('Confira a descrição, o valor e as parcelas.');
  await db.runAsync('INSERT INTO card_purchases(card_id,description,amount_cents,category_id,purchase_date,installments,notes) VALUES(?,?,?,?,?,?,?)', cardId, description.trim(), amountCents, categoryId, date, installments, notes);
}

export async function getCardPurchases(db: SQLiteDatabase, cardId: number) {
  return db.getAllAsync<any>('SELECT p.*,c.name category_name,c.icon category_icon FROM card_purchases p LEFT JOIN categories c ON c.id=p.category_id WHERE p.card_id=? ORDER BY p.purchase_date DESC,p.id DESC', cardId);
}
