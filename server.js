const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// Security middleware
app.use(cors({ origin: true, credentials: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=()');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

const failedLogins = {};
const MAX_LOGIN_ATTEMPTS = 3;
const LOGIN_BLOCK_MINUTES = 15;
const otpRequests = {};
const OTP_REQUEST_WINDOW = 10 * 60 * 1000;
const MAX_OTP_REQUESTS = 3;

function getLoginKey(phone, role) {
  return `${phone.trim()}:${role}`;
}

function recordFailedLogin(phone, role) {
  const key = getLoginKey(phone, role);
  const entry = failedLogins[key] || { attempts: 0, blockedUntil: 0 };
  entry.attempts += 1;
  if (entry.attempts >= MAX_LOGIN_ATTEMPTS) {
    entry.blockedUntil = Date.now() + LOGIN_BLOCK_MINUTES * 60 * 1000;
    entry.attempts = 0;
  }
  failedLogins[key] = entry;
}

function clearLoginAttempts(phone, role) {
  delete failedLogins[getLoginKey(phone, role)];
}

function isBlocked(phone, role) {
  const entry = failedLogins[getLoginKey(phone, role)];
  return entry && entry.blockedUntil > Date.now();
}

function getOtpRequestKey(phone, role) {
  return `${phone.trim()}:${role}:otp`;
}

function canSendOtp(phone, role) {
  const key = getOtpRequestKey(phone, role);
  const entry = otpRequests[key] || { count: 0, windowStart: 0 };
  const now = Date.now();
  if (now - entry.windowStart > OTP_REQUEST_WINDOW) {
    return true;
  }
  return entry.count < MAX_OTP_REQUESTS;
}

function recordOtpRequest(phone, role) {
  const key = getOtpRequestKey(phone, role);
  const now = Date.now();
  const entry = otpRequests[key] || { count: 0, windowStart: now };
  if (now - entry.windowStart > OTP_REQUEST_WINDOW) {
    entry.count = 1;
    entry.windowStart = now;
  } else {
    entry.count += 1;
  }
  otpRequests[key] = entry;
}

function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hashPassword(password) {
  return bcrypt.hashSync(sanitizeString(password), 10);
}

function verifyPassword(stored, password) {
  const candidate = sanitizeString(password);
  if (!stored || !candidate) return false;
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    return bcrypt.compareSync(candidate, stored);
  }
  return stored === candidate;
}

// Helper functions for data persistence
function getDataPath(filename) {
  return path.join(__dirname, filename);
}

function loadData(filename) {
  try {
    const filePath = getDataPath(filename);
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

function saveData(filename, data) {
  const filePath = getDataPath(filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function ensureDataFiles() {
  const requiredFiles = ['orders.json', 'messages.json', 'archived-orders.json', 'archived-messages.json', 'otps.json', 'sessions.json', 'admins.json'];
  for (const file of requiredFiles) {
    const filePath = getDataPath(file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '[]');
    }
  }
}

async function saveOrderData(order) {
  saveData('orders.json', orders);
}

async function loadOrdersData() {
  return loadData('orders.json');
}

async function saveMessageData(message) {
  saveData('messages.json', messages);
}

async function loadMessagesData() {
  return loadData('messages.json');
}

async function updateOrderStatus(orderId, status) {
  const order = orders.find((item) => item.id === orderId || item.billId === orderId);
  if (order) {
    order.status = status;
    saveData('orders.json', orders);
  }
}

async function archiveOrder(order, archivedAt, resetMonth) {
  archivedOrders.push({ ...order, archivedAt, resetMonth });
  saveData('archived-orders.json', archivedOrders);
}

async function archiveMessage(message, archivedAt, resetMonth) {
  archivedMessages.push({ ...message, archivedAt, resetMonth });
  saveData('archived-messages.json', archivedMessages);
}

async function clearOrders() {
  orders = [];
  saveData('orders.json', orders);
}

async function clearMessages() {
  messages = [];
  saveData('messages.json', messages);
}

async function loadArchivedOrders() {
  return loadData('archived-orders.json');
}

async function loadArchivedMessages() {
  return loadData('archived-messages.json');
}

async function persistOtp(phone, role, otp, expires) {
  otps = otps.filter((item) => !(item.phone === phone && item.role === role));
  otps.push({ phone, role, otp, expires });
  saveData('otps.json', otps);
}

async function loadOtps() {
  return loadData('otps.json');
}

async function clearOtp(phone, role) {
  otps = otps.filter((item) => !(item.phone === phone && item.role === role));
  saveData('otps.json', otps);
}

async function persistSession(token, phone, role, expires) {
  sessions = sessions.filter((item) => !(item.phone === phone && item.role === role));
  sessions.push({ token, phone, role, expires });
  saveData('sessions.json', sessions);
}

async function loadSessions() {
  return loadData('sessions.json');
}

async function clearSession(token) {
  sessions = sessions.filter((item) => item.token !== token);
  saveData('sessions.json', sessions);
}

async function upsertAdmin(phone, role, password) {
  const existing = admins.find((item) => item.phone === phone && item.role === role);
  if (existing) {
    existing.password = password;
  } else {
    admins.push({ phone, role, password });
  }
  saveData('admins.json', admins);
}

async function loadAdmins() {
  return loadData('admins.json');
}

function upgradePlainPasswords() {
  let updated = false;
  admins = admins.map((admin) => {
    if (admin.password && !admin.password.startsWith('$2')) {
      updated = true;
      return { ...admin, password: hashPassword(admin.password) };
    }
    return { ...admin, password: admin.password || '' };
  });
  if (updated) {
    saveData('admins.json', admins);
  }
}

async function deleteAdmin(phone, role) {
  admins = admins.filter((admin) => !(admin.phone === phone && admin.role === role));
  saveData('admins.json', admins);
}

async function initializeData() {
  ensureDataFiles();
  orders = loadData('orders.json');
  messages = loadData('messages.json');
  archivedOrders = loadData('archived-orders.json');
  archivedMessages = loadData('archived-messages.json');
  otps = loadData('otps.json');
  sessions = loadData('sessions.json');
  admins = loadData('admins.json');
  upgradePlainPasswords();
}

// Persistent storage for orders, messages, otps, sessions, admin accounts, and archived orders
let orders = [];
let messages = [];
let otps = [];
let sessions = [];
let admins = [];
let archivedOrders = [];
let archivedMessages = [];

// Routes
app.get('/health', (req, res) => {
  res.json({ ok: true, status: 'healthy' });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/products', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'products.html'));
});

app.get('/cart', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cart.html'));
});

app.get('/checkout', (req, res) => {
  res.redirect('/billing');
});

app.get('/billing', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'billing.html'));
});

app.get('/contact', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'contact.html'));
});

