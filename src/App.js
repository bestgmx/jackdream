import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import './styles.css';
import { 
  AppBar, 
  Box, 
  Toolbar, 
  Typography, 
  Drawer, 
  List, 
  ListItem, 
  ListItemIcon, 
  ListItemText,
  IconButton,
  Container,
  Paper,
  CssBaseline,
  TextField,
  Button,
  Alert,
  Grid,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  MenuItem,
  Chip
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  SwapHoriz as SwapHorizIcon,
  AttachMoney as AttachMoneyIcon,
  ShoppingCart as ShoppingCartIcon,
  Assessment as AssessmentIcon,
  Brightness4 as Brightness4Icon,
  Brightness7 as Brightness7Icon,
  Download as DownloadIcon,
  LocalShipping as LocalShippingIcon
} from '@mui/icons-material';
import Select from 'react-select';
import { FaTachometerAlt, FaUsers, FaUserFriends, FaExchangeAlt, FaMoneyCheckAlt, FaMoneyBillWave, FaShoppingCart, FaChartBar, FaChartPie } from 'react-icons/fa';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { debounce } from 'lodash';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Utility functions
const validateInput = (value, type) => {
  switch(type) {
    case 'number':
      return !isNaN(value) && Number(value) >= 0;
    case 'orderNumber':
      return /^[A-Za-z0-9-]+$/.test(value);
    case 'description':
      return value.length <= 500;
    default:
      return true;
  }
};

const validateTransaction = (transaction) => {
  if (!transaction) return false;
  
  // Check required fields based on transaction type
  switch (transaction.type) {
    case 'receive':
    case 'pay':
      return !!(transaction.person && transaction.amount && transaction.currency);
    case 'transfer':
      return !!(transaction.from && transaction.to && transaction.amount && transaction.currency);
    case 'buy':
      return !!(transaction.orderNumber && transaction.quantity && transaction.currency);
    case 'delivery':
      return !!(
        transaction.orderNumber && 
        transaction.deliveryNumber && 
        transaction.boxCount && 
        transaction.weight
      );
    default:
      return false;
  }
};

const safeCalculate = (fn) => {
  try {
    return fn();
  } catch (error) {
    console.error('Calculation error:', error);
    return 0;
  }
};

const logError = (error, context) => {
  console.error(`Error in ${context}:`, error);
};

const logTransaction = (transaction, action) => {
  console.log(`Transaction ${action}:`, {
    type: transaction.type,
    amount: transaction.amount,
    currency: transaction.currency,
    person: transaction.person,
    date: new Date().toISOString(),
    user: transaction.user
  });
};

const handleTransaction = (transaction, action) => {
  try {
    // Log the transaction action
    console.log(`Transaction ${action}:`, transaction);
    
    // Validate transaction based on action
    switch (action) {
      case 'deleted':
        // For deletion, we only need to check if the transaction exists
        if (!transaction) {
          console.error('Cannot delete: Transaction is null or undefined');
          return false;
        }
        return true;
        
      case 'added':
      case 'updated':
        // For adding or updating, validate the transaction data
    if (!validateTransaction(transaction)) {
          console.error('Invalid transaction data');
          return false;
        }

        // Additional validation for delivery transactions
        if (transaction.type === 'delivery') {
          if (!transaction.orderNumber || !transaction.deliveryNumber || 
              !transaction.boxCount || !transaction.weight) {
            console.error('Missing required delivery fields');
            return false;
          }
        }
    return true;
        
      default:
        console.error('Unknown action:', action);
        return false;
    }
  } catch (error) {
    console.error('Error handling transaction:', error);
    return false;
  }
};

const allowedUsers = [
  { username: 'Amir', password: '2731', role: 'admin' },
  { username: 'Jack', password: '2731', role: 'user' },
];
const currencyList = [
  { code: 'usd', labelFa: 'دلار', labelZh: '美元', symbol: '$' },
  { code: 'cny', labelFa: 'یوان', labelZh: '元', symbol: '¥' },
  { code: 'irr', labelFa: 'تومان', labelZh: '图曼', symbol: 'IRR' },
];

// Utility functions for data management
const STORAGE_KEYS = {
  TRANSACTIONS: 'transactions',
  PERSONS: 'persons',
  PRODUCTS: 'products',
  SETTINGS: 'settings',
  BACKUP: 'backup'
};

const saveToLocalStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Error saving to localStorage:', error);
    return false;
  }
};

const loadFromLocalStorage = (key) => {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return null;
  }
};

const createBackup = () => {
  const backup = {
    transactions: loadFromLocalStorage(STORAGE_KEYS.TRANSACTIONS),
    persons: loadFromLocalStorage(STORAGE_KEYS.PERSONS),
    products: loadFromLocalStorage(STORAGE_KEYS.PRODUCTS),
    settings: loadFromLocalStorage(STORAGE_KEYS.SETTINGS),
    timestamp: new Date().toISOString()
  };
  return backup;
};

const exportData = () => {
  const backup = createBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_${new Date().toISOString()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const importData = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        resolve(data);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

// Auto-backup functionality
const setupAutoBackup = (data, key) => {
  const debouncedSave = debounce((data) => {
    saveToLocalStorage(key, data);
    // Create backup every 100 changes
    const backupCount = parseInt(localStorage.getItem('backupCount') || '0');
    if (backupCount % 100 === 0) {
      const backup = createBackup();
      saveToLocalStorage(STORAGE_KEYS.BACKUP, backup);
    }
    localStorage.setItem('backupCount', (backupCount + 1).toString());
  }, 1000);

  return debouncedSave;
};

// Add this utility function at the top level
const formatNumberWithCurrency = (number, currency) => {
  const formatted = Number(number).toLocaleString('en-US');
  const symbol = currencyList.find(c => c.code === currency)?.symbol || '';
  return {
    value: `${formatted} ${symbol}`,
    color: Number(number) < 0 ? 'red' : 'inherit'
  };
};

function Login({ onLogin, isAuthenticated }) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    const user = allowedUsers.find(
      (u) => u.username === username && u.password === password
    );
    if (user) {
      onLogin(username);
      navigate('/dashboard');
    } else {
      setError('نام کاربری یا رمز عبور اشتباه است');
    }
  };

  if (isAuthenticated) return <Navigate to="/dashboard" />;

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 8 }}>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h4" component="h1" align="center" gutterBottom>
            {t('login')}
          </Typography>
          <TextField
            fullWidth
            label="نام کاربری"
            variant="outlined"
            value={username}
            onChange={e => setUsername(e.target.value)}
            id="login-username"
            name="username"
            autoComplete="username"
            aria-label="نام کاربری"
          />
          <TextField
            fullWidth
            label="رمز عبور"
            type="password"
            variant="outlined"
            value={password}
            onChange={e => setPassword(e.target.value)}
            id="login-password"
            name="password"
            autoComplete="current-password"
            aria-label="رمز عبور"
          />
          <Button 
            type="submit" 
            variant="contained" 
            color="primary" 
            size="large"
            fullWidth
          >
            {t('login')}
          </Button>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </Paper>
    </Container>
  );
}

