const DB_NAME = 'kidCurriculumDB';
const DB_VERSION = 1;
const STORE_CURRICULUM = 'curriculum';
const STORE_PROGRESS = 'progress';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_CURRICULUM)) {
        db.createObjectStore(STORE_CURRICULUM);
      }
      if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
        db.createObjectStore(STORE_PROGRESS);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveCurriculum(data) {
  const db = await openDB();
  const tx = db.transaction(STORE_CURRICULUM, 'readwrite');
  tx.objectStore(STORE_CURRICULUM).put(data, 'data');
  return tx.complete;
}

export async function loadCurriculum() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_CURRICULUM, 'readonly');
    const req = tx.objectStore(STORE_CURRICULUM).get('data');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveProgress(data) {
  const db = await openDB();
  const tx = db.transaction(STORE_PROGRESS, 'readwrite');
  tx.objectStore(STORE_PROGRESS).put(data, 'data');
  return tx.complete;
}

export async function loadProgress() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROGRESS, 'readonly');
    const req = tx.objectStore(STORE_PROGRESS).get('data');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
