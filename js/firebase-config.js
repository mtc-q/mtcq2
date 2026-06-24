/* ═══════════════════════════════════════════════════════════
   js/firebase-config.js
   Firebase initialization + Auth + Firestore helpers
   ═══════════════════════════════════════════════════════════ */

// ── Firebase SDK (v9 compat) ─────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  sendEmailVerification,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  increment,
  onSnapshot,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// ── YOUR Firebase config ─────────────────────────────────
// Replace these values with your actual Firebase project config.
// Find it at: Firebase Console → Project Settings → General → Your apps
const firebaseConfig = {
  apiKey: "AIzaSyAOFQWeti2sKY0TVB6lWH2uBiTlNvw4kec",
  authDomain: "mtcq-v2.firebaseapp.com",
  projectId: "mtcq-v2",
  storageBucket: "mtcq-v2.firebasestorage.app",
  messagingSenderId: "853035300952",
  appId: "1:853035300952:web:517bfa574555320767322d",
  measurementId: "G-HDGELDPKD6"
};


// ── Initialize ───────────────────────────────────────────
const app       = initializeApp(firebaseConfig);
const auth      = getAuth(app);
const db        = getFirestore(app);
const storage   = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// ═══════════════════════════════════════════════════════════
// AUTH HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Sign up with email + password.
 * Creates the Firebase Auth user, then creates the Firestore profile.
 */
export async function signUpWithEmail(email, password, username, displayName) {
  // 1. Check username availability
  const taken = await isUsernameTaken(username);
  if (taken) throw new Error("Username is already taken.");

  // 2. Create auth user
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const user = credential.user;

  // 3. Send email verification
  await sendEmailVerification(user);

  // 4. Create Firestore profile
  await createUserProfile(user.uid, {
    email,
    username: username.toLowerCase(),
    displayName: displayName || username,
    plan: "free",
    createdAt: serverTimestamp()
  });

  return user;
}

/**
 * Sign in with email + password.
 */
export async function signInWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/**
 * Sign in / sign up with Google OAuth.
 * If new user, creates a profile with a generated username.
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  const user   = result.user;

  // Check if profile already exists
  const exists = await getUserProfile(user.uid);
  if (!exists) {
    // Generate username from email
    const base     = user.email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "");
    const username = await generateUniqueUsername(base);

    await createUserProfile(user.uid, {
      email:       user.email,
      username,
      displayName: user.displayName || username,
      avatarUrl:   user.photoURL || "",
      plan:        "free",
      createdAt:   serverTimestamp()
    });
  }
  return user;
}

/**
 * Sign out the current user.
 */
export async function logOut() {
  await signOut(auth);
}

/**
 * Send password reset email.
 */
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

/**
 * Listen to auth state changes. Calls callback(user) or callback(null).
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get current user (sync).
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Delete account permanently.
 */
export async function deleteAccount(password) {
  const user       = auth.currentUser;
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);

  // Delete Firestore data
  await deleteUserData(user.uid);

  // Delete Auth user
  await deleteUser(user);
}

// ═══════════════════════════════════════════════════════════
// FIRESTORE — USER PROFILES
// ═══════════════════════════════════════════════════════════

/**
 * Create a user profile document in Firestore.
 */
export async function createUserProfile(uid, data) {
  await setDoc(doc(db, "users", uid), {
    ...data,
    pageConfig: {
      bgColor:   "#1a1a2e",
      textColor: "#F2F2F7",
      bgImage:   null
    },
    bio:        "",
    socials:    {},
    linkCount:  0,
    totalViews: 0,
    updatedAt:  serverTimestamp()
  });

  // Also create a username lookup document
  await setDoc(doc(db, "usernames", data.username), { uid });
}

/**
 * Fetch a user profile by UID.
 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

/**
 * Fetch a user profile by username.
 */
export async function getUserByUsername(username) {
  const lookup = await getDoc(doc(db, "usernames", username.toLowerCase()));
  if (!lookup.exists()) return null;
  return getUserProfile(lookup.data().uid);
}

/**
 * Update user profile fields.
 */
export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, "users", uid), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

/**
 * Check if a username is already taken.
 */