function Dashboard({ persons, transactions, search, ThemeContext }) {
  const defaultThemeContext = { theme: 'light', setTheme: () => {} };
  const ctx = React.useContext(ThemeContext || React.createContext(defaultThemeContext));
  const theme = ctx.theme || 'light';
  const setTheme = ctx.setTheme || (() => {});
  
  // محاسبه مانده حساب هر شخص به تفکیک ارز
  const balances = {};
  persons.forEach(person => {
    balances[person] = { usd: 0, cny: 0, irr: 0 };
  });

  // محاسبه مانده حساب با در نظر گرفتن تمام تراکنش‌ها
  transactions.forEach(tr => {
    if (!tr) return;

    // دریافت وجه
    if (tr.type === 'receive' && tr.person) {
      if (!balances[tr.person]) balances[tr.person] = { usd: 0, cny: 0, irr: 0 };
      balances[tr.person][tr.currency] += Number(tr.amount);
    }
    // پرداخت وجه
    else if (tr.type === 'pay' && tr.person) {
      if (!balances[tr.person]) balances[tr.person] = { usd: 0, cny: 0, irr: 0 };
      balances[tr.person][tr.currency] -= Number(tr.amount);
    }
    // خرید کالا
    else if (tr.type === 'buy' && tr.person) {
      if (!balances[tr.person]) balances[tr.person] = { usd: 0, cny: 0, irr: 0 };
      balances[tr.person][tr.currency] -= Number(tr.amount);
    }
    // انتقال وجه
    else if (tr.type === 'transfer') {
      if (tr.from && tr.to) {
        // کسر از فرستنده
        if (!balances[tr.from]) balances[tr.from] = { usd: 0, cny: 0, irr: 0 };
        balances[tr.from][tr.currency] -= Number(tr.amount);
        
        // اضافه به گیرنده
        if (!balances[tr.to]) balances[tr.to] = { usd: 0, cny: 0, irr: 0 };
        balances[tr.to][tr.currency] += Number(tr.amount);
      }
    }
  });

  const formatNumber = n => n.toLocaleString('en-US');
  const filteredPersons = search ? persons.filter(p => p.includes(search)) : persons;

  // Chart data
  const personNames = filteredPersons;
  const usdData = personNames.map(p => balances[p]?.usd || 0);
  const cnyData = personNames.map(p => balances[p]?.cny || 0);
  const irrData = personNames.map(p => balances[p]?.irr || 0);

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'مانده حساب اشخاص'
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  const barData = {
    labels: personNames,
    datasets: [
      {
        label: 'دلار',
        data: usdData,
        backgroundColor: 'rgba(25, 118, 210, 0.8)',
        borderColor: 'rgba(25, 118, 210, 1)',
        borderWidth: 1
      },
      {
        label: 'یوان',
        data: cnyData,
        backgroundColor: 'rgba(66, 165, 245, 0.8)',
        borderColor: 'rgba(66, 165, 245, 1)',
        borderWidth: 1
      },
      {
        label: 'تومان',
        data: irrData,
        backgroundColor: 'rgba(144, 202, 249, 0.8)',
        borderColor: 'rgba(144, 202, 249, 1)',
        borderWidth: 1
      }
    ]
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'توزیع ارزها'
      }
    }
  };

  const pieData = {
    labels: ['دلار', 'یوان', 'تومان'],
    datasets: [{
      data: [
        usdData.reduce((a,b) => a+b, 0),
        cnyData.reduce((a,b) => a+b, 0),
        irrData.reduce((a,b) => a+b, 0)
      ],
      backgroundColor: [
        'rgba(25, 118, 210, 0.8)',
        'rgba(66, 165, 245, 0.8)',
        'rgba(144, 202, 249, 0.8)'
      ],
      borderColor: [
        'rgba(25, 118, 210, 1)',
        'rgba(66, 165, 245, 1)',
        'rgba(144, 202, 249, 1)'
      ],
      borderWidth: 1
    }]
  };

  // Calculate average USD rate
  const calculateAverageUsdRate = () => {
    let totalUsdAmount = 0;
    let totalIrrAmount = 0;
    
    transactions.forEach(tr => {
      if (!tr) return;
      
      // Only consider transactions with both USD and IRR amounts
      if (tr.type === 'receive' && tr.currency === 'usd' && tr.rate) {
        totalUsdAmount += Number(tr.amount);
        totalIrrAmount += Number(tr.amount) * Number(tr.rate);
      }
    });

    if (totalUsdAmount === 0) return '0.00';
    const averageRate = totalIrrAmount / totalUsdAmount;
    return averageRate.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
  };

  return (
    <Box>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>تعداد اشخاص</Typography>
            <Typography variant="h4">{persons.length}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>تعداد تراکنش</Typography>
            <Typography variant="h4">{transactions.length}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>مجموع دلار</Typography>
            <Typography variant="h4" color={usdData.reduce((a,b)=>a+b,0) < 0 ? 'error' : 'inherit'}>
              {formatNumberWithCurrency(usdData.reduce((a,b)=>a+b,0), 'usd').value}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>مجموع یوان</Typography>
            <Typography variant="h4" color={cnyData.reduce((a,b)=>a+b,0) < 0 ? 'error' : 'inherit'}>
              {formatNumberWithCurrency(cnyData.reduce((a,b)=>a+b,0), 'cny').value}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>مجموع تومان</Typography>
            <Typography variant="h4" color={irrData.reduce((a,b)=>a+b,0) < 0 ? 'error' : 'inherit'}>
              {formatNumberWithCurrency(irrData.reduce((a,b)=>a+b,0), 'irr').value}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Paper elevation={3} sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>میانگین قیمت دلار</Typography>
            <Typography variant="h4">{calculateAverageUsdRate()}</Typography>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 2, height: 400 }}>
            <Bar data={barData} options={barOptions} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper elevation={3} sx={{ p: 2, height: 400 }}>
            <Pie data={pieData} options={pieOptions} />
          </Paper>
        </Grid>
      </Grid>

      <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>مانده حساب اشخاص</Typography>
      <TableContainer component={Paper} elevation={3}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>شخص</TableCell>
              <TableCell align="right">دلار</TableCell>
              <TableCell align="right">یوان</TableCell>
              <TableCell align="right">تومان</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPersons.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <Typography color="textSecondary">شخصی ثبت نشده است</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredPersons.map(person => (
                <TableRow key={person}>
                  <TableCell>{person}</TableCell>
                  <TableCell align="right">
                    <Typography color={balances[person].usd < 0 ? 'error' : 'inherit'}>
                      {formatNumberWithCurrency(balances[person].usd, 'usd').value}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography color={balances[person].cny < 0 ? 'error' : 'inherit'}>
                      {formatNumberWithCurrency(balances[person].cny, 'cny').value}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography color={balances[person].irr < 0 ? 'error' : 'inherit'}>
                      {formatNumberWithCurrency(balances[person].irr, 'irr').value}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

function Users() {
  const { t } = useTranslation();
  return (
    <div style={{ background: '#fff', color: '#222', borderRadius: 8, padding: 24, minWidth: 300 }}>
      <h2 style={{ color: '#282c34' }}>{t('users')}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ padding: 8, border: '1px solid #ccc' }}>نام کاربری</th>
            <th style={{ padding: 8, border: '1px solid #ccc' }}>نقش</th>
          </tr>
        </thead>
        <tbody>
          {allowedUsers.map((user) => (
            <tr key={user.username}>
              <td style={{ padding: 8, border: '1px solid #ccc' }}>{user.username}</td>
              <td style={{ padding: 8, border: '1px solid #ccc' }}>{user.role === 'admin' ? 'ادمین' : 'کاربر'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Persons({ persons, setPersons, transactions }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const handleDelete = (person) => {
    if (transactions.some(tr => tr.person === person)) {
      setError('امکان حذف شخص دارای تراکنش وجود ندارد');
      return;
    }
    setPersons(persons.filter(p => p !== person));
    setError('');
  };
  return (
    <div className="card">
      <h2>اشخاص</h2>
      <form
        onSubmit={e => {
          e.preventDefault();
          if (!name.trim()) {
            setError('نام شخص را وارد کنید');
            return;
          }
          if (persons.includes(name.trim())) {
            setError('این شخص قبلاً اضافه شده است');
            return;
          }
          setPersons([...persons, name.trim()]);
          setName('');
          setError('');
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <div>
          <label htmlFor="add-person-name">نام شخص</label>
        <input
          type="text"
          placeholder="نام شخص"
          value={name}
          onChange={e => setName(e.target.value)}
            style={{ padding: 8, fontSize: 16, borderRadius: 6, border: '1px solid #bbb', width: '100%' }}
          id="add-person-name"
          name="personName"
            autoComplete="off"
            aria-label="نام شخص"
        />
        </div>
        <button type="submit" className="btn-main">افزودن</button>
      {error && <div className="error-msg">{error}</div>}
      </form>
      <ul style={{ padding: 0, listStyle: 'none', marginTop: 16 }}>
        {persons.map((p, idx) => (
          <li key={idx} style={{ padding: 4, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{p}</span>
            <button 
              className="btn-delete" 
              onClick={() => handleDelete(p)}
              aria-label={`حذف ${p}`}
            >
              حذف
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// تابع کمکی برای تبدیل اعداد فارسی به انگلیسی
function toEnglishDigits(str) {
  if (!str) return '';
  const faDigits = '۰۱۲۳۴۵۶۷۸۹';
  return str.replace(/[۰-۹]/g, d => faDigits.indexOf(d)).replace(/[^\d]/g, '');
}

function Receive({ persons, transactions, setTransactions, user }) {
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('usd');
  const [rate, setRate] = useState('');
  const [sum, setSum] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // فرمت اعداد با ویرگول انگلیسی
  const formatNumber = n => n ? Number(n).toLocaleString('en-US') : '';
  // هندل ورودی عدد فقط انگلیسی و با ویرگول انگلیسی
  const handleAmountChange = e => {
    let val = toEnglishDigits(e.target.value);
    if (val) val = Number(val).toLocaleString('en-US');
    setAmount(val);
  };
  const handleRateChange = e => {
    let val = toEnglishDigits(e.target.value);
    if (val) val = Number(val).toLocaleString('en-US');
    setRate(val);
  };
  // محاسبه جمع
  useEffect(() => {
    if ((currency === 'usd' || currency === 'cny') && amount && rate) {
      const a = Number(toEnglishDigits(amount));
      const r = Number(toEnglishDigits(rate));
      setSum(formatNumber(a * r));
    } else {
      setSum('');
    }
  }, [amount, rate, currency]);
  const validate = () => {
    if (!person) return 'لطفاً شخص را انتخاب کنید';
    if (!amount) return 'مبلغ را وارد کنید';
    if (isNaN(Number(toEnglishDigits(amount))) || Number(toEnglishDigits(amount)) <= 0) return 'مبلغ باید عدد مثبت باشد';
    if ((currency === 'usd' || currency === 'cny') && (!rate || isNaN(Number(toEnglishDigits(rate))) || Number(toEnglishDigits(rate)) <= 0)) return 'ریت معتبر وارد کنید';
    return '';
  };
  const handleSubmit = (e) => {
          e.preventDefault();
          const err = validate();
          if (err) {
            setError(err);
            setSuccess('');
            return;
          }

    const newTransaction = {
      type: 'receive',
      user,
      person,
      amount: Number(toEnglishDigits(amount)),
      currency,
      rate: (currency === 'usd' || currency === 'cny') ? Number(toEnglishDigits(rate)) : undefined,
      sum: sum ? Number(toEnglishDigits(sum)) : undefined,
      date: new Date().toISOString()
    };

    if (!validateTransaction(newTransaction)) {
      setError('Invalid transaction data');
      return;
    }

    if (handleTransaction(newTransaction, 'added')) {
      setTransactions([...transactions, newTransaction]);
          setPerson('');
          setAmount('');
          setCurrency('usd');
          setRate('');
          setSum('');
          setError('');
          setSuccess('دریافت وجه با موفقیت ثبت شد');
    }
  };
  return (
    <div className="card">
      <h2>دریافت وجه</h2>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <div>
          <label htmlFor="receive-person">شخص</label>
          <select 
            id="receive-person" 
            name="person"
            value={person} 
            onChange={e => setPerson(e.target.value)} 
            style={{ padding: 8, fontSize: 16, borderRadius: 6, border: '1px solid #bbb', width: '100%' }}
            aria-label="انتخاب شخص"
          >
          <option value="">انتخاب شخص</option>
          {persons.map((p, idx) => (
            <option key={idx} value={p}>{p}</option>
          ))}
        </select>
        </div>

        <div>
          <label htmlFor="receive-currency">ارز</label>
          <select 
            id="receive-currency" 
            name="currency"
            value={currency} 
            onChange={e => setCurrency(e.target.value)} 
            style={{ padding: 8, fontSize: 16, borderRadius: 6, border: '1px solid #bbb', width: '100%' }}
            aria-label="انتخاب ارز"
          >
          {currencyList.map(c => (
            <option key={c.code} value={c.code}>{c.labelFa}</option>
          ))}
        </select>
        </div>

        <div>
          <label htmlFor="receive-amount">مبلغ</label>
        <input
            id="receive-amount"
            name="amount"
          type="text"
          placeholder="مبلغ"
          value={amount}
          onChange={handleAmountChange}
            style={{ padding: 8, fontSize: 16, borderRadius: 6, border: '1px solid #bbb', width: '100%' }}
          inputMode="numeric"
          autoComplete="off"
            aria-label="مبلغ"
        />
        </div>

        {(currency === 'usd' || currency === 'cny') && (
          <div>
            <label htmlFor="receive-rate">ریت</label>
          <input
              id="receive-rate"
              name="rate"
            type="text"
            placeholder="ریت"
            value={rate}
            onChange={handleRateChange}
              style={{ padding: 8, fontSize: 16, borderRadius: 6, border: '1px solid #bbb', width: '100%' }}
            inputMode="numeric"
            autoComplete="off"
              aria-label="ریت"
          />
          </div>
        )}

        {(currency === 'usd' || currency === 'cny') && (
          <div>
            <label htmlFor="receive-sum">جمع</label>
          <input
              id="receive-sum"
              name="sum"
            type="text"
            placeholder="جمع"
            value={sum}
            readOnly
              style={{ padding: 8, fontSize: 16, borderRadius: 6, border: '1px solid #bbb', background: '#f5f5f5', width: '100%' }}
              aria-label="جمع"
          />
          </div>
        )}

        <button type="submit" className="btn-main">ثبت دریافت</button>
        {error && <div className="error-msg">{error}</div>}
        {success && <div className="success-msg">{success}</div>}
      </form>
    </div>
  );
}
function Pay({ persons, transactions, setTransactions, user }) {
  const [sender, setSender] = useState('');
  const [receiver, setReceiver] = useState('');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState('');
  const [cnyAmount, setCnyAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState(null);
  const { t } = useTranslation();

  // Calculate sender's USD balance
  const calculateSenderBalance = (person) => {
    let balance = 0;
    transactions.forEach(tr => {
      if (!tr) return;
      if (tr.type === 'receive' && tr.person === person && tr.currency === 'usd') {
        balance += Number(tr.amount);
      } else if (tr.type === 'pay' && tr.person === person && tr.currency === 'usd') {
        balance -= Number(tr.amount);
      } else if (tr.type === 'buy' && tr.person === person && tr.currency === 'usd') {
        balance -= Number(tr.quantity);
      } else if (tr.type === 'transfer') {
        if (tr.from === person && tr.currency === 'usd') {
          balance -= Number(tr.amount);
        } else if (tr.to === person && tr.currency === 'usd') {
          balance += Number(tr.amount);
        }
      }
    });
    return balance;
  };

  // Calculate CNY amount when USD amount or rate changes
  useEffect(() => {
    if (amount && rate) {
      // Remove commas and convert to number
      const usdAmount = Number(amount.replace(/,/g, ''));
      const rateValue = Number(rate.replace(/,/g, ''));
      if (!isNaN(usdAmount) && !isNaN(rateValue)) {
        const calculatedAmount = usdAmount * rateValue;
        // Format with 2 decimal places for CNY amount
        setCnyAmount(calculatedAmount.toLocaleString('en-US', { 
          minimumFractionDigits: 2, 
          maximumFractionDigits: 2 
        }));
      }
    } else {
      setCnyAmount('');
    }
  }, [amount, rate]);

  const validate = () => {
    if (!sender) return t('selectSender');
    if (!receiver) return t('selectReceiver');
    if (sender === receiver) return t('samePersonError');
    if (!amount) return t('enterAmount');
    
    // Remove commas and validate amount
    const usdAmount = Number(amount.replace(/,/g, ''));
    if (isNaN(usdAmount) || usdAmount <= 0) return t('invalidAmount');
    
    if (!rate) return t('enterRate');
    
    // Remove commas and validate rate
    const rateValue = Number(rate.replace(/,/g, ''));
    if (isNaN(rateValue) || rateValue <= 0) return t('invalidRate');
    
    // Check sender's USD balance
    const senderBalance = calculateSenderBalance(sender);
    if (senderBalance < usdAmount) {
      // Instead of returning error, prepare transaction for confirmation
      const newTransactions = [
        {
          type: 'pay',
          user,
          person: sender,
          amount: usdAmount,
          currency: 'usd',
          date: new Date().toISOString()
        },
        {
          type: 'receive',
          user,
          person: receiver,
          amount: usdAmount * rateValue,
          currency: 'cny',
          rate: rateValue,
          date: new Date().toISOString()
        }
      ];
      setPendingTransaction(newTransactions);
      setShowConfirmDialog(true);
      return 'CONFIRM_NEGATIVE_BALANCE';
    }
    
    return '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const err = validate();
    if (err === 'CONFIRM_NEGATIVE_BALANCE') {
      return; // Wait for confirmation
    }
    if (err) {
      setError(err);
      setSuccess('');
      return;
    }

    const usdAmount = Number(amount.replace(/,/g, ''));
    const cnyAmountValue = Number(cnyAmount.replace(/,/g, ''));
    const rateValue = Number(rate.replace(/,/g, ''));

    const newTransactions = [
      {
        type: 'pay',
        user,
        person: sender,
        amount: usdAmount,
        currency: 'usd',
        date: new Date().toISOString()
      },
      {
        type: 'receive',
        user,
        person: receiver,
        amount: cnyAmountValue,
        currency: 'cny',
        rate: rateValue,
        date: new Date().toISOString()
      }
    ];

    if (newTransactions.every(tr => validateTransaction(tr))) {
      if (newTransactions.every(tr => handleTransaction(tr, 'added'))) {
        setTransactions([...transactions, ...newTransactions]);
        setSender('');
        setReceiver('');
        setAmount('');
        setRate('');
        setCnyAmount('');
        setError('');
        setSuccess(t('convertSuccess'));
      }
    } else {
      setError('Invalid transaction data');
    }
  };

  const handleConfirmNegativeBalance = () => {
    if (pendingTransaction) {
      if (pendingTransaction.every(tr => validateTransaction(tr))) {
        if (pendingTransaction.every(tr => handleTransaction(tr, 'added'))) {
          setTransactions([...transactions, ...pendingTransaction]);
          setSender('');
          setReceiver('');
          setAmount('');
          setRate('');
          setCnyAmount('');
          setError('');
          setSuccess(t('convertSuccess'));
        }
      } else {
        setError('Invalid transaction data');
      }
    }
    setShowConfirmDialog(false);
    setPendingTransaction(null);
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>{t('usdToCny')}</Typography>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            select
            fullWidth
            label={t('sender')}
            value={sender}
            onChange={e => setSender(e.target.value)}
            id="pay-sender"
            name="sender"
          >
            <MenuItem value="">
              <em>{t('selectSender')}</em>
            </MenuItem>
            {persons.map((p) => (
              <MenuItem key={p} value={p}>{p}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            fullWidth
            label={t('receiver')}
            value={receiver}
            onChange={e => setReceiver(e.target.value)}
            id="pay-receiver"
            name="receiver"
          >
            <MenuItem value="">
              <em>{t('selectReceiver')}</em>
            </MenuItem>
            {persons.map((p) => (
              <MenuItem key={p} value={p}>{p}</MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            label={t('amount')}
            type="number"
          value={amount}
            onChange={e => setAmount(e.target.value)}
            inputProps={{ min: 0 }}
            id="pay-amount"
            name="amount"
          />

          <TextField
            fullWidth
            label={t('conversionRate')}
            type="number"
            value={rate}
            onChange={e => setRate(e.target.value)}
            inputProps={{ min: 0, step: 0.01 }}
            id="pay-rate"
            name="rate"
          />

          <TextField
            fullWidth
            label={t('cnyAmount')}
            type="number"
            value={cnyAmount}
            InputProps={{ readOnly: true }}
            id="pay-cny-amount"
            name="cnyAmount"
          />

          {sender && (
            <Typography variant="body2" color="textSecondary">
              موجودی فعلی: {formatNumberWithCurrency(calculateSenderBalance(sender), 'usd').value}
            </Typography>
          )}

          <Button 
            type="submit" 
            variant="contained" 
            color="primary" 
            size="large"
            fullWidth
          >
            {t('convert')}
          </Button>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {success}
            </Alert>
          )}
        </Box>
      </Paper>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <Box sx={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          bgcolor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <Paper sx={{ p: 3, maxWidth: 400, width: '100%' }}>
            <Typography variant="h6" gutterBottom>
              تایید موجودی منفی
            </Typography>
            <Typography sx={{ mb: 2 }}>
              موجودی کافی نیست. موجودی فعلی: {formatNumberWithCurrency(calculateSenderBalance(sender), 'usd').value} دلار
              <br />
              آیا می‌خواهید با موجودی منفی ادامه دهید؟
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button 
                variant="outlined" 
                onClick={() => {
                  setShowConfirmDialog(false);
                  setPendingTransaction(null);
                }}
              >
                انصراف
              </Button>
              <Button 
                variant="contained" 
                color="error"
                onClick={handleConfirmNegativeBalance}
              >
                تایید
              </Button>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
function Buy({ persons, products, setProducts, transactions, setTransactions, user }) {
  const [orderNumber, setOrderNumber] = useState('');
  const [orderError, setOrderError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [orderStatus, setOrderStatus] = useState('active');
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [editCategory, setEditCategory] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const { t } = useTranslation();

  // Calculate JACK's CNY balance
  const calculateJackBalance = () => {
    let balance = 0;
    transactions.forEach(tr => {
      if (!tr) return;
      if (tr.type === 'receive' && tr.person === 'JACK' && tr.currency === 'cny') {
        balance += Number(tr.amount);
      } else if (tr.type === 'pay' && tr.person === 'JACK' && tr.currency === 'cny') {
        balance -= Number(tr.amount);
      } else if (tr.type === 'buy' && tr.person === 'JACK' && tr.currency === 'cny') {
        balance -= Number(tr.amount);
      } else if (tr.type === 'transfer') {
        if (tr.from === 'JACK' && tr.currency === 'cny') {
          balance -= Number(tr.amount);
        } else if (tr.to === 'JACK' && tr.currency === 'cny') {
          balance += Number(tr.amount);
        }
      }
    });
    return balance;
  };

  // Export order data to Excel
  const exportOrderData = () => {
    if (!selectedOrder) return;

    const orderDetails = getOrderDetails(selectedOrder);
    const data = orderDetails.transactions.map(tr => ({
      [t('date')]: new Date(tr.date).toLocaleString(),
      [t('amount')]: tr.amount.toLocaleString('en-US'),
      [t('category')]: categories.find(c => c.value === tr.category)?.label || tr.category,
      [t('description')]: tr.description || '',
      [t('status')]: tr.status || 'active'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, selectedOrder);
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `${selectedOrder}.xlsx`);
  };

  // Categories for transactions
  const [categories, setCategories] = useState([
    { value: 'material', label: 'مواد اولیه' },
    { value: 'shipping', label: 'حمل و نقل' },
    { value: 'packaging', label: 'بسته‌بندی' },
    { value: 'other', label: 'سایر' }
  ]);

  // Get all order numbers for JACK
  const getOrderNumbers = () => {
    const orders = new Set();
    transactions.forEach(tr => {
      if (tr.type === 'buy' && tr.person === 'JACK') {
        orders.add(tr.orderNumber);
      }
    });
    return Array.from(orders).sort((a, b) => b.localeCompare(a)); // Sort in descending order
  };

  // Get order details including all transactions
  const getOrderDetails = (orderNumber) => {
    const orderTransactions = transactions.filter(tr => 
      tr.type === 'buy' && 
      tr.orderNumber === orderNumber && 
      tr.person === 'JACK'
    );

    const totalAmount = orderTransactions.reduce((sum, tr) => sum + Number(tr.amount), 0);
    const lastTransaction = orderTransactions[orderTransactions.length - 1];
    const orderDate = lastTransaction ? new Date(lastTransaction.date).toLocaleString() : '';

    return {
      transactions: orderTransactions,
      totalAmount,
      orderDate,
      status: lastTransaction?.status || 'active'
    };
  };

  // Add new order
  const handleAddOrder = (e) => {
    e.preventDefault();
    if (!orderNumber.trim()) {
      setOrderError(t('enterOrderNumber'));
      return;
    }
    if (getOrderNumbers().includes(orderNumber.trim())) {
      setOrderError(t('orderExists'));
      return;
    }
    setSelectedOrder(orderNumber.trim());
    setOrderNumber('');
    setOrderError('');
    setSuccess(t('orderAdded'));
  };

  // Handle order selection change
  const handleOrderSelect = (e) => {
    setSelectedOrder(e.target.value);
    setOrderNumber(''); // Clear the order number input when selecting an existing order
    setOrderError('');
  };

  // Add input validation helper
  const validateInput = (value, type) => {
    switch(type) {
      case 'number':
        return !isNaN(value) && Number(value) >= 0;
      case 'orderNumber':
        return /^[A-Za-z0-9-]+$/.test(value);
      case 'description':
        return value.length <= 500;
      default:
        return true;
    }
  };

  // Add transaction validation
  const validateTransaction = (transaction) => {
    if (!transaction) return false;
    if (!transaction.type || !['receive', 'pay', 'buy', 'transfer'].includes(transaction.type)) return false;
    if (!transaction.amount || !validateInput(transaction.amount, 'number')) return false;
    if (!transaction.currency || !['usd', 'cny', 'irr'].includes(transaction.currency)) return false;
    return true;
  };

  // Add error handling for calculations
  const safeCalculate = (fn) => {
    try {
      return fn();
    } catch (error) {
      console.error('Calculation error:', error);
      return 0;
    }
  };

  // Update handleAddTransaction in Buy component
  const handleAddTransaction = (e) => {
    e.preventDefault();
    if (!selectedOrder) {
      setError(t('selectOrder'));
      setSuccess('');
      return;
    }
    if (!validateInput(amount, 'number')) {
      setError(t('invalidAmount'));
      setSuccess('');
      return;
    }

    const newTransaction = {
        type: 'buy',
        user,
      person: 'JACK',
      amount: Number(amount),
      currency: 'cny',
      orderNumber: selectedOrder,
      description: description.slice(0, 500), // Limit description length
      category,
      status: orderStatus,
        date: new Date().toISOString(),
    };

    if (!validateTransaction(newTransaction)) {
      setError(t('invalidTransaction'));
      return;
    }

    setTransactions([...transactions, newTransaction]);
    setAmount('');
    setDescription('');
    setCategory('');
    setError('');
    setSuccess(t('itemAdded'));
  };

  // Category Management Functions
  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    if (categories.some(c => c.value === newCategory.trim())) {
      setError(t('categoryExists'));
      return;
    }
    setCategories([...categories, { value: newCategory.trim(), label: newCategory.trim() }]);
    setNewCategory('');
    setSuccess(t('categoryAdded'));
  };

  const handleEditCategory = () => {
    if (!editCategory || !editCategory.value || !editCategory.label) return;
    setCategories(categories.map(c => 
      c.value === editCategory.value ? editCategory : c
    ));
    setEditCategory(null);
    setSuccess(t('categoryUpdated'));
  };

  const handleDeleteCategory = (categoryValue) => {
    setCategories(categories.filter(c => c.value !== categoryValue));
    setSuccess(t('categoryDeleted'));
  };

  // Transaction Management Functions
  const handleEditTransaction = (transaction) => {
    setEditingTransaction(transaction);
  };

  const handleUpdateTransaction = () => {
    if (!editingTransaction) return;
    
    const updatedTransactions = transactions.map(tr => 
      tr === editingTransaction ? {
        ...tr,
        amount: Number(editingTransaction.amount),
        description: editingTransaction.description,
        category: editingTransaction.category,
        status: editingTransaction.status
      } : tr
    );

    setTransactions(updatedTransactions);
    setEditingTransaction(null);
    setSuccess(t('transactionUpdated'));
  };

  const handleDeleteTransaction = (transaction) => {
    setTransactionToDelete(transaction);
    setShowDeleteModal(true);
  };

  const confirmDeleteTransaction = () => {
    if (!transactionToDelete) return;
    
    setTransactions(transactions.filter(tr => tr !== transactionToDelete));
    setTransactionToDelete(null);
    setShowDeleteModal(false);
    setSuccess(t('transactionDeleted'));
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>خرید کالا - JACK</Typography>
      
      {/* Balance Display */}
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6">
          {t('balance')}: {formatNumberWithCurrency(calculateJackBalance(), 'cny').value}
        </Typography>
      </Paper>

      {/* Category Management */}
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">{t('manageCategories')}</Typography>
          <Button 
            variant="contained" 
            onClick={() => setShowCategoryModal(true)}
          >
            {t('addCategory')}
          </Button>
        </Box>
        
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {categories.map(cat => (
            <Chip
              key={cat.value}
              label={cat.label}
              onDelete={() => handleDeleteCategory(cat.value)}
              onClick={() => setEditCategory(cat)}
              sx={{ m: 0.5 }}
            />
          ))}
        </Box>
      </Paper>

      {/* Category Modal */}
      {showCategoryModal && (
        <Box sx={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          bgcolor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <Paper sx={{ p: 3, maxWidth: 400, width: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {editCategory ? t('editCategory') : t('addCategory')}
            </Typography>
            <TextField
              fullWidth
              label={t('categoryName')}
              value={editCategory ? editCategory.label : newCategory}
              onChange={e => editCategory ? 
                setEditCategory({...editCategory, label: e.target.value}) : 
                setNewCategory(e.target.value)
              }
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button 
                variant="outlined" 
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditCategory(null);
                  setNewCategory('');
                }}
              >
                {t('cancel')}
              </Button>
              <Button 
                variant="contained" 
                onClick={editCategory ? handleEditCategory : handleAddCategory}
              >
                {editCategory ? t('update') : t('add')}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Order Management */}
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>{t('orderManagement')}</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Box component="form" onSubmit={handleAddOrder}>
              <TextField
                fullWidth
                label={t('orderNumber')}
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                error={!!orderError}
                helperText={orderError}
                sx={{ mb: 2 }}
                id="buy-order-number"
                name="orderNumber"
              />
              <Button 
                type="submit" 
                variant="contained" 
                color="primary"
                fullWidth
              >
                {t('addOrder')}
              </Button>
            </Box>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              select
              fullWidth
              label={t('selectOrder')}
              value={selectedOrder}
              onChange={handleOrderSelect}
              sx={{ mb: 2 }}
              id="buy-select-order"
              name="selectedOrder"
            >
              <MenuItem value="">
                <em>{t('selectOrder')}</em>
              </MenuItem>
              {getOrderNumbers().map(order => (
                <MenuItem key={order} value={order}>{order}</MenuItem>
              ))}
            </TextField>
            {selectedOrder && (
              <Box>
                <Typography variant="body2" color="textSecondary">
                  {t('totalAmount')}: {formatNumberWithCurrency(getOrderDetails(selectedOrder).totalAmount, 'cny').value}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {t('orderDate')}: {getOrderDetails(selectedOrder).orderDate}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  {t('status')}: {getOrderDetails(selectedOrder).status}
                </Typography>
              </Box>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Transaction Form - Only show when an order is selected */}
      {selectedOrder && (
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t('addTransaction')} - {selectedOrder}
          </Typography>
          <Box component="form" onSubmit={handleAddTransaction} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              select
              fullWidth
              label={t('category')}
              value={category}
              onChange={e => setCategory(e.target.value)}
              id="buy-category"
              name="category"
            >
              <MenuItem value="">
                <em>{t('selectCategory')}</em>
              </MenuItem>
              {categories.map(cat => (
                <MenuItem key={cat.value} value={cat.value}>{cat.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              label={t('amount')}
          type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              inputProps={{ min: 0 }}
              id="buy-amount"
              name="amount"
            />

            <TextField
              fullWidth
              label={t('description')}
              value={description}
              onChange={e => setDescription(e.target.value)}
              multiline
              rows={2}
              id="buy-description"
              name="description"
            />

            <Button 
              type="submit" 
              variant="contained" 
              color="primary" 
              size="large"
              fullWidth
            >
              {t('addItem')}
            </Button>

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" sx={{ mt: 2 }}>
                {success}
              </Alert>
            )}
          </Box>
        </Paper>
      )}

      {/* Order History - Only show when an order is selected */}
      {selectedOrder && (
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            {t('orderHistory')} - {selectedOrder}
          </Typography>
          
          {/* Date Range Filter */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <TextField
              type="date"
              label={t('startDate')}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              type="date"
              label={t('endDate')}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button 
              variant="outlined" 
              onClick={exportOrderData}
              startIcon={<DownloadIcon />}
            >
              {t('export')}
            </Button>
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('date')}</TableCell>
                  <TableCell>{t('amount')}</TableCell>
                  <TableCell>{t('category')}</TableCell>
                  <TableCell>{t('description')}</TableCell>
                  <TableCell>{t('status')}</TableCell>
                  <TableCell>{t('actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {getOrderDetails(selectedOrder).transactions.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{new Date(item.date).toLocaleString()}</TableCell>
                    <TableCell>
                      {editingTransaction === item ? (
                        <TextField
                          type="number"
                          value={editingTransaction.amount}
                          onChange={e => setEditingTransaction({
                            ...editingTransaction,
                            amount: e.target.value
                          })}
                          size="small"
                        />
                      ) : (
                        formatNumberWithCurrency(item.amount, 'cny').value
                      )}
                    </TableCell>
                    <TableCell>
                      {editingTransaction === item ? (
                        <TextField
                          select
                          value={editingTransaction.category}
                          onChange={e => setEditingTransaction({
                            ...editingTransaction,
                            category: e.target.value
                          })}
                          size="small"
                        >
                          {categories.map(cat => (
                            <MenuItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </MenuItem>
                          ))}
                        </TextField>
                      ) : (
                        categories.find(c => c.value === item.category)?.label || item.category
                      )}
                    </TableCell>
                    <TableCell>
                      {editingTransaction === item ? (
                        <TextField
                          value={editingTransaction.description}
                          onChange={e => setEditingTransaction({
                            ...editingTransaction,
                            description: e.target.value
                          })}
                          size="small"
                        />
                      ) : (
                        item.description
                      )}
                    </TableCell>
                    <TableCell>
                      {editingTransaction === item ? (
                        <TextField
                          select
                          value={editingTransaction.status}
                          onChange={e => setEditingTransaction({
                            ...editingTransaction,
                            status: e.target.value
                          })}
                          size="small"
                        >
                          <MenuItem value="active">{t('active')}</MenuItem>
                          <MenuItem value="completed">{t('completed')}</MenuItem>
                          <MenuItem value="cancelled">{t('cancelled')}</MenuItem>
                        </TextField>
                      ) : (
                        item.status
                      )}
                    </TableCell>
                    <TableCell>
                      {editingTransaction === item ? (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={handleUpdateTransaction}
                          >
                            {t('save')}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setEditingTransaction(null)}
                          >
                            {t('cancel')}
                          </Button>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleEditTransaction(item)}
                          >
                            {t('edit')}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleDeleteTransaction(item)}
                          >
                            {t('delete')}
                          </Button>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <Box sx={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          bgcolor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <Paper sx={{ p: 3, maxWidth: 400, width: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {t('confirmDelete')}
            </Typography>
            <Typography sx={{ mb: 2 }}>
              {t('deleteConfirmation')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button 
                variant="outlined" 
                onClick={() => {
                  setShowDeleteModal(false);
                  setTransactionToDelete(null);
                }}
              >
                {t('cancel')}
              </Button>
              <Button 
                variant="contained" 
                color="error"
                onClick={confirmDeleteTransaction}
              >
                {t('delete')}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {success}
        </Alert>
      )}
    </Box>
  );
}
function Transfer({ persons, transactions, setTransactions, user }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('usd');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // محاسبه مانده حساب فرستنده
  const calculateSenderBalance = (person, currency) => {
    let balance = 0;
    transactions.forEach(tr => {
      if (!tr) return;
      if (tr.type === 'receive' && tr.person === person && tr.currency === currency) {
        balance += Number(tr.amount);
      } else if (tr.type === 'pay' && tr.person === person && tr.currency === currency) {
        balance -= Number(tr.amount);
      } else if (tr.type === 'buy' && tr.person === person && tr.currency === currency) {
        balance -= Number(tr.quantity);
      } else if (tr.type === 'transfer') {
        if (tr.from === person && tr.currency === currency) {
          balance -= Number(tr.amount);
        } else if (tr.to === person && tr.currency === currency) {
          balance += Number(tr.amount);
        }
      }
    });
    return balance;
  };

  const validate = () => {
    if (!from) return 'فرستنده را انتخاب کنید';
    if (!to) return 'گیرنده را انتخاب کنید';
    if (from === to) return 'فرستنده و گیرنده نباید یکسان باشند';
    if (!amount) return 'مبلغ را وارد کنید';
    if (isNaN(amount) || Number(amount) <= 0) return 'مبلغ باید عدد مثبت باشد';
    
    // بررسی موجودی کافی
    const senderBalance = calculateSenderBalance(from, currency);
    if (senderBalance < Number(amount)) {
      return `موجودی کافی نیست. موجودی فعلی: ${senderBalance.toLocaleString('en-US')}`;
    }
    
    return '';
  };

  const handleTransfer = (e) => {
    e.preventDefault();
    const err = validate();
    if (err) {
      setError(err);
      setSuccess('');
      return;
    }

    const newTransaction = {
      type: 'transfer',
      user,
      from,
      to,
      amount: Number(amount),
      currency,
      date: new Date().toISOString()
    };

    setTransactions([...transactions, newTransaction]);
    setFrom('');
    setTo('');
    setAmount('');
    setCurrency('usd');
    setError('');
    setSuccess('انتقال وجه با موفقیت ثبت شد');
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>انتقال وجه بین اشخاص</Typography>
      <Paper elevation={3} sx={{ p: 3 }}>
        <Box component="form" onSubmit={handleTransfer} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            select
            fullWidth
            label="فرستنده"
            value={from}
            onChange={e => setFrom(e.target.value)}
            error={!!error && error.includes('فرستنده')}
            id="transfer-from"
            name="from"
          >
            <MenuItem value="">
              <em>انتخاب فرستنده</em>
            </MenuItem>
            {persons.map((p) => (
              <MenuItem key={p} value={p}>{p}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            fullWidth
            label="گیرنده"
            value={to}
            onChange={e => setTo(e.target.value)}
            error={!!error && error.includes('گیرنده')}
            id="transfer-to"
            name="to"
          >
            <MenuItem value="">
              <em>انتخاب گیرنده</em>
            </MenuItem>
            {persons.map((p) => (
              <MenuItem key={p} value={p}>{p}</MenuItem>
            ))}
          </TextField>

          <TextField
            fullWidth
            label="مبلغ"
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            error={!!error && error.includes('مبلغ')}
            inputProps={{ min: 0 }}
            id="transfer-amount"
            name="amount"
          />

          <TextField
            select
            fullWidth
            label="ارز"
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            id="transfer-currency"
            name="currency"
          >
            {currencyList.map(c => (
              <MenuItem key={c.code} value={c.code}>{c.labelFa}</MenuItem>
            ))}
          </TextField>

          {from && currency && (
            <Typography variant="body2" color="textSecondary">
              موجودی فعلی: {formatNumberWithCurrency(calculateSenderBalance(from, currency), currency).value}
            </Typography>
          )}

          <Button 
            type="submit" 
            variant="contained" 
            color="primary" 
            size="large"
            fullWidth
          >
            ثبت انتقال
          </Button>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {success}
            </Alert>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
function Reports({ transactions, setTransactions, search, ToastContext }) {
  const { showToast } = React.useContext(ToastContext || React.createContext());
  const [msg, setMsg] = useState('');
  const [deleteIdx, setDeleteIdx] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editIdx, setEditIdx] = useState(null);
  const [editData, setEditData] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const { t } = useTranslation();

  // Get unique persons from transactions
  const getUniquePersons = () => {
    const persons = new Set();
    transactions.forEach(tr => {
      if (tr.person) persons.add(tr.person);
      if (tr.from) persons.add(tr.from);
      if (tr.to) persons.add(tr.to);
    });
    return Array.from(persons).sort();
  };

  // Filter transactions based on date range, search, person, and type
  const getFilteredTransactions = () => {
    let filtered = [...transactions];
    
    // Apply date filters
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(tr => new Date(tr.date) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Set to end of day
      filtered = filtered.filter(tr => new Date(tr.date) <= end);
    }
    
    // Apply person filter
    if (selectedPerson) {
      filtered = filtered.filter(tr => {
        if (!tr) return false;
        // Check all possible person fields
        return (
          (tr.person && tr.person === selectedPerson) ||
          (tr.from && tr.from === selectedPerson) ||
          (tr.to && tr.to === selectedPerson)
        );
      });
    }

    // Apply type filter
    if (selectedType) {
      filtered = filtered.filter(tr => tr && tr.type === selectedType);
    }
    
    // Apply search filter
    if (search) {
      filtered = filtered.filter(tr => {
        if (!tr) return false;
        return (
          (tr.person && tr.person.includes(search)) ||
          (tr.from && tr.from.includes(search)) ||
          (tr.to && tr.to.includes(search)) ||
          (tr.orderNumber && tr.orderNumber.includes(search)) ||
          (tr.deliveryNumber && tr.deliveryNumber.includes(search))
        );
      });
    }

    // Sort by date descending
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    return filtered;
  };

  const handleDelete = idx => {
    setDeleteIdx(idx);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (deleteIdx === null) return;
    
    const transaction = transactions[deleteIdx];
    if (!transaction) {
      setMsg(t('transactionNotFound'));
      return;
    }

    if (handleTransaction(transaction, 'deleted')) {
      const newTransactions = transactions.filter((_, i) => i !== deleteIdx);
      setTransactions(newTransactions);
      saveToLocalStorage(STORAGE_KEYS.TRANSACTIONS, newTransactions);
      setMsg(t('transactionDeleted'));
      showToast(t('transactionDeleted'), 'success');
    setDeleteIdx(null);
      setShowDeleteModal(false);
    setTimeout(() => setMsg(''), 1500);
    } else {
      setMsg(t('deleteError'));
      showToast(t('deleteError'), 'error');
    }
  };

  const handleEdit = (idx) => {
    const transaction = transactions[idx];
    if (!transaction) return;
    
    setEditIdx(idx);
    setEditData({...transaction});
  };

  const saveEdit = () => {
    if (!editData || !validateTransaction(editData)) {
      setMsg(t('invalidTransactionData'));
      return;
    }

    if (handleTransaction(editData, 'updated')) {
      const newTransactions = [...transactions];
      newTransactions[editIdx] = editData;
      setTransactions(newTransactions);
      saveToLocalStorage(STORAGE_KEYS.TRANSACTIONS, newTransactions);
      setMsg(t('transactionUpdated'));
      showToast(t('transactionUpdated'), 'success');
      setEditIdx(null);
      setEditData(null);
      setTimeout(() => setMsg(''), 1500);
    } else {
      setMsg(t('updateError'));
      showToast(t('updateError'), 'error');
    }
  };

  const cancelEdit = () => {
    setEditIdx(null);
    setEditData(null);
  };

  // Calculate summary with proper error handling
  const calculateSummary = () => {
  const summary = {
    receive: { usd: 0, cny: 0, irr: 0 },
    pay: { usd: 0, cny: 0, irr: 0 },
    transfer: { usd: 0, cny: 0, irr: 0 },
    buy: { usd: 0, cny: 0, irr: 0 },
      delivery: { usd: 0, cny: 0, irr: 0 }
  };

    const filteredTransactions = getFilteredTransactions();

    filteredTransactions.forEach(tr => {
    if (!tr) return;
    try {
      const amount = Number(tr.amount || tr.quantity || 0);
      if (isNaN(amount)) return;

      switch(tr.type) {
        case 'receive':
          if (tr.currency && summary.receive[tr.currency] !== undefined) {
            summary.receive[tr.currency] += amount;
          }
          break;
        case 'pay':
          if (tr.currency && summary.pay[tr.currency] !== undefined) {
            summary.pay[tr.currency] += amount;
          }
          break;
        case 'transfer':
          if (tr.currency && summary.transfer[tr.currency] !== undefined) {
            summary.transfer[tr.currency] += amount;
          }
          break;
        case 'buy':
          if (tr.currency && summary.buy[tr.currency] !== undefined) {
            summary.buy[tr.currency] += amount;
          }
          break;
          case 'delivery':
            if (tr.currency && summary.delivery[tr.currency] !== undefined) {
              summary.delivery[tr.currency] += amount;
            }
            break;
      }
    } catch (error) {
        console.error('Error calculating summary:', error);
    }
  });

    return summary;
  };

  const summary = calculateSummary();

  // Calculate totals for each currency
  const totals = {
    usd: 0,
    cny: 0,
    irr: 0
  };

  Object.values(summary).forEach(type => {
    totals.usd += type.usd;
    totals.cny += type.cny;
    totals.irr += type.irr;
  });

  const formatNumber = n => n ? Number(n).toLocaleString('en-US') : '';

  const exportExcel = () => {
    const filteredTransactions = getFilteredTransactions();
    const data = filteredTransactions.map(tr => ({
      [t('type')]: t(tr.type),
      [t('user')]: tr.user,
      [t('person')]: tr.person || `${tr.from || ''} → ${tr.to || ''}`,
      [t('amount')]: formatNumberWithCurrency(tr.amount || tr.quantity, tr.currency).value,
      [t('currency')]: currencyList.find(c => c.code === tr.currency)?.labelZh,
      [t('rate')]: tr.rate ? formatNumber(tr.rate) : '',
      [t('date')]: new Date(tr.date).toLocaleString('en-US'),
      [t('description')]: tr.description || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/octet-stream' }), `transactions_${new Date().toISOString()}.xlsx`);
  };

  const printTable = () => {
    const printWindow = window.open('', '_blank');
    const filteredTransactions = getFilteredTransactions();
    
    const tableHtml = `
      <html>
        <head>
          <title>${t('reports')}</title>
          <style>
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; border: 1px solid #ccc; }
            th { background: #f0f0f0; }
            @media print {
              body { margin: 0; padding: 20px; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; page-break-after: auto; }
            }
          </style>
        </head>
        <body>
          <h2>${t('reports')}</h2>
          <table>
            <thead>
              <tr>
                <th>${t('type')}</th>
                <th>${t('user')}</th>
                <th>${t('person')}</th>
                <th>${t('amount')}</th>
                <th>${t('currency')}</th>
                <th>${t('rate')}</th>
                <th>${t('date')}</th>
                <th>${t('description')}</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTransactions.map(tr => `
                <tr>
                  <td>${t(tr.type)}</td>
                  <td>${tr.user}</td>
                  <td>${tr.person || `${tr.from || ''} → ${tr.to || ''}`}</td>
                  <td>${formatNumberWithCurrency(tr.amount || tr.quantity, tr.currency).value}</td>
                  <td>${currencyList.find(c => c.code === tr.currency)?.labelZh}</td>
                  <td>${tr.rate ? formatNumber(tr.rate) : ''}</td>
                  <td>${new Date(tr.date).toLocaleString('en-US')}</td>
                  <td>${tr.description || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    printWindow.document.write(tableHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <div className="card">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <h2>{t('reports')}</h2>
        <div>
          <button className="btn-main" onClick={exportExcel}>{t('export')}</button>
          <button className="btn-main" onClick={printTable} style={{marginRight:8}}>{t('print')}</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{marginBottom:16, display:'flex', gap:8, alignItems:'center', flexWrap: 'wrap'}}>
        <div>
          <label style={{marginRight:8}}>{t('startDate')}:</label>
          <input 
            type="date" 
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{padding:8}}
          />
        </div>
        <div>
          <label style={{marginRight:8}}>{t('endDate')}:</label>
          <input 
            type="date" 
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={{padding:8}}
          />
        </div>
        <div>
          <label style={{marginRight:8}}>{t('person')}:</label>
          <select 
            value={selectedPerson} 
            onChange={e => setSelectedPerson(e.target.value)}
            style={{padding:8}}
          >
            <option value="">{t('allPersons')}</option>
            {getUniquePersons().map(person => (
              <option key={person} value={person}>{person}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{marginRight:8}}>{t('type')}:</label>
          <select 
            value={selectedType} 
            onChange={e => setSelectedType(e.target.value)}
            style={{padding:8}}
          >
            <option value="">{t('allTypes')}</option>
            <option value="receive">{t('receive')}</option>
            <option value="pay">{t('pay')}</option>
            <option value="transfer">{t('transfer')}</option>
            <option value="buy">{t('buy')}</option>
            <option value="delivery">{t('delivery')}</option>
          </select>
        </div>
        <button 
          className="btn-main"
          onClick={() => {
            setStartDate('');
            setEndDate('');
            setSelectedPerson('');
            setSelectedType('');
          }}
        >
          {t('clearFilters')}
        </button>
      </div>

      {msg && <div className="success-msg">{msg}</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
            <th style={{ padding: 8, border: '1px solid #ccc' }}>{t('type')}</th>
            <th style={{ padding: 8, border: '1px solid #ccc' }}>{t('user')}</th>
            <th style={{ padding: 8, border: '1px solid #ccc' }}>{t('person')}</th>
            <th style={{ padding: 8, border: '1px solid #ccc' }}>{t('amount')}</th>
            <th style={{ padding: 8, border: '1px solid #ccc' }}>{t('currency')}</th>
            <th style={{ padding: 8, border: '1px solid #ccc' }}>{t('rate')}</th>
            <th style={{ padding: 8, border: '1px solid #ccc' }}>{t('date')}</th>
            <th style={{ padding: 8, border: '1px solid #ccc' }}>{t('description')}</th>
            <th style={{ padding: 8, border: '1px solid #ccc' }}>{t('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {getFilteredTransactions().length === 0 && (
            <tr><td colSpan={9} style={{ textAlign: 'center', color: '#888' }}>{t('noTransactions')}</td></tr>
          )}
          {getFilteredTransactions().map((tr, idx) => (
            <tr key={idx}>
              <td style={{ padding: 8, border: '1px solid #ccc' }}>
                {editIdx === idx ? (
                  <select 
                    value={editData.type} 
                    onChange={e => setEditData({...editData, type: e.target.value})}
                    style={{ width: '100%', padding: 4 }}
                  >
                    <option value="receive">{t('receive')}</option>
                    <option value="pay">{t('pay')}</option>
                    <option value="transfer">{t('transfer')}</option>
                    <option value="buy">{t('buy')}</option>
                    <option value="delivery">{t('delivery')}</option>
                  </select>
                ) : (
                  t(tr.type)
                )}
              </td>
              <td style={{ padding: 8, border: '1px solid #ccc' }}>{tr.user}</td>
              <td style={{ padding: 8, border: '1px solid #ccc' }}>
                {editIdx === idx ? (
                  <input 
                    type="text" 
                    value={editData.person || editData.from || ''} 
                    onChange={e => setEditData({...editData, person: e.target.value})}
                    style={{ width: '100%', padding: 4 }}
                  />
                ) : (
                  tr.person || `${tr.from || ''} → ${tr.to || ''}`
                )}
              </td>
              <td style={{ padding: 8, border: '1px solid #ccc' }}>
                {editIdx === idx ? (
                  <input 
                    type="number" 
                    value={editData.amount || editData.quantity} 
                    onChange={e => setEditData({...editData, amount: Number(e.target.value)})}
                    style={{ width: '100%', padding: 4 }}
                  />
                ) : (
                  <span style={{ color: Number(tr.amount || tr.quantity) < 0 ? 'red' : 'inherit' }}>
                    {formatNumberWithCurrency(tr.amount || tr.quantity, tr.currency).value}
                  </span>
                )}
              </td>
              <td style={{ padding: 8, border: '1px solid #ccc' }}>
                {editIdx === idx ? (
                  <select 
                    value={editData.currency} 
                    onChange={e => setEditData({...editData, currency: e.target.value})}
                    style={{ width: '100%', padding: 4 }}
                  >
                    {currencyList.map(c => (
                      <option key={c.code} value={c.code}>{c.labelZh}</option>
                    ))}
                  </select>
                ) : (
                  currencyList.find(c => c.code === tr.currency)?.labelZh
                )}
              </td>
              <td style={{ padding: 8, border: '1px solid #ccc' }}>
                {editIdx === idx ? (
                  <input 
                    type="number" 
                    value={editData.rate || ''} 
                    onChange={e => setEditData({...editData, rate: Number(e.target.value)})}
                    style={{ width: '100%', padding: 4 }}
                  />
                ) : (
                  tr.rate ? formatNumber(tr.rate) : ''
                )}
              </td>
              <td style={{ padding: 8, border: '1px solid #ccc' }}>
                {editIdx === idx ? (
                  <input 
                    type="datetime-local" 
                    value={editData.date.slice(0, 16)} 
                    onChange={e => setEditData({...editData, date: new Date(e.target.value).toISOString()})}
                    style={{ width: '100%', padding: 4 }}
                  />
                ) : (
                  new Date(tr.date).toLocaleString('en-US')
                )}
              </td>
              <td style={{ padding: 8, border: '1px solid #ccc' }}>
                {editIdx === idx ? (
                  <input 
                    type="text" 
                    value={editData.description || ''} 
                    onChange={e => setEditData({...editData, description: e.target.value})}
                    style={{ width: '100%', padding: 4 }}
                  />
                ) : (
                  tr.description || ''
                )}
              </td>
              <td style={{ padding: 8, border: '1px solid #ccc' }}>
                {editIdx === idx ? (
                  <>
                    <button className="btn-main" onClick={saveEdit} style={{ marginRight: 4 }}>{t('save')}</button>
                    <button className="btn-delete" onClick={cancelEdit}>{t('cancel')}</button>
                  </>
                ) : (
                  <>
                    <button className="btn-main" onClick={() => handleEdit(idx)} style={{ marginRight: 4 }}>{t('edit')}</button>
                    <button className="btn-delete" onClick={() => handleDelete(idx)}>{t('delete')}</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Advanced Report Summary */}
      <div style={{marginTop:32}}>
        <h2>{t('advancedReport')}</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
        <thead>
          <tr style={{ background: '#f0f0f0' }}>
              <th style={{ padding: 8, border: '1px solid #ccc' }}>{t('type')}</th>
              <th style={{ padding: 8, border: '1px solid #ccc' }}>USD</th>
              <th style={{ padding: 8, border: '1px solid #ccc' }}>CNY</th>
              <th style={{ padding: 8, border: '1px solid #ccc' }}>IRR</th>
          </tr>
        </thead>
        <tbody>
            {Object.entries(summary).map(([type, amounts]) => (
              <tr key={type}>
                <td style={{ padding: 8, border: '1px solid #ccc' }}>{t(type)}</td>
                <td style={{ padding: 8, border: '1px solid #ccc', textAlign: 'right' }}>
                  {formatNumberWithCurrency(amounts.usd, 'usd').value}
            </td>
                <td style={{ padding: 8, border: '1px solid #ccc', textAlign: 'right' }}>
                  {formatNumberWithCurrency(amounts.cny, 'cny').value}
            </td>
                <td style={{ padding: 8, border: '1px solid #ccc', textAlign: 'right' }}>
                  {formatNumberWithCurrency(amounts.irr, 'irr').value}
            </td>
          </tr>
            ))}
            <tr style={{ background: '#f0f0f0', fontWeight: 'bold' }}>
              <td style={{ padding: 8, border: '1px solid #ccc' }}>{t('total')}</td>
              <td style={{ padding: 8, border: '1px solid #ccc', textAlign: 'right' }}>
              {formatNumberWithCurrency(totals.usd, 'usd').value}
            </td>
              <td style={{ padding: 8, border: '1px solid #ccc', textAlign: 'right' }}>
              {formatNumberWithCurrency(totals.cny, 'cny').value}
            </td>
              <td style={{ padding: 8, border: '1px solid #ccc', textAlign: 'right' }}>
              {formatNumberWithCurrency(totals.irr, 'irr').value}
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '100%'
          }}>
            <h3 style={{ marginTop: 0 }}>{t('confirmDelete')}</h3>
            <p>{t('deleteConfirmation')}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
              <button 
                className="btn-main" 
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteIdx(null);
                }}
              >
                {t('cancel')}
              </button>
              <button 
                className="btn-delete" 
                onClick={confirmDelete}
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Delivery({ persons, transactions, setTransactions, user }) {
  const [deliveryNumber, setDeliveryNumber] = useState('');
  const [boxCount, setBoxCount] = useState('');
  const [weight, setWeight] = useState('');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedDelivery, setSelectedDelivery] = useState('');
  const [receiptImage, setReceiptImage] = useState(null);
  const [boxesImage, setBoxesImage] = useState(null);
  const [editingPackage, setEditingPackage] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState(null);
  const { t } = useTranslation();

  // Get all delivery numbers
  const getDeliveryNumbers = () => {
    const deliveries = new Set();
    transactions.forEach(tr => {
      if (tr.type === 'delivery' && tr.deliveryNumber) {
        deliveries.add(tr.deliveryNumber);
      }
    });
    return Array.from(deliveries).sort((a, b) => b.localeCompare(a));
  };

  // Get package details for selected delivery
  const getPackageDetails = (deliveryNumber) => {
    return transactions.filter(tr => 
      tr.type === 'delivery' && 
      tr.deliveryNumber === deliveryNumber
    ).sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate required fields
    if (!deliveryNumber) {
      setError(t('enterDeliveryNumber'));
      return;
    }
    if (!boxCount || isNaN(Number(boxCount)) || Number(boxCount) <= 0) {
      setError(t('invalidBoxCount'));
      return;
    }
    if (!weight || isNaN(Number(weight)) || Number(weight) <= 0) {
      setError(t('invalidWeight'));
      return;
    }
    if (!receiptNumber) {
      setError(t('enterReceiptNumber'));
      return;
    }

    // Create new package object
    const newDeliveryPackage = {
      type: 'delivery',
      user,
      deliveryNumber,
      boxCount: Number(boxCount),
      weight: Number(weight),
      receiptNumber,
      description,
      receiptImage: receiptImage ? URL.createObjectURL(receiptImage) : null,
      boxesImage: boxesImage ? URL.createObjectURL(boxesImage) : null,
      date: new Date().toISOString()
    };

    try {
      // Update transactions
      const updatedTransactions = [...transactions, newDeliveryPackage];
      setTransactions(updatedTransactions);
      
      // Save to localStorage
      saveToLocalStorage(STORAGE_KEYS.TRANSACTIONS, updatedTransactions);

      // Reset form
      setBoxCount('');
      setWeight('');
      setReceiptNumber('');
      setDescription('');
      setReceiptImage(null);
      setBoxesImage(null);
      setError('');
      setSuccess(t('packageAdded'));
    } catch (error) {
      console.error('Error saving package:', error);
      setError(t('saveError'));
    }
  };

  const handleUpdate = () => {
    if (!editingPackage) return;

    // Validate required fields
    if (!deliveryNumber) {
      setError(t('enterDeliveryNumber'));
      return;
    }
    if (!boxCount || isNaN(Number(boxCount)) || Number(boxCount) <= 0) {
      setError(t('invalidBoxCount'));
      return;
    }
    if (!weight || isNaN(Number(weight)) || Number(weight) <= 0) {
      setError(t('invalidWeight'));
      return;
    }
    if (!receiptNumber) {
      setError(t('enterReceiptNumber'));
      return;
    }

    const updatedDeliveryPackage = {
      ...editingPackage,
      deliveryNumber,
      boxCount: Number(boxCount),
      weight: Number(weight),
      receiptNumber,
      description,
      receiptImage: receiptImage ? URL.createObjectURL(receiptImage) : editingPackage.receiptImage,
      boxesImage: boxesImage ? URL.createObjectURL(boxesImage) : editingPackage.boxesImage,
    };

    try {
      // Update the transaction in the array
      const updatedTransactions = transactions.map(tr => 
        tr === editingPackage ? updatedDeliveryPackage : tr
      );
      
      // Update transactions state
      setTransactions(updatedTransactions);
      
      // Save to localStorage
      saveToLocalStorage(STORAGE_KEYS.TRANSACTIONS, updatedTransactions);

      // Reset form
      setEditingPackage(null);
      setBoxCount('');
      setWeight('');
      setReceiptNumber('');
      setDescription('');
      setReceiptImage(null);
      setBoxesImage(null);
      setError('');
      setSuccess(t('packageUpdated'));
    } catch (error) {
      console.error('Error updating package:', error);
      setError(t('updateError'));
    }
  };

  const handleEdit = (deliveryPackage) => {
    setEditingPackage(deliveryPackage);
    setDeliveryNumber(deliveryPackage.deliveryNumber);
    setBoxCount(deliveryPackage.boxCount.toString());
    setWeight(deliveryPackage.weight.toString());
    setReceiptNumber(deliveryPackage.receiptNumber);
    setDescription(deliveryPackage.description || '');
  };

  const handleDelete = (deliveryPackage) => {
    setPackageToDelete(deliveryPackage);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (!packageToDelete) return;

    try {
      // Remove the package from the array
      const updatedTransactions = transactions.filter(tr => tr !== packageToDelete);
      
      // Update transactions state
      setTransactions(updatedTransactions);
      
      // Save to localStorage
      saveToLocalStorage(STORAGE_KEYS.TRANSACTIONS, updatedTransactions);

      // Reset state
      setPackageToDelete(null);
      setShowDeleteModal(false);
      setError('');
      setSuccess(t('packageDeleted'));
    } catch (error) {
      console.error('Error deleting package:', error);
      setError(t('deleteError'));
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>{t('delivery')}</Typography>
      
      <Paper elevation={3} sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* Left Column - Delivery Number Selection */}
          <Grid item xs={12} md={4}>
            <Typography variant="h6" gutterBottom>{t('deliveryNumber')}</Typography>
            <TextField
              fullWidth
              label={t('newDeliveryNumber')}
              value={deliveryNumber}
              onChange={e => setDeliveryNumber(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              select
              fullWidth
              label={t('selectDelivery')}
              value={selectedDelivery}
              onChange={e => {
                setSelectedDelivery(e.target.value);
                setDeliveryNumber(e.target.value);
              }}
              sx={{ mb: 2 }}
            >
              <MenuItem value="">
                <em>{t('selectDelivery')}</em>
              </MenuItem>
              {getDeliveryNumbers().map(delivery => (
                <MenuItem key={delivery} value={delivery}>{delivery}</MenuItem>
              ))}
            </TextField>
          </Grid>

          {/* Right Column - Package Form */}
          <Grid item xs={12} md={8}>
            <Typography variant="h6" gutterBottom>
              {editingPackage ? t('editPackage') : t('addPackage')}
            </Typography>
            <Box component="form" onSubmit={editingPackage ? handleUpdate : handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                label={t('boxCount')}
                type="number"
                value={boxCount}
                onChange={e => setBoxCount(e.target.value)}
                error={!!error && error.includes(t('boxCount'))}
                inputProps={{ min: 1 }}
              />

              <TextField
                fullWidth
                label={t('weight')}
                type="number"
                value={weight}
                onChange={e => setWeight(e.target.value)}
                error={!!error && error.includes(t('weight'))}
                inputProps={{ min: 0, step: 0.01 }}
              />

              <TextField
                fullWidth
                label={t('receiptNumber')}
                value={receiptNumber}
                onChange={e => setReceiptNumber(e.target.value)}
                error={!!error && error.includes(t('receiptNumber'))}
              />

              <Box>
                <Typography variant="subtitle1" gutterBottom>{t('receiptImage')}</Typography>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setReceiptImage(e.target.files[0])}
                  style={{ display: 'none' }}
                  id="receipt-image"
                />
                <label htmlFor="receipt-image">
                  <Button variant="outlined" component="span">
                    {t('uploadReceipt')}
                  </Button>
                </label>
                {receiptImage && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {receiptImage.name}
                  </Typography>
                )}
              </Box>

              <Box>
                <Typography variant="subtitle1" gutterBottom>{t('boxesImage')}</Typography>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => setBoxesImage(e.target.files[0])}
                  style={{ display: 'none' }}
                  id="boxes-image"
                />
                <label htmlFor="boxes-image">
                  <Button variant="outlined" component="span">
                    {t('uploadBoxes')}
                  </Button>
                </label>
                {boxesImage && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {boxesImage.name}
                  </Typography>
                )}
              </Box>

              <TextField
                fullWidth
                label={t('description')}
                value={description}
                onChange={e => setDescription(e.target.value)}
                multiline
                rows={3}
              />

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                  type="submit" 
                  variant="contained" 
                  color="primary" 
                  size="large"
                  fullWidth
                >
                  {editingPackage ? t('update') : t('addPackage')}
                </Button>
                {editingPackage && (
                  <Button 
                    variant="outlined" 
                    color="error" 
                    size="large"
                    onClick={() => {
                      setEditingPackage(null);
                      setBoxCount('');
                      setWeight('');
                      setReceiptNumber('');
                      setDescription('');
                      setReceiptImage(null);
                      setBoxesImage(null);
                    }}
                  >
                    {t('cancel')}
                  </Button>
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>

        {/* Package History */}
        {selectedDelivery && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
              {t('packageHistory')} - {selectedDelivery}
            </Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('boxCount')}</TableCell>
                    <TableCell>{t('weight')}</TableCell>
                    <TableCell>{t('receiptNumber')}</TableCell>
                    <TableCell>{t('date')}</TableCell>
                    <TableCell>{t('description')}</TableCell>
                    <TableCell>{t('images')}</TableCell>
                    <TableCell>{t('actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {getPackageDetails(selectedDelivery).map((deliveryPackage, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{deliveryPackage.boxCount}</TableCell>
                      <TableCell>{deliveryPackage.weight}</TableCell>
                      <TableCell>{deliveryPackage.receiptNumber}</TableCell>
                      <TableCell>{new Date(deliveryPackage.date).toLocaleString()}</TableCell>
                      <TableCell>{deliveryPackage.description}</TableCell>
                      <TableCell>
                        {deliveryPackage.receiptImage && (
                          <img 
                            src={deliveryPackage.receiptImage} 
                            alt="Receipt" 
                            style={{ width: 50, height: 50, marginRight: 8, cursor: 'pointer' }}
                            onClick={() => window.open(deliveryPackage.receiptImage)}
                          />
                        )}
                        {deliveryPackage.boxesImage && (
                          <img 
                            src={deliveryPackage.boxesImage} 
                            alt="Boxes" 
                            style={{ width: 50, height: 50, cursor: 'pointer' }}
                            onClick={() => window.open(deliveryPackage.boxesImage)}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => handleEdit(deliveryPackage)}
                          >
                            {t('edit')}
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            onClick={() => handleDelete(deliveryPackage)}
                          >
                            {t('delete')}
                          </Button>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mt: 2 }}>
            {success}
          </Alert>
        )}
      </Paper>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <Box sx={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          bgcolor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <Paper sx={{ p: 3, maxWidth: 400, width: '100%' }}>
            <Typography variant="h6" gutterBottom>
              {t('confirmDelete')}
            </Typography>
            <Typography sx={{ mb: 2 }}>
              {t('deleteConfirmation')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
              <Button 
                variant="outlined" 
                onClick={() => {
                  setShowDeleteModal(false);
                  setPackageToDelete(null);
                }}
              >
                {t('cancel')}
              </Button>
              <Button 
                variant="contained" 
                color="error"
                onClick={confirmDelete}
              >
                {t('delete')}
              </Button>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
}

function AppContent(props) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const isAuthenticated = !!user;
  const [persons, setPersons] = useState(() => loadFromLocalStorage(STORAGE_KEYS.PERSONS) || ['JACK', 'AMiR', 'JD', 'Khalil']);
  const [transactions, setTransactions] = useState(() => loadFromLocalStorage(STORAGE_KEYS.TRANSACTIONS) || []);
  const [products, setProducts] = useState(() => loadFromLocalStorage(STORAGE_KEYS.PRODUCTS) || []);
  const [search, setSearch] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [theme, setTheme] = useState('light');
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();

  // Setup auto-save for data
  const saveTransactions = useCallback(setupAutoBackup(transactions, STORAGE_KEYS.TRANSACTIONS), []);
  const savePersons = useCallback(setupAutoBackup(persons, STORAGE_KEYS.PERSONS), []);
  const saveProducts = useCallback(setupAutoBackup(products, STORAGE_KEYS.PRODUCTS), []);

  // Save data when it changes
  useEffect(() => {
    saveTransactions(transactions);
  }, [transactions, saveTransactions]);

  useEffect(() => {
    savePersons(persons);
  }, [persons, savePersons]);

  useEffect(() => {
    saveProducts(products);
  }, [products, saveProducts]);

  // Add notification system
  const addNotification = (message, type = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type, timestamp: new Date() }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // Enhanced data management functions
  const handleImportData = async (file) => {
    try {
      const data = await importData(file);
      if (data.transactions) setTransactions(data.transactions);
      if (data.persons) setPersons(data.persons);
      if (data.products) setProducts(data.products);
      addNotification('داده‌ها با موفقیت وارد شدند', 'success');
    } catch (error) {
      addNotification('خطا در وارد کردن داده‌ها', 'error');
    }
  };

  const handleExportData = () => {
    try {
      exportData();
      addNotification('داده‌ها با موفقیت صادر شدند', 'success');
    } catch (error) {
      addNotification('خطا در صادر کردن داده‌ها', 'error');
    }
  };

  // Add data management buttons to the AppBar
  const renderDataManagementButtons = () => (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <input
        type="file"
        accept=".json"
        onChange={(e) => e.target.files[0] && handleImportData(e.target.files[0])}
        style={{ display: 'none' }}
        id="import-data"
        name="import-data"
      />
      <label htmlFor="import-data">
        <Button
          variant="outlined"
          component="span"
          color="inherit"
        >
          {t('importData')}
        </Button>
      </label>
      <Button
        variant="outlined"
        color="inherit"
        onClick={handleExportData}
      >
        {t('exportData')}
      </Button>
    </Box>
  );

  // Add notifications display
  const renderNotifications = () => (
    <Box
      sx={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: 1
      }}
    >
      {notifications.map(notification => (
        <Alert
          key={notification.id}
          severity={notification.type}
          sx={{ minWidth: 300 }}
        >
          {notification.message}
        </Alert>
      ))}
    </Box>
  );

  const muiTheme = createTheme({
    palette: {
      mode: theme,
      primary: {
        main: '#2196f3', // آبی روشن و شاد
        light: '#64b5f6',
        dark: '#1976d2',
        contrastText: '#fff',
      },
      secondary: {
        main: '#f50057', // صورتی روشن
        light: '#ff4081',
        dark: '#c51162',
        contrastText: '#fff',
      },
      background: {
        default: theme === 'light' ? '#f5f5f5' : '#121212',
        paper: theme === 'light' ? '#ffffff' : '#1e1e1e',
      },
      success: {
        main: '#4caf50', // سبز روشن
        light: '#81c784',
        dark: '#388e3c',
      },
      error: {
        main: '#f44336', // قرمز روشن
        light: '#e57373',
        dark: '#d32f2f',
      },
      warning: {
        main: '#ff9800', // نارنجی روشن
        light: '#ffb74d',
        dark: '#f57c00',
      },
      info: {
        main: '#00bcd4', // فیروزه‌ای روشن
        light: '#4dd0e1',
        dark: '#0097a7',
      },
    },
    typography: {
      fontFamily: '"Vazirmatn", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: {
        fontSize: '2.5rem',
        fontWeight: 600,
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 600,
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 600,
      },
      h4: {
        fontSize: '1.5rem',
        fontWeight: 600,
      },
      h5: {
        fontSize: '1.25rem',
        fontWeight: 600,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 600,
      },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontWeight: 600,
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0px 2px 4px rgba(0,0,0,0.2)',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: '0px 2px 8px rgba(0,0,0,0.1)',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: '0px 2px 8px rgba(0,0,0,0.1)',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: '0px 2px 8px rgba(0,0,0,0.1)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRadius: '0 12px 12px 0',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
    },
    direction: 'rtl',
  });

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerOpenToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const menuItems = [
    { text: t('dashboard'), icon: <DashboardIcon />, path: '/dashboard' },
    { text: t('persons'), icon: <PeopleIcon />, path: '/persons' },
    { text: t('receive'), icon: <SwapHorizIcon />, path: '/receive' },
    { text: t('usdToCny'), icon: <AttachMoneyIcon />, path: '/pay' },
    { text: t('buy'), icon: <ShoppingCartIcon />, path: '/buy' },
    { text: t('transfer'), icon: <SwapHorizIcon />, path: '/transfer' },
    { text: t('delivery'), icon: <LocalShippingIcon />, path: '/delivery' },
    { text: t('reports'), icon: <AssessmentIcon />, path: '/reports' },
  ];

  const drawer = (
    <Box sx={{ width: 250 }}>
      <Toolbar />
      <List>
        {menuItems.map((item) => (
          <ListItem 
            button 
            key={item.text} 
            component={Link} 
            to={item.path}
            selected={location.pathname === item.path}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { sm: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <IconButton
              color="inherit"
              aria-label="toggle drawer"
              edge="start"
              onClick={handleDrawerOpenToggle}
              sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {renderDataManagementButtons()}
              <Button 
                color="inherit" 
                onClick={() => i18n.changeLanguage(i18n.language === 'fa' ? 'zh' : 'fa')}
                sx={{ minWidth: 'auto' }}
              >
                {i18n.language === 'fa' ? '中文' : 'فارسی'}
              </Button>
            <IconButton 
              color="inherit" 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
            </Box>
            <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, textAlign: 'center' }}>
              {t('appName')}
            </Typography>
          </Toolbar>
        </AppBar>
        {renderNotifications()}
        <Box
          component="nav"
          sx={{ width: { sm: drawerOpen ? 250 : 0 }, flexShrink: { sm: 0 } }}
        >
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true,
            }}
            sx={{
              display: { xs: 'block', sm: 'none' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 250 },
            }}
          >
            {drawer}
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', sm: 'block' },
              '& .MuiDrawer-paper': { 
                boxSizing: 'border-box', 
                width: drawerOpen ? 250 : 0,
                transition: 'width 0.2s ease-in-out',
                overflowX: 'hidden'
              },
            }}
            open={drawerOpen}
          >
            {drawer}
          </Drawer>
        </Box>
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            width: { sm: `calc(100% - ${drawerOpen ? 250 : 0}px)` },
            transition: 'width 0.2s ease-in-out',
            mt: '64px'
          }}
        >
          <Container maxWidth="lg">
            <Paper elevation={3} sx={{ p: 3 }}>
              <Routes>
                <Route path="/login" element={<Login onLogin={setUser} isAuthenticated={isAuthenticated} />} />
                <Route path="/dashboard" element={isAuthenticated ? <Dashboard persons={persons} transactions={transactions} search={search} ThemeContext={React.createContext({ theme, setTheme })} /> : <Navigate to="/login" />} />
                <Route path="/persons" element={isAuthenticated ? <Persons persons={persons} setPersons={setPersons} transactions={transactions} /> : <Navigate to="/login" />} />
                <Route path="/receive" element={isAuthenticated ? <Receive persons={persons} transactions={transactions} setTransactions={setTransactions} user={user} /> : <Navigate to="/login" />} />
                <Route path="/pay" element={isAuthenticated ? <Pay persons={persons} transactions={transactions} setTransactions={setTransactions} user={user} /> : <Navigate to="/login" />} />
                <Route path="/buy" element={isAuthenticated ? <Buy persons={persons} products={products} setProducts={setProducts} transactions={transactions} setTransactions={setTransactions} user={user} /> : <Navigate to="/login" />} />
                <Route path="/transfer" element={isAuthenticated ? <Transfer persons={persons} transactions={transactions} setTransactions={setTransactions} user={user} /> : <Navigate to="/login" />} />
                <Route path="/delivery" element={isAuthenticated ? <Delivery persons={persons} transactions={transactions} setTransactions={setTransactions} user={user} /> : <Navigate to="/login" />} />
                <Route path="/reports" element={isAuthenticated ? <Reports transactions={transactions} setTransactions={setTransactions} search={search} ToastContext={React.createContext({ showToast: () => {} })} /> : <Navigate to="/login" />} />
                <Route path="/" element={<Navigate to="/login" />} />
              </Routes>
            </Paper>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
