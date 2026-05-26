import { execFile } from "node:child_process";
import { promisify } from "node:util";
import nodemailer from "nodemailer";
import type { EmailConfig, ScanResult, SiteConfig, SmtpProfileConfig } from "./types.js";
import { renderScanReport } from "./report.js";

const execFileAsync = promisify(execFile);

export async function sendScanEmail(email: EmailConfig, site: SiteConfig, result: ScanResult): Promise<void> {
  const profileName = site.emailProfile ?? email.defaultProfile;
  const profile = email.profiles[profileName];
  if (!profile) throw new Error(`Profilo email non trovato: ${profileName}`);

  const activeIssues = result.issues.filter((issue) => !issue.ignored);
  const subject = `${email.subjectPrefix} ${site.name}: ${result.changes.length} cambiamenti, ${activeIssues.length} problemi`;
  await sendEmail(email, profile, subject, renderScanReport(result));
}

export async function sendTestEmail(email: EmailConfig, profileName: string): Promise<void> {
  const profile = email.profiles[profileName];
  if (!profile) throw new Error(`Profilo email non trovato: ${profileName}`);
  await sendEmail(email, profile, `${email.subjectPrefix} email di test`, "Email di test Sentinel riuscita.\n");
}

async function sendEmail(email: EmailConfig, profile: SmtpProfileConfig, subject: string, text: string): Promise<void> {
  const from = requiredEnv(email.fromEnv);
  const to = requiredEnv(email.toEnv);
  const user = requiredEnv(profile.userEnv);
  const pass = await resolvePassword(profile, user);

  const transport = nodemailer.createTransport({
    host: profile.host,
    port: profile.port,
    secure: profile.secure,
    auth: { user, pass }
  });

  await transport.sendMail({ from, to, subject, text });
}

async function resolvePassword(profile: SmtpProfileConfig, account: string): Promise<string> {
  const fromEnv = process.env[profile.passEnv];
  if (fromEnv) return fromEnv;

  if (profile.passKeychainService && process.platform === "darwin") {
    const { stdout } = await execFileAsync("security", [
      "find-generic-password",
      "-s",
      profile.passKeychainService,
      "-a",
      account,
      "-w"
    ]);
    const value = stdout.trim();
    if (value) return value;
  }

  throw new Error(`Password SMTP assente: imposta ${profile.passEnv} o un servizio Portachiavi valido.`);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variabile ambiente mancante: ${name}`);
  return value;
}
