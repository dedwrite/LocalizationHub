import { exportLocalizationDocument, parseLocalizationFile, type LocalizationParseResult, type ParsedLocalizationDocument } from '@localizationhub/core'

const DB_NAME = 'localizationhub-web-local'
const STORE = 'projects'
function openDb(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, 1); request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
export async function saveLocalProject(id: string, value: unknown) { const db = await openDb(); await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put({ id, value, savedAt: new Date().toISOString() }); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }); db.close() }
export async function loadLocalProjects(): Promise<Array<{ id: string; value: any; savedAt: string }>> { const db = await openDb(); return new Promise((resolve, reject) => { const request = db.transaction(STORE).objectStore(STORE).getAll(); request.onsuccess = () => { db.close(); resolve(request.result) }; request.onerror = () => reject(request.error) }) }
export async function deleteLocalProject(id: string) { const db = await openDb(); await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }); db.close() }
export function importLocalFile(text: string, fileName: string): LocalizationParseResult { return parseLocalizationFile(text, fileName) }
export function exportLocalFile(document: ParsedLocalizationDocument) { return exportLocalizationDocument(document) }
