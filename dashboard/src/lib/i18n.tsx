import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'en' | 'id';

const STORAGE_KEY = 'expense_lang';

const en = {
  appTitle: 'Expense Tracker',
  signInSubtitle: 'Sign in with your WhatsApp number',
  whatsappNumber: 'WhatsApp Number',
  phonePlaceholder: 'e.g. 081234567890',
  otpHint: "We'll send a one-time code to this number via WhatsApp.",
  sendCode: 'Send Code',
  sending: 'Sending...',
  enterCode: 'Enter the 6-digit code',
  verifySignIn: 'Verify & Sign In',
  verifying: 'Verifying...',
  back: '← Back',
  codeSent: 'Code sent to {phone}. Check your WhatsApp.',
  errUnknownNumber: 'This WhatsApp number is not registered with ExpenseBot.',
  errRateLimited: 'Too many requests. Please wait a few minutes and try again.',
  errSendFailed: 'Failed to send code. Try again.',
  errInvalidCode: 'Invalid or already-used code.',
  errCodeExpired: 'Code expired. Request a new one.',
  errTooManyAttempts: 'Too many attempts. Request a new code in a few minutes.',
  errVerifyFailed: 'Verification failed.',
  loading: 'Loading...',
  overview: 'Overview',
  logout: 'Logout',
  languageLabel: 'Language',
  today: 'Today',
  thisWeek: 'This Week',
  thisMonth: 'This Month',
  thisYear: 'This Year',
  all: 'All',
  income: 'Income',
  expense: 'Expense',
  balance: 'Balance',
  txnCount: '{n} txn(s)',
  balanceDetail: 'income − expense',
  monthlyBudget: 'Monthly Budget',
  spentOf: 'Spent {spent} of {amount}',
  percentUsed: '{pct}% used',
  remaining: '{amount} remaining',
  overBudget: '{amount} over budget',
  spendingByCategory: 'Spending by Category',
  noExpenses: 'No expenses this period.',
  noExpensesHint: 'Log expenses from WhatsApp to see them here.',
  recentTransactions: 'Recent Transactions',
  clickToEdit: 'click ✎ to edit',
  noTransactions: 'No transactions this period.',
  noTransactionsHint: 'Log income or expenses from WhatsApp to get started.',
  edit: 'Edit',
  editTransaction: 'Edit Transaction',
  amount: 'Amount',
  type: 'Type',
  category: 'Category',
  description: 'Description',
  categoryPlaceholder: 'e.g. Food',
  optionalNote: 'Optional note',
  expenseBtn: '💸 Expense',
  incomeBtn: '💰 Income',
  save: 'Save',
  saving: 'Saving...',
  cancel: 'Cancel',
  deleteTransaction: 'Delete transaction?',
  deleteConfirm: '{category} · {amount} — this can’t be undone.',
  delete: 'Delete',
  errInvalidAmount: 'Please enter a valid amount.',
  errUpdateFailed: 'Failed to update transaction.',
  errDeleteFailed: 'Failed to delete transaction.',
  errNotFound: 'Transaction not found.',
  errFailedToLoad: 'Failed to load data',
  errFailedToSave: 'Failed to save changes.',
};