app.get('/staff-login', (req, res) => {
  res.redirect('/admin-login');
});

app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/manager-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manager-login.html'));
});

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/manager', requireManager, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manager.html'));
});

app.post('/api/login', (req, res) => {
  const phone = sanitizeString(req.body.phone);
  const password = sanitizeString(req.body.password);
  const role = sanitizeString(req.body.role);
  if (!phone || !password || !role) {
    return res.status(400).json({ success:false, error: 'Phone, password, and role are required' });
  }
  if (role !== 'admin' && role !== 'manager') {
    return res.status(400).json({ success:false, error: 'Role must be admin or manager' });
  }

  if (isBlocked(phone, role)) {
    const entry = failedLogins[getLoginKey(phone, role)];
    const retryMinutes = Math.max(1, Math.ceil((entry.blockedUntil - Date.now()) / 60000));
    return res.status(429).json({ success:false, error: `Too many failed login attempts. Try again in ${retryMinutes} minute(s).` });
  }

  const adminUser = admins.find(a => a.phone === phone && a.role === role);
  const passwordOk = adminUser && verifyPassword(adminUser.password || '', password);
  if (!adminUser || !passwordOk) {
    if (adminUser) recordFailedLogin(phone, role);
    return res.status(401).json({ success:false, error: 'Invalid login credentials' });
  }

  clearLoginAttempts(phone, role);
  if (adminUser.password && !adminUser.password.startsWith('$2')) {
    adminUser.password = hashPassword(password);
    saveData('admins.json', admins);
    upsertAdmin(phone, role, adminUser.password).catch(() => {});
  }

  const token = (Date.now().toString(36) + Math.random().toString(36).slice(2,10));
  const expires = Date.now() + 24*60*60*1000;
  sessions = sessions.filter(s => !(s.phone === phone && s.role === role));
  sessions.push({ token, phone, role, expires });
  saveData('sessions.json', sessions);
  persistSession(token, phone, role, expires).catch(() => {});

  try { res.cookie('authToken', token, { httpOnly:true, sameSite:'lax', maxAge:24*60*60*1000 }); } catch(e) {}

  res.json({ success:true, token });
});

