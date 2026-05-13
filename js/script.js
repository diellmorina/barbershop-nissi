import { firebaseConfig, adminDocPath } from './firebase-config.js';
import { cloudinaryConfig } from './cloudinary-config.js';
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
  onSnapshot,
  serverTimestamp
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

if (bookingForm) {
  bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!formAlert) return;

    formAlert.className = 'alert d-none mb-0';

    const submitButton = bookingForm.querySelector('button[type="submit"]');
    const originalText = submitButton?.textContent || 'Dërgo';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Duke dërguar...';
    }

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
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
      setTimeout(() => formAlert.classList.add('d-none'), 6000);
    }
  });
}

if (year) year.textContent = new Date().getFullYear();

// =========================
// Admin Panel: Firebase + Cloudinary only
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
const firebaseReady = Boolean(firebaseConfig?.apiKey && !firebaseConfig.apiKey.includes('PASTE_'));

let auth = null;
let db = null;
let settingsRef = null;
let currentAdminData = { ...adminDefaults };
let unsubscribeSettings = null;

function setCloudStatus(message) {
  if (adminCloudStatus) adminCloudStatus.textContent = message;
}

function showAdminMessage(message, type = 'success') {
  if (!adminAlert) {
    alert(message);
    return;
  }

  adminAlert.textContent = message;
  adminAlert.classList.remove('d-none');
  adminAlert.style.background = type === 'danger' ? 'rgba(220,53,69,0.18)' : 'rgba(25,135,84,0.18)';
  adminAlert.style.borderColor = type === 'danger' ? 'rgba(220,53,69,0.35)' : 'rgba(25,135,84,0.35)';
  setTimeout(() => adminAlert.classList.add('d-none'), 6500);
}

function firebaseErrorText(error) {
  const code = error?.code || 'error';
  const message = error?.message || 'Pa mesazh gabimi.';
  return `${code}: ${message}`;
}

try {
  if (firebaseReady) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    settingsRef = doc(db, ...adminDocPath.split('/'));
    setCloudStatus('Cloud gati. Kyçu për të ndryshuar website-in.');
  } else {
    setCloudStatus('Vendos Firebase config te js/firebase-config.js.');
  }
} catch (error) {
  setCloudStatus('Firebase nuk u inicializua. Kontrollo config.');
  showAdminMessage(firebaseErrorText(error), 'danger');
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
  Object.entries(data || {}).forEach(([key, value]) => {
    if (typeof value !== 'string') return;

    const textElement = document.querySelector(`[data-admin-text="${key}"]`);
    const linkElement = document.querySelector(`[data-admin-link="${key}"]`);
    const imageElement = document.querySelector(`[data-admin-image="${key}"]`);

    if (textElement) textElement.textContent = value;
    if (linkElement) linkElement.setAttribute('href', value);
    if (imageElement && value) imageElement.setAttribute('src', value);
  });

  if (data?.gold) document.documentElement.style.setProperty('--gold', data.gold);
  if (data?.goldDark) document.documentElement.style.setProperty('--gold-dark', data.goldDark);
  if (data?.softDark) document.documentElement.style.setProperty('--soft-dark', data.softDark);
}

function fillAdminInputs(data) {
  document.querySelectorAll('[data-admin-input]').forEach((input) => {
    input.value = data?.[input.dataset.key] || '';
  });
}

function collectAdminInputs() {
  const data = { ...currentAdminData };
  document.querySelectorAll('[data-admin-input]').forEach((input) => {
    data[input.dataset.key] = input.value.trim();
  });
  return data;
}

function openAdminPanel() {
  if (!adminPanel || !adminBackdrop) return;
  fillAdminInputs(currentAdminData);
  adminPanel.classList.add('show');
  adminBackdrop.classList.add('show');
  adminPanel.setAttribute('aria-hidden', 'false');
  adminBackdrop.setAttribute('aria-hidden', 'false');
}

