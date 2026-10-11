import type { SQLiteDatabase } from 'expo-sqlite';

export type ReportPeriod = 'month' | '6m' | '12m' | 'year';

export type ReportMetric = {
  income_cents: number;
  expense_cents: number;
  net_cents: number;
  income_count: number;
  expense_count: number;
  transaction_count: number;
  average_income_cents: number;
  average_expense_cents: number;
};

export type ReportPoint = {
  key: string;
  label: string;
  income_cents: number;
  expense_cents: number;
  net_cents: number;
};

export type ReportSlice = {
  name: string;
  icon: string;
  total_cents: number;
  count: number;
};

export type ReportCategoryComparison = {
  name: string;
  icon: string;
  current_cents: number;
  previous_cents: number;
  count: number;
};

export type ReportTopExpense = {
  id: number;
  description: string;
  category_name: string;
  category_icon: string;
  amount_cents: number;
  transaction_date: string;
};

export type ReportAnalytics = {
  period: ReportPeriod;
  periodLabel: string;
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
  current: ReportMetric;
  previous: ReportMetric;
  monthly: ReportPoint[];
  monthlyComparison: ReportPoint[];
  daily: ReportPoint[];
  expenseCategories: ReportSlice[];
  incomeCategories: ReportSlice[];
  expenseCategoryComparison: ReportCategoryComparison[];
  topExpenses: ReportTopExpense[];
};

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonthsClamped(date: Date, amount: number): Date {
  const targetFirst = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  const lastDay = new Date(targetFirst.getFullYear(), targetFirst.getMonth() + 1, 0).getDate();
  return new Date(targetFirst.getFullYear(), targetFirst.getMonth(), Math.min(date.getDate(), lastDay));
}

function shortMonth(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
}

function periodBounds(period: ReportPeriod, today = new Date()) {
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let startDate: Date;
  let previousStartDate: Date;
  let previousEndDate: Date;
  let periodLabel = 'Este mês';

  if (period === 'month') {
    startDate = firstOfMonth(endDate);
    previousStartDate = firstOfMonth(addMonthsClamped(endDate, -1));
    previousEndDate = addMonthsClamped(endDate, -1);
    periodLabel = 'Este mês';
  } else if (period === '6m') {
    const thisMonth = firstOfMonth(endDate);
    startDate = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 5, 1);
    previousEndDate = new Date(startDate.getFullYear(), startDate.getMonth(), 0);
    const durationDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
    previousStartDate = new Date(previousEndDate.getFullYear(), previousEndDate.getMonth(), previousEndDate.getDate() - durationDays);
    periodLabel = 'Últimos 6 meses';
  } else if (period === '12m') {
    const thisMonth = firstOfMonth(endDate);
    startDate = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 11, 1);
    previousEndDate = new Date(startDate.getFullYear(), startDate.getMonth(), 0);
    const durationDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
    previousStartDate = new Date(previousEndDate.getFullYear(), previousEndDate.getMonth(), previousEndDate.getDate() - durationDays);
    periodLabel = 'Últimos 12 meses';
  } else {
    startDate = new Date(endDate.getFullYear(), 0, 1);
    previousStartDate = new Date(endDate.getFullYear() - 1, 0, 1);
    previousEndDate = new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate());
    periodLabel = 'Este ano';
  }

  return {
    start: iso(startDate), end: iso(endDate), previousStart: iso(previousStartDate), previousEnd: iso(previousEndDate), periodLabel,
    startDate, endDate,
  };
}