// API Routes

app.post('/api/orders/:id/confirm', requireManager, async (req, res) => {
  const order = orders.find(o => o.id === req.params.id || o.billId === req.params.id);
  if (!order) return res.status(404).json({ success:false, error:'Order not found' });

  order.status = 'confirmed';
  saveData('orders.json', orders);
  await updateOrderStatus(order.id, 'confirmed');

  res.json({ success:true, message:'Order confirmed successfully.' });
});

app.post('/api/manager/reset-month', requireManager, async (req, res) => {
  const resetMonth = new Date().toISOString().slice(0, 7);
  const archivedAt = new Date().toLocaleString();
  const snapshotOrders = orders.map(o => ({ ...o }));
  const snapshotMessages = messages.map(m => ({ ...m }));

  for (const order of snapshotOrders) {
    await archiveOrder(order, archivedAt, resetMonth);
  }
  for (const message of snapshotMessages) {
    await archiveMessage(message, archivedAt, resetMonth);
  }

  archivedOrders = [...archivedOrders, ...snapshotOrders.map(o => ({ ...o, archivedAt, resetMonth }))];
  archivedMessages = [...archivedMessages, ...snapshotMessages.map(m => ({ ...m, archivedAt, resetMonth }))];

  orders = [];
  messages = [];
  saveData('orders.json', orders);
  saveData('messages.json', messages);
  saveData('archived-orders.json', archivedOrders);
  saveData('archived-messages.json', archivedMessages);
  await clearOrders();
  await clearMessages();

  res.json({ success:true, message:`Monthly reset complete. ${snapshotOrders.length} orders and ${snapshotMessages.length} messages were archived to local storage.` });
});

app.post('/api/checkout', async (req, res) => {
  const { customerName, phone, rentalDate, rentalTime, duration, pickupLocation, paymentMethod, items, subtotal, deposit, total, subscriptionPlan, subscriptionCost } = req.body;
  
  if (!customerName || !phone || !rentalDate || !rentalTime || !duration || !paymentMethod) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
  const order = {
    id: `BK-${Date.now()}`,
    billId: `BILL-${Date.now()}`,
    invoiceNumber,
    customerName,
    phone,
    rentalDate,
    rentalTime,
    duration: parseInt(duration),
    pickupLocation: pickupLocation || 'Worli Promenade, Mumbai',
    paymentMethod,
    subscriptionPlan: subscriptionPlan || 'one-time',
    subscriptionCost: subscriptionCost || 0,
    items,
    subtotal,
    tax: 0,
    deposit,
    total,
    date: new Date().toLocaleString(),
    status: paymentMethod === 'upi' ? 'upi pending' : 'cash pending'
  };

  orders.push(order);
  saveData('orders.json', orders);

  try {
    await saveOrderData(order);
  } catch (err) {
    console.error('Persistence save failed:', err);
  }
  
  res.json({
    success: true,
    message: 'Booking confirmed successfully!',
    orderId: order.id,
    billId: order.billId,
    invoiceNumber: order.invoiceNumber,
    paymentMethod: order.paymentMethod,
    total: order.total
  });
});

