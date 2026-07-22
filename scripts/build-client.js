import fs from "fs";
import path from "path";

const root = path.resolve(".");
const source = path.join(root, "client");
const dest = path.join(root, "server", "client");

function copyDir(src, dst) {
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(dst, { recursive: true });
  }

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

copyDir(source, dest);
console.log(`Copied client files from ${source} to ${dest}`);