const id: typeof en = {
  appTitle: 'Pencatat Keuangan',
  signInSubtitle: 'Masuk dengan nomor WhatsApp Anda',
  whatsappNumber: 'Nomor WhatsApp',
  phonePlaceholder: 'cth. 081234567890',
  otpHint: 'Kami akan mengirim kode sekali pakai ke nomor ini via WhatsApp.',
  sendCode: 'Kirim Kode',
  sending: 'Mengirim...',
  enterCode: 'Masukkan kode 6 digit',
  verifySignIn: 'Verifikasi & Masuk',
  verifying: 'Memverifikasi...',
  back: '← Kembali',
  codeSent: 'Kode dikirim ke {phone}. Cek WhatsApp Anda.',
  errUnknownNumber: 'Nomor WhatsApp ini tidak terdaftar di ExpenseBot.',
  errRateLimited: 'Terlalu banyak permintaan. Tunggu beberapa menit lalu coba lagi.',
  errSendFailed: 'Gagal mengirim kode. Coba lagi.',
  errInvalidCode: 'Kode tidak valid atau sudah digunakan.',
  errCodeExpired: 'Kode kedaluwarsa. Minta kode baru.',
  errTooManyAttempts: 'Terlalu banyak percobaan. Minta kode baru dalam beberapa menit.',
  errVerifyFailed: 'Verifikasi gagal.',
  loading: 'Memuat...',
  overview: 'Ringkasan',
  logout: 'Keluar',
  languageLabel: 'Bahasa',
  today: 'Hari Ini',
  thisWeek: 'Minggu Ini',
  thisMonth: 'Bulan Ini',
  thisYear: 'Tahun Ini',
  all: 'Semua',
  income: 'Pemasukan',
  expense: 'Pengeluaran',
  balance: 'Saldo',
  txnCount: '{n} transaksi',
  balanceDetail: 'pemasukan − pengeluaran',
  monthlyBudget: 'Anggaran Bulanan',
  spentOf: 'Terpakai {spent} dari {amount}',
  percentUsed: '{pct}% terpakai',
  remaining: '{amount} tersisa',
  overBudget: '{amount} melebihi anggaran',
  spendingByCategory: 'Pengeluaran per Kategori',
  noExpenses: 'Tidak ada pengeluaran pada periode ini.',
  noExpensesHint: 'Catat pengeluaran dari WhatsApp untuk melihatnya di sini.',
  recentTransactions: 'Transaksi Terakhir',
  clickToEdit: 'klik ✎ untuk mengedit',
  noTransactions: 'Tidak ada transaksi pada periode ini.',
  noTransactionsHint: 'Catat pemasukan atau pengeluaran dari WhatsApp untuk memulai.',
  edit: 'Ubah',
  editTransaction: 'Ubah Transaksi',
  amount: 'Jumlah',
  type: 'Tipe',
  category: 'Kategori',
  description: 'Deskripsi',
  categoryPlaceholder: 'cth. Makanan',
  optionalNote: 'Catatan opsional',
  expenseBtn: '💸 Pengeluaran',
  incomeBtn: '💰 Pemasukan',
  save: 'Simpan',
  saving: 'Menyimpan...',
  cancel: 'Batal',
  deleteTransaction: 'Hapus transaksi?',
  deleteConfirm: '{category} · {amount} — tidak dapat dibatalkan.',
  delete: 'Hapus',
  errInvalidAmount: 'Masukkan jumlah yang valid.',
  errUpdateFailed: 'Gagal memperbarui transaksi.',
  errDeleteFailed: 'Gagal menghapus transaksi.',
  errNotFound: 'Transaksi tidak ditemukan.',
  errFailedToLoad: 'Gagal memuat data',
  errFailedToSave: 'Gagal menyimpan perubahan.',
};

type TranslationKey = keyof typeof en;
type Params = Record<string, string | number>;

const dictionaries: Record<Language, typeof en> = { en, id };

export function detectBrowserLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'id') return stored;
  const nav = navigator.language?.toLowerCase() ?? '';
  return nav.startsWith('id') ? 'id' : 'en';
}

export function translate(lang: Language, key: TranslationKey, params?: Params): string {
  const dict = dictionaries[lang];
  let str = dict[key] ?? en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.split(`{${k}}`).join(String(v));
    }
  }
  return str;
}

interface I18nContextValue {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: TranslationKey, params?: Params) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (k) => en[k],
});

export function I18nProvider({ initial, children }: { initial?: Language; children: ReactNode }) {
  const [lang, setLang] = useState<Language>(() => initial ?? detectBrowserLanguage());

  useEffect(() => {
    if (initial) setLang(initial);
  }, [initial]);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang: (l) => {
        setLang(l);
        localStorage.setItem(STORAGE_KEY, l);
      },
      t: (key, params) => translate(lang, key, params),
    }),
    [lang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