app.post('/api/billing', async (req, res) => {
  const { customerName, phone, email, rentalDate, rentalTime, duration, pickupLocation, paymentMethod, items, subtotal, rentalAmount, deposit, tax, total } = req.body;
  
  if (!customerName || !phone || !rentalDate || !rentalTime || !duration || !paymentMethod) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
  const order = {
    id: `BK-${Date.now()}`,
    billId: `BILL-${Date.now()}`,
    invoiceNumber,
    customerName,
    phone,
    email: email || '',
    rentalDate,
    rentalTime,
    duration: parseInt(duration),
    pickupLocation: pickupLocation || 'Worli Promenade, Mumbai',
    paymentMethod,
    items: items || [],
    subtotal: subtotal || 0,
    rentalAmount: rentalAmount || 0,
    tax: tax || 0,
    deposit: deposit || 500,
    total: total || 0,
    date: new Date().toLocaleString(),
    status: paymentMethod === 'upi' ? 'upi pending' : paymentMethod === 'card' ? 'pending payment' : 'cash pending'
  };

  orders.push(order);
  saveData('orders.json', orders);

  try {
    await saveOrderData(order);
  } catch (err) {
    console.error('Persistence save failed:', err);
  }
  
  res.json({
    success: true,
    message: 'Billing confirmed successfully!',
    orderId: order.id,
    billId: order.billId,
    invoiceNumber: order.invoiceNumber,
    paymentMethod: order.paymentMethod,
    total: order.total,
    status: order.status
  });
});

app.get('/api/billing', requireAuth, (req, res) => {
  res.json(orders.map(o => ({
    id: o.id,
    invoiceNumber: o.invoiceNumber,
    customerName: o.customerName,
    phone: o.phone,
    rentalDate: o.rentalDate,
    rentalTime: o.rentalTime,
    duration: o.duration,
    subtotal: o.subtotal,
    rentalAmount: o.rentalAmount,
    deposit: o.deposit,
    tax: o.tax,
    total: o.total,
    paymentMethod: o.paymentMethod,
    status: o.status,
    date: o.date
  })));
});

app.get('/api/billing/:id', requireAuth, (req, res) => {
  const billing = orders.find(o => o.id === req.params.id || o.billId === req.params.id);
  if (!billing) return res.status(404).json({ error: 'Billing record not found' });
  res.json(billing);
});

// messages API

app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const contactMessage = {
    id: `MSG-${Date.now()}`,
    name,
    email,
    subject,
    message,
    date: new Date().toLocaleString(),
    read: false,
    archived: false
  };

  messages.push(contactMessage);
  saveData('messages.json', messages);
  saveMessageData(contactMessage).catch(() => {});

  res.json({
    success: true,
    message: 'Message received! We will contact you shortly.'
  });
});

// OTP endpoints
const OTP_ALLOW_ANY = process.env.OTP_ALLOW_ANY === 'true';

