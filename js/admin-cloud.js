import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-analytics.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch (error) {}

const auth = getAuth(app);
const db = getFirestore(app);
const siteRef = doc(db, "siteContent", "main");

const $ = (id) => document.getElementById(id);

const defaults = {
  heroTitle: "Stil i pastër, pamje e fuqishme.",
  heroText: "Në Nissi Barber Shop kujdesemi për çdo detaj: prerje profesionale, mjekër perfekte dhe shërbim premium.",
  phone: "+383 44 000 000",
  location: "Rruga Kryesore, Kosovë",
  instagram: "https://www.instagram.com/frizernisi?igsh=MXVkdTE1OTVlajRzcA==",
  tiktok: "https://www.tiktok.com/@frizernissi",
  gold: "#d4a65a",
  dark: "#141416"
};

function openAdmin() {
  $("adminBackdrop")?.classList.remove("d-none");
}

function closeAdmin() {
  $("adminBackdrop")?.classList.add("d-none");
}

$("adminOpenBtn")?.addEventListener("click", openAdmin);
$("adminCloseBtn")?.addEventListener("click", closeAdmin);
document.addEventListener("keydown", (e) => {
  if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    e.preventDefault();
    openAdmin();
  }
  if (e.key === "Escape") closeAdmin();
});

function applyContent(data = {}) {
  const c = { ...defaults, ...data };

  const heroTitle = document.querySelector(".hero-content h1");
  if (heroTitle) heroTitle.textContent = c.heroTitle;

  const heroText = document.querySelector(".hero-content .lead");
  if (heroText) heroText.innerHTML = c.heroText.replace("Nissi Barber Shop", "<strong>Nissi Barber Shop</strong>");

  const phoneEls = [...document.querySelectorAll(".contact-info p")];
  phoneEls.forEach((p) => {
    if (p.querySelector(".bi-telephone")) p.innerHTML = `<i class="bi bi-telephone"></i> ${c.phone}`;
    if (p.querySelector(".bi-geo-alt")) p.innerHTML = `<i class="bi bi-geo-alt"></i> ${c.location}`;
  });

  const instagram = document.querySelector('a[aria-label="Instagram"]');
  if (instagram) instagram.href = c.instagram;

  const tiktok = document.querySelector('a[aria-label="TikTok"]');
  if (tiktok) tiktok.href = c.tiktok;

  document.documentElement.style.setProperty("--gold", c.gold);
  document.documentElement.style.setProperty("--dark", c.dark);

  if ($("editHeroTitle")) $("editHeroTitle").value = c.heroTitle;
  if ($("editHeroText")) $("editHeroText").value = c.heroText;
  if ($("editPhone")) $("editPhone").value = c.phone;
  if ($("editLocation")) $("editLocation").value = c.location;
  if ($("editInstagram")) $("editInstagram").value = c.instagram;
  if ($("editTiktok")) $("editTiktok").value = c.tiktok;
  if ($("editGold")) $("editGold").value = c.gold;
  if ($("editDark")) $("editDark").value = c.dark;
}

async function ensureDefaultDoc() {
  const snap = await getDoc(siteRef);
  if (!snap.exists()) {
    await setDoc(siteRef, defaults, { merge: true });
  }
}

onSnapshot(siteRef, (snap) => {
  applyContent(snap.exists() ? snap.data() : defaults);
});

$("adminLoginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  $("adminError")?.classList.add("d-none");
  try {
    await signInWithEmailAndPassword(auth, $("adminEmail").value, $("adminPassword").value);
    await ensureDefaultDoc();
  } catch (error) {
    if ($("adminError")) {
      $("adminError").textContent = "Login dështoi. Kontrollo email/password ose Firebase setup.";
      $("adminError").classList.remove("d-none");
    }
  }
});

onAuthStateChanged(auth, (user) => {
  $("adminLoginForm")?.classList.toggle("d-none", !!user);
  $("adminEditor")?.classList.toggle("d-none", !user);
});

$("saveAdminChanges")?.addEventListener("click", async () => {
  const data = {
    heroTitle: $("editHeroTitle").value.trim(),
    heroText: $("editHeroText").value.trim(),
    phone: $("editPhone").value.trim(),
    location: $("editLocation").value.trim(),
    instagram: $("editInstagram").value.trim(),
    tiktok: $("editTiktok").value.trim(),
    gold: $("editGold").value,
    dark: $("editDark").value
  };
  await setDoc(siteRef, data, { merge: true });
  if ($("adminStatus")) {
    $("adminStatus").textContent = "U ruajt në cloud ✅";
    setTimeout(() => $("adminStatus").textContent = "I kyçur në cloud.", 1800);
  }
});

$("adminLogout")?.addEventListener("click", () => signOut(auth));
