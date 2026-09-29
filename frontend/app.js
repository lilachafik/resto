// Publishable key: safe to use in the browser. Data is only readable after sign-in (RLS).
const SUPABASE_URL = 'https://zedcofuloyheitqughho.supabase.co';
const SUPABASE_KEY = 'sb_publishable_caG4B1rUWInZlxBdZayyHw_eCyGJlnM';

// Handles sign-in, keeps the session in localStorage and refreshes it before it expires
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const STATUS_LABELS = {
  delivered: 'נמסרה',
  preparing: 'בהכנה',
  pending: 'ממתינה',
  cancelled: 'בוטלה',
};

const money = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' });
const dateFmt = new Intl.DateTimeFormat('he-IL', { dateStyle: 'short', timeStyle: 'short' });

// What each tab shows: the REST query and how to render each column
const TABS = {
  orders: {
    query: 'orders?select=id,created_at,total_amount,status,customers(name),restaurants(name)&order=created_at.desc',
    columns: [
      { label: 'מס׳', value: r => r.id, className: 'num' },
      { label: 'לקוח', value: r => r.customers?.name },
      { label: 'מסעדה', value: r => r.restaurants?.name },
      { label: 'תאריך', value: r => dateFmt.format(new Date(r.created_at)), className: 'ltr' },
      { label: 'סכום', value: r => money.format(r.total_amount), className: 'num' },
      { label: 'מצב', value: r => STATUS_LABELS[r.status] ?? r.status, badge: r => r.status },
    ],
  },
  customers: {
    query: 'customers?select=id,name,email,phone,address,avatar_path,orders(count)&order=id',
    columns: [
      { label: 'תמונה', image: 'customers' },
      { label: 'מס׳', value: r => r.id, className: 'num' },
      { label: 'שם', value: r => r.name },
      { label: 'אימייל', value: r => r.email, className: 'ltr' },
      { label: 'טלפון', value: r => r.phone, className: 'ltr' },
      { label: 'כתובת', value: r => r.address },
      { label: 'הזמנות', value: r => r.orders?.[0]?.count ?? 0, className: 'num' },
    ],
  },
  restaurants: {
    query: 'restaurants?select=id,name,address,phone,image_path,orders(count)&order=id',
    columns: [
      { label: 'תמונה', image: 'restaurants' },
      { label: 'מס׳', value: r => r.id, className: 'num' },
      { label: 'שם', value: r => r.name },
      { label: 'כתובת', value: r => r.address },
      { label: 'טלפון', value: r => r.phone, className: 'ltr' },
      { label: 'הזמנות', value: r => r.orders?.[0]?.count ?? 0, className: 'num' },
    ],
  },
};

// Which form the "add" button opens on each tab (none on restaurants)
const ADD_BUTTON = {
  orders: { label: '+ הזמנה חדשה', dialog: 'order-dialog' },
  customers: { label: '+ לקוח חדש', dialog: 'customer-dialog' },
};

const cache = {};
let activeTab = 'orders';
let highlightId = null;

const $ = id => document.getElementById(id);