app.post('/api/send-otp', async (req, res) => {
  const phone = sanitizeString(req.body.phone);
  const role = sanitizeString(req.body.role);
  if (!phone) return res.status(400).json({ success:false, error: 'Phone required' });
  if (!role || (role !== 'admin' && role !== 'manager')) {
    return res.status(400).json({ success:false, error: 'Role must be admin or manager' });
  }

  const normalizedPhone = phone;
  const existingAdmin = admins.find(a => a.phone === normalizedPhone && a.role === role);
  if (!existingAdmin && !OTP_ALLOW_ANY) {
    return res.status(404).json({ success:false, error: 'Account not found for password reset.' });
  }

  if (!canSendOtp(normalizedPhone, role)) {
    return res.status(429).json({ success:false, error: 'Too many OTP requests. Please wait a few minutes before retrying.' });
  }

  const otp = Math.floor(100000 + Math.random()*900000).toString();
  const expires = Date.now() + 5*60*1000;

  otps = otps.filter(o => !(o.phone === normalizedPhone && o.role === role));
  otps.push({ phone: normalizedPhone, role, otp, expires });
  saveData('otps.json', otps);
  persistOtp(normalizedPhone, role, otp, expires).catch(() => {});
  recordOtpRequest(normalizedPhone, role);

  console.log(`OTP for ${role} ${normalizedPhone}: ${otp}`);

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFrom = process.env.TWILIO_FROM;
  if (twilioSid && twilioToken && twilioFrom) {
    try {
      const client = require('twilio')(twilioSid, twilioToken);
      try {
        const msg = await client.messages.create({
          body: `Your ${role} password reset OTP is ${otp}. It expires in 5 minutes.`,
          from: twilioFrom,
          to: normalizedPhone
        });
        console.log('Twilio SMS sent:', msg.sid);
        return res.json({ success:true, message: 'OTP sent via SMS.' });
      } catch (err) {
        console.error('Twilio send failed:', err && err.message ? err.message : err);
        return res.json({ success:true, message: 'OTP generated but SMS send failed; check server logs.' });
      }
    } catch (err) {
      console.error('Twilio module error:', err && err.message ? err.message : err);
      return res.json({ success:true, message: 'OTP generated but Twilio unavailable.' });
    }
  }

  res.json({ success:true, message: 'OTP generated for the phone number you entered. If SMS is not configured, it will be shown here and logged on the server.', otp });
});

app.post('/api/verify-otp', (req, res) => {
  const phone = sanitizeString(req.body.phone);
  const otp = sanitizeString(req.body.otp);
  const role = sanitizeString(req.body.role);
  const password = sanitizeString(req.body.password);
  if (!phone || !otp || !role || !password) {
    return res.status(400).json({ success:false, error: 'Phone, OTP, role, and password are required' });
  }
  if (role !== 'admin' && role !== 'manager') {
    return res.status(400).json({ success:false, error: 'Role must be admin or manager' });
  }

  const normalizedPhone = phone;
  const idx = otps.findIndex(o => o.phone === normalizedPhone && o.role === role);
  if (idx === -1) return res.status(400).json({ success:false, error: 'OTP not found' });
  const entry = otps[idx];
  if (Date.now() > entry.expires) {
    otps.splice(idx,1);
    saveData('otps.json', otps);
    return res.status(400).json({ success:false, error: 'OTP expired' });
  }
  if (entry.otp !== String(otp)) {
    recordFailedLogin(normalizedPhone, role);
    return res.status(400).json({ success:false, error: 'Invalid OTP' });
  }

  const existingAdmin = admins.find(a => a.phone === normalizedPhone && a.role === role);
  const hashedPassword = hashPassword(password);
  if (existingAdmin) {
    existingAdmin.password = hashedPassword;
  } else if (OTP_ALLOW_ANY) {
    admins.push({ phone: normalizedPhone, role, password: hashedPassword });
  } else {
    return res.status(404).json({ success:false, error: 'Account not found for password reset.' });
  }

  saveData('admins.json', admins);
  upsertAdmin(normalizedPhone, role, hashedPassword).catch(() => {});
  clearLoginAttempts(normalizedPhone, role);

  const token = (Date.now().toString(36) + Math.random().toString(36).slice(2,10));
  const expires = Date.now() + 24*60*60*1000;
  sessions = sessions.filter(s => !(s.phone === normalizedPhone && s.role === role));
  sessions.push({ token, phone: normalizedPhone, role, expires });
  saveData('sessions.json', sessions);
  persistSession(token, normalizedPhone, role, expires).catch(() => {});

  otps.splice(idx,1);
  saveData('otps.json', otps);

  try { res.cookie('authToken', token, { httpOnly:true, sameSite:'lax', maxAge:24*60*60*1000 }); } catch(e) {}

  res.json({ success:true, token, message: 'Password reset successfully. You are now signed in.' });
});

