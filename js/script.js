import { firebaseConfig, adminDocPath } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const navbar = document.getElementById('mainNavbar');
const navLinks = document.querySelectorAll('.nav-link');
const bookingForm = document.getElementById('bookingForm');
const formAlert = document.getElementById('formAlert');
const year = document.getElementById('year');

window.addEventListener('scroll', () => {
  if (navbar) navbar.classList.toggle('navbar-scrolled', window.scrollY > 60);
});

navLinks.forEach(link => {
  link.addEventListener('click', () => {
    const navbarCollapse = document.querySelector('.navbar-collapse');
    if (navbarCollapse && navbarCollapse.classList.contains('show') && window.bootstrap) {
      new bootstrap.Collapse(navbarCollapse).hide();
    }
  });
});

if (bookingForm) bookingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  formAlert.className = 'alert d-none mb-0';

  if (bookingForm.action.includes('YOUR_FORM_ID')) {
    formAlert.textContent = 'Vendos Formspree Form ID te action="https://formspree.io/f/YOUR_FORM_ID".';
    formAlert.classList.remove('d-none');
    formAlert.classList.add('alert-warning');
    return;
  }

  const submitButton = bookingForm.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = 'Duke dërguar...';

  try {
    const response = await fetch(bookingForm.action, {
      method: 'POST',
      body: new FormData(bookingForm),
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) throw new Error('Formspree error');

    formAlert.textContent = 'Faleminderit! Rezervimi u dërgua me sukses.';
    formAlert.classList.remove('d-none');
    formAlert.classList.add('alert-success');
    bookingForm.reset();
  } catch (error) {
    formAlert.textContent = 'Nuk u dërgua. Kontrollo Formspree endpoint ose internetin.';
    formAlert.classList.remove('d-none');
    formAlert.classList.add('alert-danger');
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalText;
    setTimeout(() => formAlert.classList.add('d-none'), 6000);
  }
});

if (year) year.textContent = new Date().getFullYear();

// =========================
// Admin Panel - Firebase cloud auth
// =========================
const adminOpenBtn = document.getElementById('adminOpenBtn');
const adminCloseBtn = document.getElementById('adminCloseBtn');
const adminPanel = document.getElementById('adminPanel');
const adminBackdrop = document.getElementById('adminBackdrop');
const adminSaveBtn = document.getElementById('adminSaveBtn');
const adminResetBtn = document.getElementById('adminResetBtn');
const adminExportBtn = document.getElementById('adminExportBtn');
const adminAlert = document.getElementById('adminAlert');
const exportCode = document.getElementById('exportCode');
const exportModalElement = document.getElementById('exportModal');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminEmail = document.getElementById('adminEmail');
const adminPassword = document.getElementById('adminPassword');
const adminSecureContent = document.getElementById('adminSecureContent');
const adminCloudStatus = document.getElementById('adminCloudStatus');
const adminUserEmail = document.getElementById('adminUserEmail');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');

const adminDefaults = getAdminDefaults();
const firebaseReady = firebaseConfig?.apiKey && !firebaseConfig.apiKey.includes('PASTE_');
let auth = null;
let db = null;
let settingsRef = null;
let currentAdminData = { ...adminDefaults };
let unsubscribeSettings = null;

if (firebaseReady) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  settingsRef = doc(db, ...adminDocPath.split('/'));
  if (adminCloudStatus) adminCloudStatus.textContent = 'Cloud gati. Kyçu për të ndryshuar website-in.';
} else {
  if (adminCloudStatus) adminCloudStatus.innerHTML = 'Vendos Firebase config te <code>js/firebase-config.js</code> për login me cloud.';
}

function getAdminDefaults() {
  const data = {};
  document.querySelectorAll('[data-admin-text]').forEach((element) => {
    data[element.dataset.adminText] = element.textContent.trim();
  });
  document.querySelectorAll('[data-admin-link]').forEach((element) => {
    data[element.dataset.adminLink] = element.getAttribute('href');
  });
  document.querySelectorAll('[data-admin-image]').forEach((element) => {
    data[element.dataset.adminImage] = element.getAttribute('src');
  });
  data.gold = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#d4a65a';
  data.goldDark = getComputedStyle(document.documentElement).getPropertyValue('--gold-dark').trim() || '#b9893b';
  data.softDark = getComputedStyle(document.documentElement).getPropertyValue('--soft-dark').trim() || '#1d1d21';
  return data;
}

