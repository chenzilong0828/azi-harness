import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export async function pathExists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch (error) {
    if (error.code === 'EISDIR') {
      return true;
    }
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function writeManagedFile(root, relativePath, content, force = false) {
  const target = path.join(root, relativePath);
  const exists = await pathExists(target);
  if (exists && !force) {
    return { relativePath, status: 'kept' };
  }

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
  return { relativePath, status: exists ? 'updated' : 'created' };
}

export async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