export async function isUsernameTaken(username) {
  const snap = await getDoc(doc(db, "usernames", username.toLowerCase()));
  return snap.exists();
}

/**
 * Generate a unique username by appending numbers if needed.
 */
async function generateUniqueUsername(base) {
  let username = base.slice(0, 20);
  let counter  = 1;
  while (await isUsernameTaken(username)) {
    username = `${base.slice(0, 17)}${counter}`;
    counter++;
  }
  return username;
}

/**
 * Delete all user data (for account deletion).
 */
async function deleteUserData(uid) {
  const batch = writeBatch(db);

  // Get user profile to find username
  const profile = await getUserProfile(uid);
  if (profile?.username) {
    batch.delete(doc(db, "usernames", profile.username));
  }

  // Delete all links
  const linksSnap = await getDocs(collection(db, "users", uid, "links"));
  linksSnap.forEach(d => batch.delete(d.ref));

  // Delete main profile
  batch.delete(doc(db, "users", uid));

  await batch.commit();
}

// ═══════════════════════════════════════════════════════════
// FIRESTORE — LINKS
// ═══════════════════════════════════════════════════════════

/**
 * Get all links for a user, ordered by their position.
 */
export async function getLinks(uid) {
  const q    = query(collection(db, "users", uid, "links"), orderBy("order", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * Add a new link.
 */
export async function addLink(uid, linkData) {
  // Get current link count for ordering
  const existing = await getLinks(uid);
  const order    = existing.length;

  const ref = await addDoc(collection(db, "users", uid, "links"), {
    title:     linkData.title || "",
    url:       linkData.url || "",
    thumbUrl:  linkData.thumbUrl || null,
    visible:   true,
    clicks:    0,
    order,
    scheduledAt:  linkData.scheduledAt  || null,
    expiresAt:    linkData.expiresAt    || null,
    createdAt: serverTimestamp()
  });

  // Increment user's link count
  await updateDoc(doc(db, "users", uid), { linkCount: increment(1) });

  return ref.id;
}

/**
 * Update a link.
 */
export async function updateLink(uid, linkId, data) {
  await updateDoc(doc(db, "users", uid, "links", linkId), {
    ...data,
    updatedAt: serverTimestamp()
  });
}

/**
 * Delete a link.
 */
export async function deleteLink(uid, linkId) {
  await deleteDoc(doc(db, "users", uid, "links", linkId));
  await updateDoc(doc(db, "users", uid), { linkCount: increment(-1) });
}

/**
 * Save new link order after drag-and-drop.
 */
export async function reorderLinks(uid, orderedIds) {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, "users", uid, "links", id), { order: index });
  });
  await batch.commit();
}

/**
 * Record a click on a link.
 */
export async function recordLinkClick(uid, linkId) {
  // Increment on the link
  await updateDoc(doc(db, "users", uid, "links", linkId), {
    clicks: increment(1)
  });

  // Write analytics event
  await addDoc(collection(db, "users", uid, "analytics"), {
    type:      "click",
    linkId,
    timestamp: serverTimestamp(),
    date:      new Date().toISOString().split("T")[0] // YYYY-MM-DD
  });
}

/**
 * Record a page view.
 */
export async function recordPageView(uid) {
  await updateDoc(doc(db, "users", uid), {
    totalViews: increment(1)
  });

  await addDoc(collection(db, "users", uid, "analytics"), {
    type:      "view",
    timestamp: serverTimestamp(),
    date:      new Date().toISOString().split("T")[0]
  });
}

// ═══════════════════════════════════════════════════════════
// FIRESTORE — ANALYTICS
// ═══════════════════════════════════════════════════════════

/**
 * Get views per day for the last N days.
 */
export async function getViewsPerDay(uid, days = 7) {
  const dates    = [];
  const counts   = {};
  const now      = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d    = new Date(now);
    d.setDate(d.getDate() - i);
    const key  = d.toISOString().split("T")[0];
    dates.push(key);
    counts[key] = 0;
  }

  const oldestDate = dates[0];
  const q = query(
    collection(db, "users", uid, "analytics"),
    where("type",  "==", "view"),
    where("date",  ">=", oldestDate),
    orderBy("date", "asc")
  );

  const snap = await getDocs(q);
  snap.forEach(d => {
    const date = d.data().date;
    if (counts[date] !== undefined) counts[date]++;
  });

  return dates.map(date => ({ date, views: counts[date] }));
}