async function metricsBetween(db: SQLiteDatabase, start: string, end: string): Promise<ReportMetric> {
  const row = await db.getFirstAsync<any>(
    `SELECT
      COALESCE(SUM(CASE WHEN type='income' THEN amount_cents ELSE 0 END),0) AS income_cents,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount_cents ELSE 0 END),0) AS expense_cents,
      COALESCE(SUM(CASE WHEN type='income' THEN 1 ELSE 0 END),0) AS income_count,
      COALESCE(SUM(CASE WHEN type='expense' THEN 1 ELSE 0 END),0) AS expense_count,
      COUNT(*) AS transaction_count
     FROM transactions
     WHERE status='done' AND type IN ('income','expense') AND transaction_date BETWEEN ? AND ?`,
    start, end,
  );
  const income = Number(row?.income_cents ?? 0);
  const expense = Number(row?.expense_cents ?? 0);
  const incomeCount = Number(row?.income_count ?? 0);
  const expenseCount = Number(row?.expense_count ?? 0);
  return {
    income_cents: income,
    expense_cents: expense,
    net_cents: income - expense,
    income_count: incomeCount,
    expense_count: expenseCount,
    transaction_count: Number(row?.transaction_count ?? 0),
    average_income_cents: incomeCount ? Math.round(income / incomeCount) : 0,
    average_expense_cents: expenseCount ? Math.round(expense / expenseCount) : 0,
  };
}

async function groupedByMonth(db: SQLiteDatabase, start: string, end: string): Promise<Map<string, ReportPoint>> {
  const rows = await db.getAllAsync<any>(
    `SELECT substr(transaction_date,1,7) AS month_key,
      COALESCE(SUM(CASE WHEN type='income' THEN amount_cents ELSE 0 END),0) AS income_cents,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount_cents ELSE 0 END),0) AS expense_cents
     FROM transactions
     WHERE status='done' AND type IN ('income','expense') AND transaction_date BETWEEN ? AND ?
     GROUP BY substr(transaction_date,1,7) ORDER BY month_key`, start, end,
  );
  const points = new Map<string, ReportPoint>();
  rows.forEach((row: any) => {
    const monthKey = String(row.month_key);
    const income = Number(row.income_cents ?? 0);
    const expense = Number(row.expense_cents ?? 0);
    points.set(monthKey, { key: monthKey, label: shortMonth(monthKey), income_cents: income, expense_cents: expense, net_cents: income - expense });
  });
  return points;
}

async function getMonthlyPoints(db: SQLiteDatabase, start: string, end: string): Promise<ReportPoint[]> {
  const actual = await groupedByMonth(db, start, end);
  const [startYear, startMonth] = start.slice(0, 7).split('-').map(Number);
  const [endYear, endMonth] = end.slice(0, 7).split('-').map(Number);
  const points: ReportPoint[] = [];
  let year = startYear; let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    const key = `${year}-${String(month).padStart(2, '0')}`;
    points.push(actual.get(key) ?? { key, label: shortMonth(key), income_cents: 0, expense_cents: 0, net_cents: 0 });
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return points;
}

async function getDailyPoints(db: SQLiteDatabase, start: string, end: string): Promise<ReportPoint[]> {
  const rows = await db.getAllAsync<any>(
    `SELECT transaction_date AS day_key,
      COALESCE(SUM(CASE WHEN type='income' THEN amount_cents ELSE 0 END),0) AS income_cents,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount_cents ELSE 0 END),0) AS expense_cents
     FROM transactions
     WHERE status='done' AND type IN ('income','expense') AND transaction_date BETWEEN ? AND ?
     GROUP BY transaction_date ORDER BY transaction_date`, start, end,
  );
  const actual = new Map<string, { income_cents: number; expense_cents: number }>();
  rows.forEach((row: any) => actual.set(String(row.day_key), { income_cents: Number(row.income_cents ?? 0), expense_cents: Number(row.expense_cents ?? 0) }));
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const date = new Date(sy, sm - 1, sd); const last = new Date(ey, em - 1, ed);
  const points: ReportPoint[] = [];
  while (date <= last) {
    const key = iso(date); const point = actual.get(key) ?? { income_cents: 0, expense_cents: 0 };
    const income = Number(point.income_cents ?? 0); const expense = Number(point.expense_cents ?? 0);
    const day = date.getDate();
    points.push({ key, label: day === 1 || day % 5 === 0 || key === end ? String(day) : '', income_cents: income, expense_cents: expense, net_cents: income - expense });
    date.setDate(date.getDate() + 1);
  }
  return points;
}

