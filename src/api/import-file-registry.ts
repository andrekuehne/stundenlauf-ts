type ImportFileRecord = {
  file: File;
  recordedAt: number;
};

const fileByName = new Map<string, ImportFileRecord>();
const ENTRY_TTL_MS = 30 * 60 * 1000;

function pruneExpiredEntries(now: number): void {
  for (const [key, value] of fileByName.entries()) {
    if (now - value.recordedAt > ENTRY_TTL_MS) {
      fileByName.delete(key);
    }
  }
}

export function rememberImportFile(file: File): void {
  const now = Date.now();
  pruneExpiredEntries(now);
  fileByName.set(file.name, { file, recordedAt: now });
}

export function consumeImportFile(fileName: string): File | null {
  const now = Date.now();
  pruneExpiredEntries(now);
  const entry = fileByName.get(fileName) ?? null;
  if (!entry) {
    return null;
  }
  fileByName.delete(fileName);
  return entry.file;
}

export function peekImportFile(fileName: string): File | null {
  const now = Date.now();
  pruneExpiredEntries(now);
  return fileByName.get(fileName)?.file ?? null;
}

export function clearImportFile(fileName: string): void {
  fileByName.delete(fileName);
}