function getToken(req) {
  if (req.headers['x-auth-token']) return req.headers['x-auth-token'];
  if (req.query.token) return req.query.token;
  if (req.headers.cookie) {
    const cookie = req.headers.cookie.split(';').find(c=>c.trim().startsWith('authToken='));
    if (cookie) return cookie.split('=')[1];
  }
  return null;
}

app.get('/api/session', (req, res) => {
  const token = getToken(req);
  if (!token) return res.json({ authenticated:false });
  const s = sessions.find(s=>s.token === token && Date.now() < s.expires);
  if (!s) return res.json({ authenticated:false });
  res.json({ authenticated:true, phone:s.phone, role:s.role });
});

function requireManager(req, res, next) {
  const token = getToken(req);
  const s = sessions.find(s=>s.token === token && Date.now() < s.expires);
  if (!s || s.role !== 'manager') {
    return res.status(403).json({ success:false, error: 'Manager access required' });
  }
  req.auth = s;
  next();
}

function requireAuth(req, res, next) {
  const token = getToken(req);
  const s = sessions.find(s=>s.token === token && Date.now() < s.expires);
  if (!s || (s.role !== 'admin' && s.role !== 'manager')) {
    return res.status(403).json({ success:false, error: 'Authentication required' });
  }
  req.auth = s;
  next();
}

app.post('/api/logout', (req, res) => {
  const token = getToken(req);
  if (token) {
    sessions = sessions.filter(s => s.token !== token);
    saveData('sessions.json', sessions);
  }
  try { res.clearCookie('authToken'); } catch (e) {}
  res.json({ success:true, message:'Logged out' });
});