// Every data request carries the signed-in user's token
async function authHeaders() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) throw new Error('יש להתחבר מחדש');
  return { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` };
}

async function fetchRows(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function insertRow(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      ...(await authHeaders()),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(friendlyError(body));
  return body[0];
}

function friendlyError(body) {
  if (body.code === '23505') return 'כבר קיים לקוח עם האימייל הזה';
  if (body.code === '42501') return 'אין הרשאה לפעולה הזו';
  if (body.code === '23514') return 'אחד הערכים לא תקין';
  return body.message || 'השמירה נכשלה';
}

async function loadTab(name) {
  if (!cache[name]) {
    const rows = await fetchRows(TABS[name].query);
    if (IMAGES[name]) await attachImageUrls(name, rows);
    cache[name] = rows;
  }
  return cache[name];
}

// ---- Images (Supabase Storage) ----

// customers -> private bucket (signed URLs), restaurants -> public bucket
const IMAGES = {
  customers: { bucket: 'avatars', column: 'avatar_path', maxBytes: 2 * 1024 * 1024, isPublic: false },
  restaurants: { bucket: 'restaurant-images', column: 'image_path', maxBytes: 5 * 1024 * 1024, isPublic: true },
};
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SIGNED_URL_SECONDS = 60 * 60;

// Adds r.imageUrl to each row that has an image
async function attachImageUrls(kind, rows) {
  const { bucket, column, isPublic } = IMAGES[kind];
  const withImage = rows.filter(r => r[column]);
  if (!withImage.length) return;

  if (isPublic) {
    for (const r of withImage) r.imageUrl = sb.storage.from(bucket).getPublicUrl(r[column]).data.publicUrl;
    return;
  }
  const { data, error } = await sb.storage.from(bucket)
    .createSignedUrls(withImage.map(r => r[column]), SIGNED_URL_SECONDS);
  if (error) throw error;
  const byPath = Object.fromEntries(data.filter(d => d.signedUrl).map(d => [d.path, d.signedUrl]));
  for (const r of withImage) r.imageUrl = byPath[r[column]];
}

// Uploads the file, saves its path on the row, then removes the previous file
async function uploadImage(kind, row, file) {
  const { bucket, column, maxBytes } = IMAGES[kind];
  if (!IMAGE_TYPES.includes(file.type)) throw new Error('אפשר להעלות רק JPG, PNG או WEBP');
  if (file.size > maxBytes) throw new Error(`הקובץ גדול מדי (עד ${maxBytes / 1024 / 1024}MB)`);

  // A new name on every upload, so browsers never show a cached old photo
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
  const path = `${row.id}/${Date.now()}.${ext}`;

  const up = await sb.storage.from(bucket).upload(path, file, { contentType: file.type });
  if (up.error) throw new Error(`ההעלאה נכשלה: ${up.error.message}`);

  const { data, error } = await sb.from(kind).update({ [column]: path }).eq('id', row.id).select('id');
  if (error || !data.length) {
    await sb.storage.from(bucket).remove([path]);
    throw new Error('אין הרשאה לעדכן את התמונה');
  }

  if (row[column]) await sb.storage.from(bucket).remove([row[column]]);
}

// Thumbnail + (optionally) an upload button, used in tables and the customer card
function imageCell(kind, row, { canUpload, size = 'small', onDone }) {
  const wrap = document.createElement('div');
  wrap.className = `photo photo-${size}`;

  if (row.imageUrl) {
    const img = document.createElement('img');
    img.src = row.imageUrl;
    img.alt = row.name;
    img.loading = 'lazy';
    wrap.appendChild(img);
  } else {
    const ph = document.createElement('span');
    ph.className = 'photo-placeholder';
    ph.textContent = (row.name || '?').trim().charAt(0);
    wrap.appendChild(ph);
  }

  if (canUpload) {
    const label = document.createElement('label');
    label.className = 'photo-upload';
    label.title = 'העלאת תמונה';
    label.textContent = row.imageUrl ? 'החלפה' : 'העלאה';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = IMAGE_TYPES.join(',');
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      label.textContent = 'מעלה…';
      wrap.classList.add('busy');
      try {
        await uploadImage(kind, row, file);
        await onDone();
      } catch (err) {
        alert(err.message);
        label.textContent = row.imageUrl ? 'החלפה' : 'העלאה';
      } finally {
        wrap.classList.remove('busy');
        input.value = '';
      }
    });
    label.appendChild(input);
    wrap.appendChild(label);
  }
  return wrap;
}

function render() {
  const { columns } = TABS[activeTab];
  const rows = cache[activeTab] || [];
  const term = $('search').value.trim().toLowerCase();

  const filtered = term
    ? rows.filter(r => columns.some(c => c.value && String(c.value(r) ?? '').toLowerCase().includes(term)))
    : rows;

  $('thead').innerHTML = '';
  const headRow = document.createElement('tr');
  for (const c of columns) {
    const th = document.createElement('th');
    th.textContent = c.label;
    headRow.appendChild(th);
  }
  $('thead').appendChild(headRow);

  const tbody = $('tbody');
  tbody.innerHTML = '';
  for (const r of filtered) {
    const tr = document.createElement('tr');
    if (r.id === highlightId) tr.className = 'new-row';
    for (const c of columns) {
      const td = document.createElement('td');
      if (c.image) {
        td.appendChild(imageCell(c.image, r, { canUpload: true, onDone: () => reloadTab(c.image) }));
        tr.appendChild(td);
        continue;
      }
      const v = c.value(r);
      if (c.className) td.className = c.className;
      if (v === null || v === undefined || v === '') {
        td.textContent = '—';
        td.classList.add('empty');
      } else if (c.badge) {
        const span = document.createElement('span');
        span.className = `badge ${c.badge(r)}`;
        span.textContent = v;
        td.appendChild(span);
      } else {
        td.textContent = v;
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  $('row-count').textContent = `${filtered.length} מתוך ${rows.length}`;
  $('message').textContent = filtered.length ? '' : 'לא נמצאו תוצאות';
  $('message').classList.remove('error');
}

async function showTab(name) {
  activeTab = name;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  const add = ADD_BUTTON[name];
  $('add-btn').hidden = !add;
  if (add) $('add-btn').textContent = add.label;
  $('message').textContent = 'טוען נתונים…';
  try {
    await loadTab(name);
    if (activeTab === name) render();
  } catch (err) {
    showError(err);
  }
}

// Re-fetch one tab after a change (e.g. new photo) and highlight nothing
async function reloadTab(name) {
  delete cache[name];
  if (activeTab === name) await showTab(name);
}

function showError(err) {
  $('tbody').innerHTML = '';
  $('message').textContent = `שגיאה בטעינת הנתונים: ${err.message}`;
  $('message').classList.add('error');
}

async function loadStats() {
  const [customers, restaurants, orders] = await Promise.all([
    loadTab('customers'), loadTab('restaurants'), loadTab('orders'),
  ]);
  const revenue = orders
    .filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + Number(o.total_amount), 0);

  $('stat-customers').textContent = customers.length;
  $('stat-restaurants').textContent = restaurants.length;
  $('stat-orders').textContent = orders.length;
  $('stat-revenue').textContent = money.format(revenue);
}

// ---- Add forms ----

function fillSelect(select, rows) {
  select.innerHTML = '<option value="">בחירה…</option>';
  for (const r of rows) {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.name;
    select.appendChild(opt);
  }
}

async function openAddDialog() {
  const dialog = $(ADD_BUTTON[activeTab].dialog);
  const form = dialog.querySelector('form');
  form.reset();
  form.querySelector('.form-error').textContent = '';
  if (dialog.id === 'order-dialog') {
    try {
      const [customers, restaurants] = await Promise.all([loadTab('customers'), loadTab('restaurants')]);
      fillSelect(form.customer_id, [...customers].sort((a, b) => a.name.localeCompare(b.name, 'he')));
      fillSelect(form.restaurant_id, [...restaurants].sort((a, b) => a.name.localeCompare(b.name, 'he')));
    } catch (err) {
      return showError(err);
    }
  }
  dialog.showModal();
  form.querySelector('input, select').focus();
}

// Empty optional fields are stored as NULL, not as empty strings
function formData(form) {
  const data = {};
  for (const [key, value] of new FormData(form)) data[key] = value.trim() === '' ? null : value.trim();
  return data;
}

async function submitForm(event, table, prepare) {
  event.preventDefault();
  const form = event.target;
  const errorEl = form.querySelector('.form-error');
  const submitBtn = form.querySelector('[type=submit]');
  errorEl.textContent = '';
  submitBtn.disabled = true;
  try {
    const row = await insertRow(table, prepare(formData(form)));
    form.closest('dialog').close();
    // Drop cached data so tables and counters reload with the new row
    for (const key of Object.keys(cache)) delete cache[key];
    highlightId = row.id;
    $('search').value = '';
    await showTab(table);
    loadStats().catch(showError);
  } catch (err) {
    errorEl.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
  }
}

$('customer-form').addEventListener('submit', e => submitForm(e, 'customers', d => d));

$('order-form').addEventListener('submit', e => submitForm(e, 'orders', d => ({
  customer_id: Number(d.customer_id),
  restaurant_id: Number(d.restaurant_id),
  total_amount: Number(d.total_amount),
  status: d.status,
})));

document.querySelectorAll('[data-close]').forEach(b =>
  b.addEventListener('click', () => b.closest('dialog').close()));

$('add-btn').addEventListener('click', openAddDialog);

document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => {
  $('search').value = '';
  highlightId = null;
  showTab(b.dataset.tab);
}));
$('search').addEventListener('input', render);

// ---- Authentication ----

async function onLogin(event) {
  event.preventDefault();
  const form = event.target;
  const errorEl = form.querySelector('.form-error');
  const submitBtn = form.querySelector('[type=submit]');
  errorEl.textContent = '';
  submitBtn.disabled = true;
  const { error } = await sb.auth.signInWithPassword({
    email: form.email.value.trim(),
    password: form.password.value,
  });
  submitBtn.disabled = false;
  if (error) {
    errorEl.textContent = error.code === 'invalid_credentials' ? 'אימייל או סיסמה שגויים' : error.message;
    return;
  }
  form.reset();
}

async function onChangePassword(event) {
  event.preventDefault();
  const form = event.target;
  const errorEl = form.querySelector('.form-error');
  errorEl.textContent = '';
  if (form.password.value !== form.confirm.value) {
    errorEl.textContent = 'הסיסמאות לא תואמות';
    return;
  }
  const { error } = await sb.auth.updateUser({ password: form.password.value });
  if (error) {
    errorEl.textContent = error.code === 'same_password' ? 'הסיסמה החדשה זהה לישנה' : error.message;
    return;
  }
  form.closest('dialog').close();
  alert('הסיסמה עודכנה');
}

// ---- Customer view ----

async function showCustomerView() {
  // RLS returns only this user's own customer row and orders
  const [me] = await fetchRows('customers?select=id,name,email,phone,address,avatar_path');
  if (!me) return false;
  await attachImageUrls('customers', [me]);

  $('customer-name').textContent = me.name;
  $('customer-photo').replaceChildren(
    imageCell('customers', me, { canUpload: true, size: 'large', onDone: showCustomerView }));
  const details = $('customer-details');
  details.innerHTML = '';
  for (const [label, value, ltr] of [['אימייל', me.email, true], ['טלפון', me.phone, true], ['כתובת', me.address]]) {
    const div = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = label;
    dd.textContent = value || '—';
    if (ltr) dd.dir = 'ltr';
    div.append(dt, dd);
    details.appendChild(div);
  }

  const orders = await fetchRows('orders?select=id,created_at,total_amount,status,restaurants(name)&order=created_at.desc');
  const tbody = $('my-orders');
  tbody.innerHTML = '';
  for (const o of orders) {
    const tr = document.createElement('tr');
    const cells = [
      [o.id, 'num'],
      [o.restaurants?.name ?? '—'],
      [dateFmt.format(new Date(o.created_at)), 'ltr'],
      [money.format(o.total_amount), 'num'],
    ];
    for (const [text, cls] of cells) {
      const td = document.createElement('td');
      td.textContent = text;
      if (cls) td.className = cls;
      tr.appendChild(td);
    }
    const td = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `badge ${o.status}`;
    badge.textContent = STATUS_LABELS[o.status] ?? o.status;
    td.appendChild(badge);
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  const total = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + Number(o.total_amount), 0);
  $('my-orders-count').textContent = orders.length;
  $('my-orders-total').textContent = money.format(total);
  $('customer-message').textContent = orders.length ? '' : 'אין עדיין הזמנות';
  return true;
}

// ---- Routing by role ----

const VIEWS = ['login-view', 'app-view', 'customer-view', 'no-access-view'];
function showView(id) {
  for (const v of VIEWS) $(v).hidden = v !== id;
  $('user-bar').hidden = id === 'login-view';
}

// Show the login screen, admin panel or customer view, depending on who is signed in
let shownUserId;
async function applySession(session) {
  const userId = session?.user.id ?? null;
  if (userId === shownUserId) return;
  shownUserId = userId;
  for (const key of Object.keys(cache)) delete cache[key];

  if (session) {
    // app_metadata is set only by the server, so users cannot give themselves a role.
    // This only picks the screen; what data is returned is decided by RLS.
    const isAdmin = session.user.app_metadata?.role === 'admin';
    $('user-email').textContent = session.user.email;
    $('user-role').textContent = isAdmin ? 'מנהל' : 'לקוח';

    if (isAdmin) {
      showView('app-view');
      highlightId = null;
      $('search').value = '';
      showTab('orders');
      loadStats().catch(showError);
      return;
    }
    try {
      showView((await showCustomerView()) ? 'customer-view' : 'no-access-view');
    } catch (err) {
      showView('customer-view');
      $('customer-message').textContent = `שגיאה בטעינת הנתונים: ${err.message}`;
      $('customer-message').classList.add('error');
    }
  } else {
    showView('login-view');
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    $('login-form').email.focus();
  }
}

$('login-form').addEventListener('submit', onLogin);
$('logout-btn').addEventListener('click', () => sb.auth.signOut());
$('password-form').addEventListener('submit', onChangePassword);
$('change-pw-btn').addEventListener('click', () => {
  $('password-form').reset();
  $('password-form').querySelector('.form-error').textContent = '';
  $('password-dialog').showModal();
});

// Fires on page load (existing session), sign-in, sign-out and token refresh
sb.auth.onAuthStateChange((_event, session) => {
  // Defer: calling Supabase inside this callback directly can deadlock
  setTimeout(() => applySession(session), 0);
});
