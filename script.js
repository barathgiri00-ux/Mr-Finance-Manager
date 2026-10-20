
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
}).format(Number(n) || 0);
const today = new Date().toISOString().slice(0, 10);
$('date').value = today;

let transactions = JSON.parse(localStorage.getItem('pfm_transactions') || '[]');
let accounts = JSON.parse(localStorage.getItem('pfm_accounts') || '[]');
let goals = JSON.parse(localStorage.getItem('pfm_goals') || '[]');
let budget = Number(localStorage.getItem('pfm_budget') || 0);
let moneyChart, categoryChart;

function save() {
  localStorage.setItem('pfm_transactions', JSON.stringify(transactions));
  localStorage.setItem('pfm_accounts', JSON.stringify(accounts));
  localStorage.setItem('pfm_goals', JSON.stringify(goals));
  localStorage.setItem('pfm_budget', String(budget));
}

function safe(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
}

function totals() {
  const income = transactions.filter(t => t.type === 'income').reduce((s,t) => s + Number(t.amount), 0);
  const expenses = transactions.filter(t => t.type === 'expense').reduce((s,t) => s + Number(t.amount), 0);
  return {income, expenses, balance: income - expenses};
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === id));
  document.querySelectorAll('[data-page]').forEach(b => b.classList.toggle('active', b.dataset.page === id));
  $('sidebar').classList.remove('open');
  $('overlay').classList.remove('show');
  window.scrollTo({top: 0, behavior: 'smooth'});
}

function renderDashboard() {
  const t = totals();
  $('totalBalance').textContent = money(t.balance);
  $('incomeTotal').textContent = money(t.income);
  $('expenseTotal').textContent = money(t.expenses);

  const recent = [...transactions].sort((a,b) => b.date.localeCompare(a.date)).slice(0,5);
  $('recentList').innerHTML = recent.length ? recent.map(txHTML).join('') :
    '<p class="empty">No transactions yet. Add your first one!</p>';

  const months = [];
  for (let i=5; i>=0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth()-i);
    months.push({
      label: d.toLocaleString('en-US',{month:'short'}),
      month: d.toISOString().slice(0,7)
    });
  }
  const incomeData = months.map(m => transactions.filter(t => t.type==='income' && t.date.startsWith(m.month)).reduce((s,t)=>s+Number(t.amount),0));
  const expenseData = months.map(m => transactions.filter(t => t.type==='expense' && t.date.startsWith(m.month)).reduce((s,t)=>s+Number(t.amount),0));

  if (moneyChart) moneyChart.destroy();
  moneyChart = new Chart($('moneyChart'), {
    type:'bar',
    data:{labels:months.map(m=>m.label),datasets:[
      {label:'Income',data:incomeData,backgroundColor:'#13b98a',borderRadius:6},
      {label:'Expenses',data:expenseData,backgroundColor:'#8b79f6',borderRadius:6}
    ]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom'}},
      scales:{y:{beginAtZero:true,grid:{color:'#88888818'}},x:{grid:{display:false}}}}
  });
}

function txHTML(t) {
  const positive = t.type === 'income';
  const symbol = positive ? '+' : '−';
  const icon = ({Food:'🍜',Shopping:'🛍️',Transport:'🚗',Bills:'🧾',Salary:'💰',Education:'📚',Other:'✦'})[t.category] || '✦';
  return `<div class="tx-row">
    <div class="tx-icon">${icon}</div>
    <div class="tx-info"><b>${safe(t.note || t.category)}</b><small>${safe(t.category)} · ${safe(t.date)}</small></div>
    <div class="tx-amount ${positive?'positive':'negative'}">${symbol}${money(t.amount)}</div>
    <button class="text-btn" data-delete="${safe(t.id)}" aria-label="Delete transaction">×</button>
  </div>`;
}

function renderTransactions() {
  const query = $('search').value.toLowerCase();
  const list = [...transactions].sort((a,b)=>b.date.localeCompare(a.date))
    .filter(t => `${t.note} ${t.category} ${t.date}`.toLowerCase().includes(query));
  $('transactionList').innerHTML = list.length ? list.map(txHTML).join('') :
    '<p class="empty">No matching transactions.</p>';
}

function renderAccounts() {
  $('accountList').innerHTML = accounts.length ? accounts.map(a => `
    <article class="account-card">
      <div class="tx-icon">▣</div><h3>${safe(a.name)}</h3>
      <p>${safe(a.type)}</p><strong>${money(a.balance)}</strong>
      <button class="text-btn" data-account-delete="${safe(a.id)}">Remove</button>
    </article>`).join('') : '<p class="empty">Add your first account above.</p>';
}

function renderGoals() {
  $('goalList').innerHTML = goals.length ? goals.map(g => {
    const pct = Math.min(100, Math.round(g.saved / g.target * 100));
    return `<article class="account-card"><h3>${safe(g.name)}</h3>
      <p>${money(g.saved)} saved of ${money(g.target)}</p>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <strong>${pct}%</strong>
      <button class="text-btn" data-goal-delete="${safe(g.id)}">Remove</button></article>`;
  }).join('') : '<p class="empty">Create your first savings goal.</p>';
}