function applyAdminData(data) {
  Object.entries(data).forEach(([key, value]) => {
    const textElement = document.querySelector(`[data-admin-text="${key}"]`);
    const linkElement = document.querySelector(`[data-admin-link="${key}"]`);
    const imageElement = document.querySelector(`[data-admin-image="${key}"]`);
    if (textElement) textElement.textContent = value;
    if (linkElement) linkElement.setAttribute('href', value);
    if (imageElement && value) imageElement.setAttribute('src', value);
  });

  if (data.gold) document.documentElement.style.setProperty('--gold', data.gold);
  if (data.goldDark) document.documentElement.style.setProperty('--gold-dark', data.goldDark);
  if (data.softDark) document.documentElement.style.setProperty('--soft-dark', data.softDark);
}

function fillAdminInputs(data) {
  document.querySelectorAll('[data-admin-input]').forEach((input) => {
    input.value = data[input.dataset.key] || '';
  });
}

function collectAdminInputs() {
  const data = { ...currentAdminData };
  document.querySelectorAll('[data-admin-input]').forEach((input) => {
    data[input.dataset.key] = input.value.trim();
  });
  return data;
}

function showAdminMessage(message, type = 'success') {
  adminAlert.textContent = message;
  adminAlert.classList.remove('d-none');
  adminAlert.style.background = type === 'danger' ? 'rgba(220,53,69,0.18)' : 'rgba(25,135,84,0.18)';
  adminAlert.style.borderColor = type === 'danger' ? 'rgba(220,53,69,0.35)' : 'rgba(25,135,84,0.35)';
  setTimeout(() => adminAlert.classList.add('d-none'), 4200);
}

function openAdminPanel() {
  fillAdminInputs(currentAdminData);
  adminPanel.classList.add('show');
  adminBackdrop.classList.add('show');
  adminPanel.setAttribute('aria-hidden', 'false');
  adminBackdrop.setAttribute('aria-hidden', 'false');
}

function closeAdminPanel() {
  adminPanel.classList.remove('show');
  adminBackdrop.classList.remove('show');
  adminPanel.setAttribute('aria-hidden', 'true');
  adminBackdrop.setAttribute('aria-hidden', 'true');
}

function toggleAdminPanel() {
  if (adminPanel.classList.contains('show')) closeAdminPanel();
  else openAdminPanel();
}

function setAdminLoggedIn(user) {
  const loggedIn = Boolean(user);
  adminLoginForm.classList.toggle('d-none', loggedIn);
  adminSecureContent.classList.toggle('d-none', !loggedIn);
  if (user) adminUserEmail.textContent = user.email;
}

function listenToCloudSettings() {
  if (!settingsRef) return;
  if (unsubscribeSettings) unsubscribeSettings();
  unsubscribeSettings = onSnapshot(settingsRef, (snapshot) => {
    const cloudData = snapshot.exists() ? snapshot.data() : {};
    currentAdminData = { ...adminDefaults, ...cloudData };
    applyAdminData(currentAdminData);
    fillAdminInputs(currentAdminData);
  }, () => {
    adminCloudStatus.textContent = 'Nuk u lexuan të dhënat nga Firestore. Kontrollo rules/config.';
  });
}

function cleanHtmlForExport() {
  const clone = document.documentElement.cloneNode(true);
  clone.querySelectorAll('.admin-panel, .admin-panel-backdrop, .admin-open-btn, #exportModal').forEach((element) => element.remove());
  clone.querySelectorAll('[data-admin-text]').forEach((element) => element.removeAttribute('data-admin-text'));
  clone.querySelectorAll('[data-admin-link]').forEach((element) => element.removeAttribute('data-admin-link'));
  clone.querySelectorAll('[data-admin-image]').forEach((element) => element.removeAttribute('data-admin-image'));
  clone.querySelectorAll('.navbar-collapse.show').forEach((element) => element.classList.remove('show'));
  return '<!DOCTYPE html>\n' + clone.outerHTML;
}

applyAdminData(currentAdminData);
fillAdminInputs(currentAdminData);

