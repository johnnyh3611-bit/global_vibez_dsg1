import fs from "fs";
import path from "node:path";

// Keep this runtime-resolved so Turbopack does not trace broad filesystem trees.
const DEFAULT_HOLDERS_FILE = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "data",
  "chair-holders.txt"
);

function getHoldersFilePath(): string {
  return process.env.CHAIR_HOLDERS_FILE?.trim() || DEFAULT_HOLDERS_FILE;
}

// ... rest of your code remains the same