function renderBudget() {
  const spent = totals().expenses;
  $('budgetSummary').innerHTML = budget ? `
    <p>Monthly limit: <b>${money(budget)}</b></p>
    <p>Recorded expenses: <b>${money(spent)}</b></p>
    <div class="progress"><span style="width:${Math.min(100,spent/budget*100)}%;background:${spent>budget?'#f15b79':'#13b98a'}"></span></div>
    <p class="${spent>budget?'negative':'positive'}">${spent>budget?'Budget exceeded!':'You are within budget.'}</p>` : '<p class="empty">Set a budget to track monthly spending.</p>';
}
function renderCategoryChart() {
  const expenses = transactions.filter(t=>t.type==='expense');
  const sums = {};
  expenses.forEach(t => sums[t.category] = (sums[t.category] || 0) + Number(t.amount));
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart($('categoryChart'), {
    type:'doughnut',
    data:{labels:Object.keys(sums).length ? Object.keys(sums) : ['No data'],
      datasets:[{data:Object.keys(sums).length ? Object.values(sums) : [1],
        backgroundColor:['#6854e8','#13b98a','#f4ad45','#f15b79','#45b8df','#a18bff'],
        borderWidth:0,hoverOffset:7}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{position:'bottom'}}}
  });
}

function renderAll() {
  renderDashboard();
  renderTransactions();
  renderAccounts();
  renderGoals();
  renderBudget();
  renderCategoryChart();
}

$('menuBtn').addEventListener('click', () => {
  $('sidebar').classList.add('open');
  $('overlay').classList.add('show');
});
$('overlay').addEventListener('click', () => {
  $('sidebar').classList.remove('open');
  $('overlay').classList.remove('show');
});

document.querySelectorAll('[data-page]').forEach(btn => {
  btn.addEventListener('click', () => {
    showPage(btn.dataset.page);
    if (btn.dataset.action === 'add') $('amount').focus();
  });
});

$('transactionForm').addEventListener('submit', e => {
  e.preventDefault();
  const amount = Number($('amount').value);
  if (!Number.isFinite(amount) || amount <= 0) return alert('Enter a valid amount.');

  transactions.push({
    id: Date.now().toString(),
    type: document.querySelector('input[name="type"]:checked').value,
    amount,
    category: $('category').value,
    date: $('date').value || today,
    note: $('note').value.trim()
  });
  save();
  e.target.reset();
  $('date').value = today;
  renderAll();
  showPage('home');
  alert('Transaction saved!');
});

$('search').addEventListener('input', renderTransactions);

$('transactionList').addEventListener('click', e => {
  const btn = e.target.closest('[data-delete]');
  if (!btn) return;
  if (!confirm('Delete this transaction?')) return;
  transactions = transactions.filter(t => String(t.id) !== btn.dataset.delete);
  save();
  renderAll();
});

$('accountForm').addEventListener('submit', e => {
  e.preventDefault();
  accounts.push({
    id: Date.now().toString(),
    name: $('accountName').value.trim(),
    type: $('accountType').value,
    balance: Number($('accountBalance').value)
  });
  save();
  e.target.reset();
  $('accountBalance').value = 0;
  renderAccounts();
});

$('accountList').addEventListener('click', e => {
  const btn = e.target.closest('[data-account-delete]');
  if (!btn || !confirm('Remove this account?')) return;
  accounts = accounts.filter(a => String(a.id) !== btn.dataset.accountDelete);
  save();
  renderAccounts();
});

$('goalForm').addEventListener('submit', e => {
  e.preventDefault();
  const target = Number($('goalTarget').value);
  const saved = Number($('goalSaved').value);
  if (target <= 0 || saved < 0) return alert('Enter valid goal amounts.');
  goals.push({
    id: Date.now().toString(),
    name: $('goalName').value.trim(),
    target, saved
  });
  save();
  e.target.reset();
  $('goalSaved').value = 0;
  renderGoals();
});

$('goalList').addEventListener('click', e => {
  const btn = e.target.closest('[data-goal-delete]');
  if (!btn || !confirm('Remove this savings goal?')) return;
  goals = goals.filter(g => String(g.id) !== btn.dataset.goalDelete);
  save();
  renderGoals();
});

$('budgetForm').addEventListener('submit', e => {
  e.preventDefault();
  budget = Number($('budgetLimit').value);
  if (budget <= 0) return alert('Enter a valid budget.');
  save();
  renderBudget();
  alert('Budget saved!');
});

function toggleTheme() {
  document.body.classList.toggle('dark');
  localStorage.setItem('pfm_dark', document.body.classList.contains('dark') ? '1' : '0');
}
$('themeBtn').addEventListener('click', toggleTheme);
$('settingsThemeBtn').addEventListener('click', toggleTheme);

if (localStorage.getItem('pfm_dark') === '1') {
  document.body.classList.add('dark');
}

// Start the charts and screen with saved browser data.
renderAll();