function closeAdminPanel() {
  if (!adminPanel || !adminBackdrop) return;
  adminPanel.classList.remove('show');
  adminBackdrop.classList.remove('show');
  adminPanel.setAttribute('aria-hidden', 'true');
  adminBackdrop.setAttribute('aria-hidden', 'true');
}

function toggleAdminPanel() {
  if (adminPanel?.classList.contains('show')) closeAdminPanel();
  else openAdminPanel();
}

function setAdminLoggedIn(user) {
  const loggedIn = Boolean(user);
  if (adminLoginForm) adminLoginForm.classList.toggle('d-none', loggedIn);
  if (adminSecureContent) adminSecureContent.classList.toggle('d-none', !loggedIn);
  if (user && adminUserEmail) adminUserEmail.textContent = user.email;
}

function listenToCloudSettings() {
  if (!settingsRef) return;
  if (unsubscribeSettings) unsubscribeSettings();

  unsubscribeSettings = onSnapshot(settingsRef, (snapshot) => {
    const cloudData = snapshot.exists() ? snapshot.data() : {};
    currentAdminData = { ...adminDefaults, ...cloudData };
    applyAdminData(currentAdminData);
    fillAdminInputs(currentAdminData);
    setCloudStatus(auth?.currentUser ? 'I kyçur. Të dhënat u lexuan nga Firestore.' : 'Cloud gati.');
  }, (error) => {
    setCloudStatus('Nuk u lexuan të dhënat nga Firestore.');
    showAdminMessage(`Leximi nga cloud dështoi: ${firebaseErrorText(error)}`, 'danger');
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

function isCloudinaryReady() {
  return Boolean(
    cloudinaryConfig?.cloudName &&
    cloudinaryConfig?.uploadPreset &&
    cloudinaryConfig.cloudName !== 'YOUR_CLOUD_NAME' &&
    cloudinaryConfig.uploadPreset !== 'YOUR_UNSIGNED_UPLOAD_PRESET'
  );
}

async function uploadImageToCloudinary(file, key) {
  if (!isCloudinaryReady()) {
    throw new Error('Plotëso js/cloudinary-config.js me cloudName dhe unsigned uploadPreset.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryConfig.uploadPreset);

  if (cloudinaryConfig.folder) {
    formData.append('folder', cloudinaryConfig.folder);
  }

  formData.append('tags', `frizer-nissi,portfolio,${key}`);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`;
  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result?.error?.message || 'Cloudinary upload dështoi.');
  }

  return result.secure_url;
}

async function saveAdminData(data, successMessage = 'Ndryshimet u ruajtën në Firestore.') {
  if (!auth?.currentUser) {
    showAdminMessage('Duhet të kyçesh si admin.', 'danger');
    return false;
  }

  if (!settingsRef) {
    showAdminMessage('Firestore nuk është gati. Kontrollo Firebase config.', 'danger');
    return false;
  }

  try {
    await setDoc(settingsRef, {
      ...data,
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.email || ''
    }, { merge: true });

    currentAdminData = { ...currentAdminData, ...data };
    applyAdminData(currentAdminData);
    fillAdminInputs(currentAdminData);
    showAdminMessage(successMessage);
    setCloudStatus('U ruajt në Firestore.');
    return true;
  } catch (error) {
    showAdminMessage(`Nuk u ruajt: ${firebaseErrorText(error)}`, 'danger');
    setCloudStatus('Ruajtja dështoi. Kontrollo Firestore Rules.');
    return false;
  }
}

applyAdminData(currentAdminData);
fillAdminInputs(currentAdminData);

if (firebaseReady && auth) {
  onAuthStateChanged(auth, async (user) => {
    setAdminLoggedIn(user);

    if (user) {
      setCloudStatus('I kyçur. Duke lexuar të dhënat...');
      try {
        const snapshot = await getDoc(settingsRef);
        currentAdminData = { ...adminDefaults, ...(snapshot.exists() ? snapshot.data() : {}) };
        applyAdminData(currentAdminData);
        fillAdminInputs(currentAdminData);
        listenToCloudSettings();
      } catch (error) {
        setCloudStatus('Login OK, por leximi nga Firestore dështoi.');
        showAdminMessage(`Firestore read error: ${firebaseErrorText(error)}`, 'danger');
      }
    } else {
      setCloudStatus('Cloud gati. Kyçu për të ndryshuar website-in.');
      if (unsubscribeSettings) unsubscribeSettings();
      unsubscribeSettings = null;
    }
  });
}

if (adminOpenBtn) adminOpenBtn.addEventListener('click', openAdminPanel);
if (adminCloseBtn) adminCloseBtn.addEventListener('click', closeAdminPanel);
if (adminBackdrop) adminBackdrop.addEventListener('click', closeAdminPanel);

document.addEventListener('keydown', (event) => {
  const activeTag = document.activeElement?.tagName?.toLowerCase();
  const isTyping = ['input', 'textarea', 'select'].includes(activeTag);

  if (event.key === '/' && !isTyping) {
    event.preventDefault();
    toggleAdminPanel();
  }

  if (event.key === 'Escape' && adminPanel?.classList.contains('show')) {
    closeAdminPanel();
  }
});

document.querySelectorAll('[data-admin-input]').forEach((input) => {
  input.addEventListener('input', () => {
    applyAdminData(collectAdminInputs());
  });
});

document.querySelectorAll('[data-file-target]').forEach((fileInput) => {
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    if (!auth?.currentUser) {
      showAdminMessage('Kyçu si admin para se të upload-osh foto.', 'danger');
      fileInput.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      showAdminMessage('Zgjidh vetëm foto.', 'danger');
      fileInput.value = '';
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      showAdminMessage('Fotoja është shumë e madhe. Përdor foto nën 8MB.', 'danger');
      fileInput.value = '';
      return;
    }

    const key = fileInput.dataset.fileTarget;

    try {
      showAdminMessage('Duke upload-uar foton në Cloudinary...');
      const url = await uploadImageToCloudinary(file, key);

      const input = document.querySelector(`[data-admin-input][data-key="${key}"]`);
      if (input) input.value = url;

      await saveAdminData({ [key]: url }, 'Fotoja u upload-ua në Cloudinary dhe u ruajt në Firestore.');
    } catch (error) {
      showAdminMessage(`Upload dështoi: ${error.message}`, 'danger');
      setCloudStatus('Upload dështoi. Kontrollo Cloudinary config.');
    } finally {
      fileInput.value = '';
    }
  });
});

if (adminLoginForm) {
  adminLoginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!firebaseReady || !auth) {
      showAdminMessage('Kontrollo Firebase config.', 'danger');
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, adminEmail.value.trim(), adminPassword.value);
      adminPassword.value = '';
      showAdminMessage('U kyçe me sukses.');
    } catch (error) {
      showAdminMessage(`Login dështoi: ${firebaseErrorText(error)}`, 'danger');
    }
  });
}

if (adminLogoutBtn) {
  adminLogoutBtn.addEventListener('click', async () => {
    if (auth) await signOut(auth);
    showAdminMessage('Dole nga admin paneli.');
  });
}

if (adminSaveBtn) {
  adminSaveBtn.addEventListener('click', async () => {
    const data = collectAdminInputs();
    await saveAdminData(data);
  });
}

if (adminResetBtn) {
  adminResetBtn.addEventListener('click', async () => {
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
      showAdminMessage(`Reset nuk u krye: ${firebaseErrorText(error)}`, 'danger');
    }
  });
}

if (adminExportBtn) {
  adminExportBtn.addEventListener('click', () => {
    if (!exportCode || !exportModalElement || !window.bootstrap) return;
    exportCode.value = cleanHtmlForExport();
    const modal = new bootstrap.Modal(exportModalElement);
    modal.show();
    exportCode.select();
  });
}
