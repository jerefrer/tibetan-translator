/**
 * Package a manifest object and a data.sqlite buffer into a .tibdict ZIP file.
 */

import fs from 'fs';
import AdmZip from 'adm-zip';

export async function writeTibdict(outputPath, manifest, sqliteBuffer) {
  const zip = new AdmZip();
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf-8'));
  zip.addFile('data.sqlite', sqliteBuffer);
  await new Promise((resolve, reject) => {
    zip.writeZip(outputPath, (err) => (err ? reject(err) : resolve()));
  });
}
