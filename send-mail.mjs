import nodemailer from "nodemailer";
import fs from "node:fs";

const PLF = new Date("2027-01-13T10:45:00+01:00");
const PLF_DAY = "2027-01-13";
const STATE_FILE = "last-sent.txt";
const FORCE = process.env.FORCE === "true";   // Testmodus: Mail an dich selbst
const SITE_URL = process.env.SITE_URL ?? "";

// Aktuelles Datum und Stunde in Wien
const now = new Date();
const parts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Vienna", year: "numeric", month: "2-digit",
  day: "2-digit", hour: "2-digit", hourCycle: "h23"
}).formatToParts(now);
const get = (t) => parts.find((p) => p.type === t).value;
const today = `${get("year")}-${get("month")}-${get("day")}`;
const hour = Number(get("hour"));

const diff = PLF - now;
if (diff <= 0 && !FORCE) {
  console.log("PLF vorbei, keine Mails mehr.");
  process.exit(0);
}

// Zufällige Stunde pro Tag (für ein Datum immer gleich), 7 bis 21 Uhr
const hash = (str) => [...str].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const isPlfDay = today === PLF_DAY;
const targetHour = isPlfDay ? 7 : 7 + (hash(today) % 15);

const lastSent = fs.existsSync(STATE_FILE) ? fs.readFileSync(STATE_FILE, "utf8").trim() : "";
if (!FORCE) {
  if (lastSent === today) { console.log("Heute schon gesendet."); process.exit(0); }
  if (hour < targetHour) { console.log(`Noch nicht Zeit (Ziel: ${targetHour} Uhr).`); process.exit(0); }
}

// Restzeit als Text
const d = Math.floor(diff / 86400000);
const h = Math.floor(diff / 3600000) % 24;
const m = Math.floor(diff / 60000) % 60;
const rest = `${d} Tage, ${h} Stunden und ${m} Minuten`;

const dayNr = Math.floor(Date.parse(today) / 86400000);
const pick = (arr, offset = 0) => arr[(dayNr + offset) % arr.length];

const subjects = [
  "Dringend: Deine POS-Zukunft",
  `Noch ${rest}`,
  "Hast du heute schon programmiert?",
  "Erinnerung: Die PLF vergisst dich nicht",
  "Wichtige Mitteilung bezüglich deiner Note",
  `Tick tack, Maxi. ${d} Tage.`,
  "Re: Re: Re: Lernst du schon?",
  "Dein täglicher Realitätscheck"
];

const facts = [
  "Was ist eine NullPointerException? Tipp: deine Vorbereitung.",
  "Was gibt System.out.println(maxi.isReady()) aus? Antwort: false",
  "Unterschied zwischen == und equals()? Ungefähr eine ganze Note.",
  "Eine for-Schleife läuft öfter, als du lernst.",
  "Wie viele Semikolons wirst du bei der PLF vergessen? Ja.",
  "Der Garbage Collector räumt mehr auf als du in deinem Zimmer.",
  "ChatGPT darf nicht mit zur PLF. Nur damit du es weißt."
];

const excuses = [
  "mein IntelliJ gerade indexiert.",
  "die PLF eh noch ewig weg ist.",
  "ich zuerst noch FIFA spielen muss.",
  "Java mich emotional verletzt hat.",
  "ich das morgen eh in einer Stunde schaffe."
];

let subject, html;
if (isPlfDay) {
  subject = "Heute ist der Tag. Viel Glück, du wirst es brauchen 🍀";
  html = `<h2>Maxi, heute um 10:45 ist es soweit.</h2>
          <p>Noch ${h} Stunden und ${m} Minuten. Jetzt hilft nur noch Beten.</p>
          <p>Viel Glück, du wirst es brauchen 🍀</p>`;
} else {
  subject = pick(subjects);
  html = `<h2>⏳ Noch ${rest} bis zur POS-PLF</h2>
          <p><strong>Java-Fakt des Tages:</strong> ${pick(facts, 3)}</p>
          <p><strong>Deine Ausrede für heute:</strong> Heute kann ich nicht lernen, weil ${pick(excuses, 5)}</p>
          ${SITE_URL ? `<p><a href="${SITE_URL}">Live-Countdown ansehen</a></p>` : ""}
          <p>Mit freundlichen Grüßen<br>Dein Maxi Timer</p>`;
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
});

await transporter.sendMail({
  from: `"Maxi Timer" <${process.env.GMAIL_USER}>`,
  to: FORCE ? process.env.GMAIL_USER : process.env.MAXI_EMAIL,
  subject,
  html
});

console.log(`Mail gesendet: ${subject}`);
if (!FORCE) fs.writeFileSync(STATE_FILE, today);
