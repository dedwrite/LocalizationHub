import { createTokenProfileConfig, decodeLocalizationProject, exportLocalizationDocument, parseLocalizationFile, type LocalizationParseResult, type LocalizationProjectV3, type ParsedLocalizationDocument } from '@localizationhub/core'

const DB_NAME = 'localizationhub-web-local'
const STORE = 'projects'
function openDb(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { let request: IDBOpenDBRequest; try { request = indexedDB.open(DB_NAME, 1) } catch (error) { reject(error); return }; request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' }); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
async function writeLocal(change: (store: IDBObjectStore) => void) {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Browser storage transaction failed.'))
      change(tx.objectStore(STORE))
    })
  } finally { db.close() }
}
export async function saveLocalProject(id: string, value: unknown) { await writeLocal((store) => store.put({ id, value, savedAt: new Date().toISOString() })) }
export async function loadLocalProjects(): Promise<Array<{ id: string; value: any; savedAt: string }>> {
  const db = await openDb()
  try { return await new Promise((resolve, reject) => { const request = db.transaction(STORE).objectStore(STORE).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
  finally { db.close() }
}
export async function deleteLocalProject(id: string) { await writeLocal((store) => store.delete(id)) }
export function importLocalFile(text: string, fileName: string): LocalizationParseResult { return parseLocalizationFile(text, fileName) }
export function exportLocalFile(document: ParsedLocalizationDocument) { return exportLocalizationDocument(document) }

export function projectFromLocalDocument(document: ParsedLocalizationDocument, sourceFileName: string): LocalizationProjectV3 {
  const { entries, ...info } = document
  const tokenProfileConfig = createTokenProfileConfig('auto')
  return { format: 'LocalizationHubProject', version: 3, sourceFileName, document: info, entries, selectedEntryId: entries[0]?.id ?? null, workflow: { entries: {} }, tokenProfile: 'auto', tokenProfileConfig, engineDetection: tokenProfileConfig.detection }
}

/** Legacy browser records were ParsedLocalizationDocument, not V3. Convert in
 * memory only; keep the existing IndexedDB row/key until an explicit Save.
 * Never re-parse sourceText: that would discard translations and edited context.
 */
export function normalizeLocalProject(value: unknown, sourceFileName: string): LocalizationProjectV3 {
  if (!value || typeof value !== 'object') throw new Error('This local copy cannot be opened.')
  const legacy = value as ParsedLocalizationDocument
  if (!('version' in value) && (!Array.isArray(legacy.entries) || typeof legacy.sourceText !== 'string' || !legacy.parser)) throw new Error('This local copy cannot be opened.')
  const candidate = 'version' in value ? value : projectFromLocalDocument(legacy, sourceFileName)
  const decoded = decodeLocalizationProject(JSON.stringify(candidate))
  if (!decoded.ok) throw new Error('This local copy cannot be opened.')
  return decoded.project
}

export function exportLocalProject(project: LocalizationProjectV3): string {
  return exportLocalFile({ ...project.document, entries: project.entries })
}
