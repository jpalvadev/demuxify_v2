// 08h: erase the leftover header icon trio (lines between the cleanup comment and </nav>)
import fs from "fs";
const P = "src/App.tsx";
const t = fs.readFileSync(P, "utf8");
const NL = t.includes("\r\n") ? "\r\n" : "\n";
const lines = t.split(/\r?\n/);
const startMark =
  "to a HARD BAN this same commit, so none of it may ever render again. */}";
const commentIdx = lines.findIndex((l) => l.includes(startMark));
if (commentIdx === -1) throw new Error("comment anchor not found");
// the icon trio runs from commentIdx+1 up to the closing </nav>
let end = commentIdx + 1;
while (end < lines.length && lines[end].trim() !== "</nav>") end++;
if (end >= lines.length) throw new Error("no </nav> found");
const doomed = lines.slice(commentIdx + 1, end);
console.log(
  "doomed lines:",
  doomed.length,
  "expect trio:",
  doomed.some((l) => l.includes("border border-transparent"))
);
const removed = lines.splice(commentIdx + 1, end - commentIdx - 1);
fs.writeFileSync(P, lines.join(NL));
console.log("erased", removed.length, "lines");