async function categorySlices(db: SQLiteDatabase, start: string, end: string, kind: 'income' | 'expense'): Promise<ReportSlice[]> {
  return db.getAllAsync<ReportSlice>(
    `SELECT COALESCE(c.name,'Sem categoria') AS name, COALESCE(c.icon,'•') AS icon,
      COALESCE(SUM(t.amount_cents),0) AS total_cents, COUNT(*) AS count
     FROM transactions t LEFT JOIN categories c ON c.id=t.category_id
     WHERE t.status='done' AND t.type=? AND t.transaction_date BETWEEN ? AND ?
     GROUP BY COALESCE(c.name,'Sem categoria'),COALESCE(c.icon,'•')
     ORDER BY total_cents DESC`, kind, start, end,
  );
}

async function categoryComparison(db: SQLiteDatabase, start: string, end: string, previousStart: string, previousEnd: string): Promise<ReportCategoryComparison[]> {
  const [current, previous] = await Promise.all([
    categorySlices(db, start, end, 'expense'), categorySlices(db, previousStart, previousEnd, 'expense'),
  ]);
  const merged = new Map<string, ReportCategoryComparison>();
  current.forEach((item) => merged.set(item.name, { name: item.name, icon: item.icon, current_cents: item.total_cents, previous_cents: 0, count: item.count }));
  previous.forEach((item) => {
    const found = merged.get(item.name);
    if (found) { found.previous_cents = item.total_cents; }
    else merged.set(item.name, { name: item.name, icon: item.icon, current_cents: 0, previous_cents: item.total_cents, count: 0 });
  });
  return [...merged.values()].sort((a, b) => b.current_cents - a.current_cents).slice(0, 8);
}

async function topExpenses(db: SQLiteDatabase, start: string, end: string): Promise<ReportTopExpense[]> {
  return db.getAllAsync<ReportTopExpense>(
    `SELECT t.id, t.description, COALESCE(c.name,'Sem categoria') AS category_name,
      COALESCE(c.icon,'•') AS category_icon, t.amount_cents, t.transaction_date
     FROM transactions t LEFT JOIN categories c ON c.id=t.category_id
     WHERE t.status='done' AND t.type='expense' AND t.transaction_date BETWEEN ? AND ?
     ORDER BY t.amount_cents DESC, t.transaction_date DESC LIMIT 8`, start, end,
  );
}

export async function getReportAnalytics(db: SQLiteDatabase, period: ReportPeriod): Promise<ReportAnalytics> {
  const bounds = periodBounds(period);
  const [current, previous, monthly, expenseCategories, incomeCategories, expenseCategoryComparison, topExpensesResult] = await Promise.all([
    metricsBetween(db, bounds.start, bounds.end),
    metricsBetween(db, bounds.previousStart, bounds.previousEnd),
    getMonthlyPoints(db, bounds.start, bounds.end),
    categorySlices(db, bounds.start, bounds.end, 'expense'),
    categorySlices(db, bounds.start, bounds.end, 'income'),
    categoryComparison(db, bounds.start, bounds.end, bounds.previousStart, bounds.previousEnd),
    topExpenses(db, bounds.start, bounds.end),
  ]);
  const [endYear, endMonth] = bounds.end.slice(0, 7).split('-').map(Number);
  const comparisonStart = period === 'month' ? iso(new Date(endYear, endMonth - 6, 1)) : bounds.start;
  const monthlyComparison = period === 'month' ? await getMonthlyPoints(db, comparisonStart, bounds.end) : monthly;
  const daily = period === 'month' ? await getDailyPoints(db, bounds.start, bounds.end) : [];
  return {
    period, periodLabel: bounds.periodLabel, start: bounds.start, end: bounds.end,
    previousStart: bounds.previousStart, previousEnd: bounds.previousEnd,
    current, previous, monthly, monthlyComparison, daily, expenseCategories, incomeCategories, expenseCategoryComparison, topExpenses: topExpensesResult,
  };
}
