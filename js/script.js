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
const loadingScreen = document.getElementById('loadingScreen');
const loadingBarFill = document.getElementById('loadingBarFill');
const loadingPercent = document.getElementById('loadingPercent');

function startLoadingScreen() {
  if (!loadingScreen || !loadingBarFill || !loadingPercent) return;

  const duration = 2000;
  const startTime = performance.now();

  const animate = (currentTime) => {
    const progress = Math.min(100, ((currentTime - startTime) / duration) * 100);
    loadingBarFill.style.width = `${progress}%`;
    loadingPercent.textContent = `${Math.round(progress)}%`;

    if (progress < 100) {
      requestAnimationFrame(animate);
    } else {
      loadingScreen.classList.add('is-hidden');
      setTimeout(() => loadingScreen.remove(), 400);
    }
  };

  requestAnimationFrame(animate);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startLoadingScreen);
} else {
  startLoadingScreen();
}

function updateNavbarHoursStatus() {
  const statusEl = document.getElementById('navbarHoursStatus');
  const statusText = statusEl?.querySelector('.navbar-status-text');

  if (!statusEl || !statusText) return;

  const now = new Date();
  const day = now.getDay();
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();
  const openingMinutes = 9 * 60;
  const closingMinutes = 20 * 60;
  const isOpen = day >= 1 && day <= 6 && currentMinutes >= openingMinutes && currentMinutes < closingMinutes;

  statusEl.classList.toggle('open', isOpen);
  statusEl.classList.toggle('closed', !isOpen);
  statusText.textContent = isOpen ? 'Open' : 'Closed';
}

updateNavbarHoursStatus();
setInterval(updateNavbarHoursStatus, 60000);
window.addEventListener('focus', updateNavbarHoursStatus);

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

    const date = bookingForm.elements['data']?.value;
    const time = bookingForm.elements['ora']?.value;

    if (!date || !time) {
      formAlert.textContent = 'Zgjidhni datën dhe orën për rezervimin.';
      formAlert.classList.remove('d-none');
      formAlert.classList.add('alert-danger');
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
      }
      return;
    }

    try {
      if (!db) {
        throw new Error('Firestore nuk është i gatshëm. Kontrollo Firebase konfigurimin.');
      }

      const bookingId = `${date}_${time}`;
      const bookingRef = doc(db, 'bookings', bookingId);
      const bookingSnapshot = await getDoc(bookingRef);

      if (bookingSnapshot.exists()) {
        formAlert.textContent = 'Kjo kohë është e zënë. Zgjidh një kohë tjetër, ju lutem.';
        formAlert.classList.remove('d-none');
        formAlert.classList.add('alert-danger');
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
        return;
      }

      await setDoc(bookingRef, {
        emri: bookingForm.elements['emri']?.value.trim() || '',
        telefoni: bookingForm.elements['telefoni']?.value.trim() || '',
        sherbimi: bookingForm.elements['sherbimi']?.value || '',
        data: date,
        ora: time,
        mesazhi: bookingForm.elements['mesazhi']?.value.trim() || '',
        createdAt: serverTimestamp()
      });

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
      formAlert.textContent = error.message || 'Nuk u dërgua. Kontrollo Formspree endpoint ose internetin.';
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

const installAppModalElement = document.getElementById('installAppModal');
const installAppModal = installAppModalElement ? new bootstrap.Modal(installAppModalElement) : null;
const isIosDevice = /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const installAppButtons = document.querySelectorAll('#installAppButton, [data-install-app]');
let deferredInstallPrompt = null;

function setInstallButtonsHidden(hidden) {
  installAppButtons.forEach((button) => {
    button.hidden = hidden;
  });
}

function setInstallInstructions() {
  const stepOne = document.getElementById('installStepOne');
  const stepTwo = document.getElementById('installStepTwo');
  const stepThree = document.getElementById('installStepThree');
  const intro = document.getElementById('installAppIntro');

  if (isIosDevice) return;

  if (intro) intro.textContent = 'Hap menynë e shfletuesit dhe zgjidh opsionin për ta instaluar ose shtuar faqen në ekranin kryesor.';
  if (stepOne) stepOne.textContent = 'Prek menynë e shfletuesit (zakonisht ⋮ ose Share).';
  if (stepTwo) stepTwo.textContent = 'Zgjidh “Install app” ose “Add to Home screen”.';
  if (stepThree) stepThree.textContent = 'Konfirmo duke prekur “Install” ose “Add”.';
}

function openInstallInstructions() {
  setInstallInstructions();
  installAppModal?.show();
}

async function installApp() {
  if (!deferredInstallPrompt) {
    openInstallInstructions();
    return;
  }

  const installPrompt = deferredInstallPrompt;
  deferredInstallPrompt = null;

  try {
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallButtonsHidden(true);
  } catch (error) {
    console.error('App installation prompt failed:', error);
    openInstallInstructions();
  }
}

if (isStandalone) setInstallButtonsHidden(true);

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  setInstallButtonsHidden(true);
});

installAppButtons.forEach((button) => button.addEventListener('click', installApp));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .catch((error) => console.error('Service worker registration failed:', error));
  });
}

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

function applyAdminData(data, targetDocument = document) {
  Object.entries(data || {}).forEach(([key, value]) => {
    if (typeof value !== 'string') return;

    const textElement = targetDocument.querySelector(`[data-admin-text="${key}"]`);
    const linkElement = targetDocument.querySelector(`[data-admin-link="${key}"]`);
    const imageElement = targetDocument.querySelector(`[data-admin-image="${key}"]`);

    if (textElement) textElement.textContent = value;
    if (linkElement) linkElement.setAttribute('href', value);
    if (imageElement && value) imageElement.setAttribute('src', value);
  });

  if (data?.gold) targetDocument.documentElement.style.setProperty('--gold', data.gold);
  if (data?.goldDark) targetDocument.documentElement.style.setProperty('--gold-dark', data.goldDark);
  if (data?.softDark) targetDocument.documentElement.style.setProperty('--soft-dark', data.softDark);
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

async function cleanHtmlForExport() {
  let sourceDocument = document;
  if (document.body.classList.contains('admin-page')) {
    const response = await fetch('./index.html');
    if (!response.ok) throw new Error(`Faqja kryesore nuk u ngarkua (${response.status}).`);
    sourceDocument = new DOMParser().parseFromString(await response.text(), 'text/html');
    applyAdminData(collectAdminInputs(), sourceDocument);
  }

  const clone = sourceDocument.documentElement.cloneNode(true);
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
  adminExportBtn.addEventListener('click', async () => {
    if (!exportCode || !exportModalElement || !window.bootstrap) return;
    try {
      exportCode.value = await cleanHtmlForExport();
      const modal = new bootstrap.Modal(exportModalElement);
      modal.show();
      exportCode.select();
    } catch (error) {
      showAdminMessage(`Export dështoi: ${error.message}`, 'danger');
    }
  });
}