/**
 * Get total clicks per link.
 */
export async function getLinkAnalytics(uid) {
  const links = await getLinks(uid);
  return links
    .filter(l => l.visible)
    .sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
}

// ═══════════════════════════════════════════════════════════
// FIRESTORE — SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Get the user's current plan.
 */
export async function getUserPlan(uid) {
  const profile = await getUserProfile(uid);
  return profile?.plan || "free";
}

/**
 * Update user plan (called from Stripe webhook via Cloud Function).
 */
export async function updateUserPlan(uid, plan) {
  await updateDoc(doc(db, "users", uid), { plan });
}

// ═══════════════════════════════════════════════════════════
// STORAGE — FILE UPLOADS
// ═══════════════════════════════════════════════════════════

/**
 * Upload avatar image. Returns the download URL.
 */
export async function uploadAvatar(uid, file) {
  // Validate
  if (!file.type.startsWith("image/")) throw new Error("File must be an image.");
  if (file.size > 5 * 1024 * 1024)    throw new Error("Image must be under 5MB.");

  const storageRef = ref(storage, `avatars/${uid}/avatar.${file.name.split(".").pop()}`);
  const snapshot   = await uploadBytes(storageRef, file);
  const url        = await getDownloadURL(snapshot.ref);

  // Save URL to profile
  await updateUserProfile(uid, { avatarUrl: url });
  return url;
}

/**
 * Upload background image. Returns the download URL.
 */
export async function uploadBgImage(uid, file) {
  if (!file.type.startsWith("image/")) throw new Error("File must be an image.");
  if (file.size > 8 * 1024 * 1024)    throw new Error("Image must be under 8MB.");

  const storageRef = ref(storage, `backgrounds/${uid}/bg.${file.name.split(".").pop()}`);
  const snapshot   = await uploadBytes(storageRef, file);
  const url        = await getDownloadURL(snapshot.ref);

  await updateDoc(doc(db, "users", uid), {
    "pageConfig.bgImage": url,
    updatedAt: serverTimestamp()
  });
  return url;
}

/**
 * Upload link thumbnail. Returns the download URL.
 */
export async function uploadLinkThumb(uid, linkId, file) {
  if (!file.type.startsWith("image/")) throw new Error("File must be an image.");
  if (file.size > 3 * 1024 * 1024)    throw new Error("Image must be under 3MB.");

  const storageRef = ref(storage, `thumbnails/${uid}/${linkId}.${file.name.split(".").pop()}`);
  const snapshot   = await uploadBytes(storageRef, file);
  const url        = await getDownloadURL(snapshot.ref);

  await updateLink(uid, linkId, { thumbUrl: url });
  return url;
}

// ═══════════════════════════════════════════════════════════
// PLAN GATES
// ═══════════════════════════════════════════════════════════

export const PLAN_LIMITS = {
  free: {
    maxLinks:      10,
    customColors:  false,
    removeBranding: false,
    analytics:     "basic",   // views only
    scheduling:    false,
    passwordPage:  false,
    versionHistory: false,
    ga4:           false,
    metaPixel:     false
  },
  starter: {
    maxLinks:      20,
    customColors:  true,
    removeBranding: false,
    analytics:     "starter", // clicks + 7d
    scheduling:    true,
    passwordPage:  false,
    versionHistory: false,
    ga4:           false,
    metaPixel:     false
  },
  pro: {
    maxLinks:      Infinity,
    customColors:  true,
    removeBranding: true,
    analytics:     "pro",     // full
    scheduling:    true,
    passwordPage:  true,
    versionHistory: true,
    ga4:           true,
    metaPixel:     true
  }
};

export function canDoAction(plan, action) {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  return !!limits[action];
}

export function canAddLink(plan, currentCount) {
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  return currentCount < limits.maxLinks;
}

// ═══════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════
export {
  app, auth, db, storage,
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs, query, where, orderBy, limit,
  serverTimestamp, increment, onSnapshot, writeBatch
};
