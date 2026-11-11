// Baut die Spiel-Datei index.html (Root, von GitHub Pages ausgeliefert) aus den Quellteilen in src/.
// Alles landet in EINEM inline-Script, damit die Konsolen-Kapsel (IIFE) erhalten bleibt.
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8").replace(/\n$/, "");
const joinDir = (rel) => fs.readdirSync(path.join(root, rel)).filter((f) => !f.startsWith(".")).sort()
  .map((f) => read(path.join(rel, f))).join("\n");

const css = joinDir("src/css");
const js = joinDir("src/js");
const head = read("src/head.html").replace("{{CSS}}", css);
const shell = read("src/body/shell.html");
const pages = ["timer", "market", "stats", "login", "leaderboard", "modals"]
  .map((p) => read(`src/body/${p}.html`)).join("\n");
const tail = read("src/tail.html");

const out = [head, shell, pages, "<script>", js, "</script>", tail].join("\n").replace(/\n*$/, "\n");

// Syntax-Check des Spiel-Scripts: bricht den Build ab, wenn etwas kaputt ist
const tmp = path.join(os.tmpdir(), "maxi-check.js");
fs.writeFileSync(tmp, out.split("<script>\n").pop().split("\n</script>")[0]);
execFileSync("node", ["--check", tmp], { stdio: "inherit" });

fs.writeFileSync(path.join(root, "index.html"), out);
console.log("build ok: index.html", (out.length / 1024).toFixed(1), "KB");