app.get('/logout', (req, res) => {
  const token = getToken(req);
  if (token) {
    sessions = sessions.filter(s => s.token !== token);
    saveData('sessions.json', sessions);
  }
  try { res.clearCookie('authToken'); } catch (e) {}
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Logged out</title></head><body><script>localStorage.removeItem('cycleride-token'); window.location.href = '/';</script><noscript>Logged out. <a href="/">Continue</a></noscript></body></html>`);
});

app.get('/api/admins', requireManager, (req,res)=>{
  res.json({ success:true, admins });
});

app.post('/api/admins', requireManager, (req,res)=>{
  const { phone, role } = req.body;
  if (!phone || !role || (role !== 'admin' && role !== 'manager')) return res.status(400).json({ success:false, error:'Phone and valid role required'});
  const normalizedPhone = phone.trim();
  if (admins.some(a=>a.phone===normalizedPhone && a.role===role)) return res.status(400).json({ success:false, error:'Admin already exists'});
  admins.push({ phone: normalizedPhone, role });
  saveData('admins.json', admins);
  upsertAdmin(normalizedPhone, role, '').catch(() => {});
  res.json({ success:true, admins });
});

app.delete('/api/admins/:phone', requireManager, (req,res)=>{
  const phone = req.params.phone.trim();
  const before = admins.length;
  admins = admins.filter(a=>a.phone!==phone);
  if (admins.length === before) return res.status(404).json({ success:false, error:'Admin not found'});
  saveData('admins.json', admins);
  sessions = sessions.filter(s=>s.phone!==phone);
  saveData('sessions.json', sessions);
  deleteAdmin(phone, req.body.role || 'admin').catch(() => {});
  res.json({ success:true, admins });
});

// Confirm an order (update status)
app.post('/api/orders/confirm', requireAuth, (req, res) => {
  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: 'Missing orderId' });

  const idx = orders.findIndex(o => o.id === orderId || o.billId === orderId);
  if (idx === -1) return res.status(404).json({ error: 'Order not found' });

  orders[idx].status = 'confirmed';
  saveData('orders.json', orders);
  // send email notification if SMTP configured
  const order = orders[idx];
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpPort && smtpUser && smtpPass && order.email) {
    let transporter = null;
    try {
      const nodemailer = require('nodemailer');
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        secure: smtpPort == 465,
        auth: { user: smtpUser, pass: smtpPass }
      });
    } catch (err) {
      console.error('nodemailer not available; skipping email send.');
    }

    if (transporter) {
      const mailOptions = {
        from: smtpUser,
        to: order.email,
        subject: `Your booking ${order.id} is confirmed`,
        text: `Hello ${order.customerName},\n\nYour booking ${order.id} has been confirmed. Total: ₹${order.total}.\n\nThank you!`
      };
      transporter.sendMail(mailOptions).catch(err => console.error('Email send failed:', err));
    }
  }

  res.json({ success: true, message: 'Order confirmed', order: orders[idx] });
});

app.get('/api/orders', requireAuth, (req, res) => {
  res.json(orders);
});

app.get('/api/orders/archived', requireAuth, (req, res) => {
  res.json(archivedOrders);
});

app.post('/api/orders/archive', requireAuth, (req, res) => {
  const toArchive = orders.filter(o => o.status === 'confirmed');
  if (toArchive.length === 0) {
    return res.json({ success:true, message:'No confirmed orders to archive.', archived: [] });
  }
  archivedOrders = archivedOrders.concat(toArchive);
  orders = orders.filter(o => o.status !== 'confirmed');
  saveData('orders.json', orders);
  saveData('archived-orders.json', archivedOrders);
  res.json({ success:true, message:`Archived ${toArchive.length} completed order(s).`, archived: toArchive });
});

app.post('/api/orders/clear', requireAuth, (req, res) => {
  const before = orders.length;
  orders = [];
  saveData('orders.json', orders);
  res.json({ success:true, message:`Cleared ${before} current order(s).` });
});

app.get('/api/messages', requireAuth, (req, res) => {
  res.json(messages.filter(msg => !msg.archived));
});

app.get('/api/messages/archived', requireAuth, (req, res) => {
  res.json(archivedMessages);
});

app.post('/api/messages/:id/read', requireAuth, (req, res) => {
  const id = req.params.id;
  const msg = messages.find(m => m.id === id);
  if (!msg) return res.status(404).json({ success:false, error:'Message not found' });
  msg.read = true;
  saveData('messages.json', messages);
  res.json({ success:true, message:'Message marked as read', msg });
});

app.post('/api/messages/:id/archive', requireAuth, (req, res) => {
  const id = req.params.id;
  const idx = messages.findIndex(m => m.id === id);
  if (idx === -1) return res.status(404).json({ success:false, error:'Message not found' });
  const [archived] = messages.splice(idx, 1);
  archived.archived = true;
  archivedMessages.push(archived);
  saveData('messages.json', messages);
  saveData('archived-messages.json', archivedMessages);
  res.json({ success:true, message:'Message archived', archived });
});

async function startServer(port) {
  let activePort = port;
  while (true) {
    try {
      await initializeData();
      console.log('✅ Local JSON storage initialized');
      await new Promise((resolve, reject) => {
        const server = app.listen(activePort, () => {
          console.log(`🚴 Cycling Brand Website running at http://localhost:${activePort}`);
          console.log(`Open site: http://localhost:${activePort}`);
          console.log(`Admin login: http://localhost:${activePort}/admin-login`);
          console.log(`Manager login: http://localhost:${activePort}/manager-login`);
          console.log(`Products: http://localhost:${activePort}/products`);
          console.log(`Contact: http://localhost:${activePort}/contact`);
          resolve(server);
        });
        server.on('error', (err) => {
          reject(err);
        });
      });
      break;
    } catch (err) {
      if (err.code === 'EADDRINUSE' && activePort === port) {
        console.warn(`Port ${activePort} is already in use; trying port ${activePort + 1} instead.`);
        activePort += 1;
      } else {
        console.error('Server failed to start:', err.message || err);
        process.exit(1);
      }
    }
  }
}

startServer(PORT);
