import { readFile, rename, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { zip, type Zippable } from "fflate";

/**
 * Sudeda failus į ZIP. PDF jau suspausti, todėl level 0 (store) – greita ir beveik toks pat dydis.
 * Rašoma per laikiną failą, kad GET niekada nematytų pusiau įrašyto archyvo.
 */
export async function writeZip(files: string[], outFile: string): Promise<void> {
  const entries: Zippable = {};
  for (const f of files) entries[basename(f)] = [await readFile(f), { level: 0 }];
  const data = await new Promise<Uint8Array>((resolve, reject) =>
    zip(entries, (err, out) => (err ? reject(err) : resolve(out))),
  );
  const tmp = `${outFile}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, outFile);
}