if (firebaseReady) {
  onAuthStateChanged(auth, async (user) => {
    setAdminLoggedIn(user);
    if (user) {
      adminCloudStatus.textContent = 'I kyçur. Ndryshimet ruhen në cloud.';
      const snapshot = await getDoc(settingsRef);
      currentAdminData = { ...adminDefaults, ...(snapshot.exists() ? snapshot.data() : {}) };
      applyAdminData(currentAdminData);
      fillAdminInputs(currentAdminData);
      listenToCloudSettings();
    } else {
      if (adminCloudStatus) adminCloudStatus.textContent = 'Cloud gati. Kyçu për të ndryshuar website-in.';
      if (unsubscribeSettings) unsubscribeSettings();
      unsubscribeSettings = null;
    }
  });
}

if (adminOpenBtn) adminOpenBtn.addEventListener('click', openAdminPanel);
if (adminCloseBtn) adminCloseBtn.addEventListener('click', closeAdminPanel);
if (adminBackdrop) adminBackdrop.addEventListener('click', closeAdminPanel);

document.addEventListener('keydown', (event) => {
  const activeTag = document.activeElement.tagName.toLowerCase();
  const isTyping = ['input', 'textarea', 'select'].includes(activeTag);
  if (event.key === '/' && !isTyping) {
    event.preventDefault();
    toggleAdminPanel();
  }
  if (event.key === 'Escape' && adminPanel.classList.contains('show')) closeAdminPanel();
});

document.querySelectorAll('[data-admin-input]').forEach((input) => {
  input.addEventListener('input', () => applyAdminData(collectAdminInputs()));
});

if (adminLoginForm) adminLoginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!firebaseReady) {
    showAdminMessage('Së pari vendos Firebase config te js/firebase-config.js.', 'danger');
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, adminEmail.value.trim(), adminPassword.value);
    adminPassword.value = '';
    showAdminMessage('U kyçe me sukses.');
  } catch (error) {
    showAdminMessage('Email ose password gabim, ose Firebase nuk është konfiguruar mirë.', 'danger');
  }
});

if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', async () => {
  if (auth) await signOut(auth);
  showAdminMessage('Dole nga admin paneli.');
});

if (adminSaveBtn) 

document.querySelectorAll('[data-file-target]').forEach((fileInput) => {
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showAdminMessage('Zgjidh vetëm foto.', 'danger');
      fileInput.value = '';
      return;
    }

    if (file.size > 850 * 1024) {
      showAdminMessage('Fotoja është shumë e madhe. Përdor foto nën 850KB ose vendos URL të fotos.', 'danger');
      fileInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const key = fileInput.dataset.fileTarget;
      const input = document.querySelector(`[data-admin-input][data-key="${key}"]`);
      if (input) {
        input.value = reader.result;
        applyAdminData(collectAdminInputs());
        showAdminMessage('Fotoja u vendos. Kliko "Ruaj në Cloud".');
      }
    };
    reader.readAsDataURL(file);
  });
});

if (adminSaveBtn) adminSaveBtn.addEventListener('click', async () => {
  if (!auth?.currentUser) {
    showAdminMessage('Duhet të kyçesh si admin.', 'danger');
    return;
  }
  const data = collectAdminInputs();
  try {
    await setDoc(settingsRef, data, { merge: true });
    currentAdminData = data;
    applyAdminData(data);
    showAdminMessage('Ndryshimet u ruajtën në cloud.');
  } catch (error) {
    showAdminMessage('Nuk u ruajtën. Kontrollo Firestore rules.', 'danger');
  }
});

if (adminResetBtn) adminResetBtn.addEventListener('click', async () => {
  if (!auth?.currentUser) {
    showAdminMessage('Duhet të kyçesh si admin.', 'danger');
    return;
  }
  if (!confirm('A je i sigurt që dëshiron reset nga cloud?')) return;
  try {
    await deleteDoc(settingsRef);
    currentAdminData = { ...adminDefaults };
    applyAdminData(currentAdminData);
    fillAdminInputs(currentAdminData);
    showAdminMessage('U kthye në versionin fillestar.');
  } catch (error) {
    showAdminMessage('Reset nuk u krye. Kontrollo Firestore rules.', 'danger');
  }
});

if (adminExportBtn) adminExportBtn.addEventListener('click', () => {
  exportCode.value = cleanHtmlForExport();
  const modal = new bootstrap.Modal(exportModalElement);
  modal.show();
  exportCode.select();
});
