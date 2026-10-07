import { Duplex } from "node:stream";
import nodemailer from "nodemailer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTestEmail } from "../src/email.js";
import type { EmailConfig } from "../src/types.js";

class SimulatedSmtpSocket extends Duplex {
  commands: string[] = [];
  message = "";
  private input = "";
  private dataMode = false;

  setTimeout(): this { return this; }

  override _read(): void {}

  override _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.input += chunk.toString();
    while (this.input.includes("\r\n")) {
      const end = this.input.indexOf("\r\n");
      const line = this.input.slice(0, end);
      this.input = this.input.slice(end + 2);
      if (this.dataMode) {
        if (line === ".") {
          this.dataMode = false;
          this.push("250 2.0.0 queued\r\n");
        } else {
          this.message += `${line}\r\n`;
        }
        continue;
      }
      this.commands.push(line);
      if (line.startsWith("EHLO")) this.push("250-local.test\r\n250 AUTH PLAIN\r\n");
      else if (line.startsWith("AUTH PLAIN")) this.push("235 2.7.0 authenticated\r\n");
      else if (line === "DATA") {
        this.dataMode = true;
        this.push("354 send message\r\n");
      } else if (line === "QUIT") this.push("221 bye\r\n");
      else this.push("250 2.1.0 accepted\r\n");
    }
    callback();
  }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("email SMTP simulata senza rete", () => {
  it("usa il transport reale per autenticare, costruire e inviare il messaggio", async () => {
    const socket = new SimulatedSmtpSocket();
    const createTransport = nodemailer.createTransport.bind(nodemailer);
    const factory = vi.spyOn(nodemailer, "createTransport").mockImplementation((options) =>
      createTransport({
        ...(options as object),
        getSocket: (_options, callback) => {
          callback(null, { connection: socket });
          setImmediate(() => socket.push("220 local.test ESMTP ready\r\n"));
        }
      })
    );
    vi.stubEnv("TEST_EMAIL_FROM", "sender@example.invalid");
    vi.stubEnv("TEST_EMAIL_TO", "recipient@example.invalid");
    vi.stubEnv("TEST_SMTP_USER", "test-user");
    vi.stubEnv("TEST_SMTP_PASS", "test-only-not-a-secret");
    const config: EmailConfig = {
      enabled: true,
      defaultProfile: "test",
      fromEnv: "TEST_EMAIL_FROM",
      toEnv: "TEST_EMAIL_TO",
      subjectPrefix: "[Sentinel]",
      profiles: {
        test: {
          host: "smtp.example.invalid",
          port: 587,
          secure: false,
          userEnv: "TEST_SMTP_USER",
          passEnv: "TEST_SMTP_PASS"
        }
      }
    };
    await sendTestEmail(config, "test");
    expect(factory).toHaveBeenCalledWith({
      host: "smtp.example.invalid", port: 587, secure: false,
      auth: { user: "test-user", pass: "test-only-not-a-secret" }
    });
    expect(socket.commands.some((line) => line.startsWith("AUTH PLAIN"))).toBe(true);
    expect(socket.commands).toContain("MAIL FROM:<sender@example.invalid>");
    expect(socket.commands).toContain("RCPT TO:<recipient@example.invalid>");
    expect(socket.message).toContain("From: sender@example.invalid");
    expect(socket.message).toContain("To: recipient@example.invalid");
    expect(socket.message).toContain("Subject: [Sentinel] email di test");
    expect(socket.message).toContain("Email di test Sentinel riuscita.");
    socket.destroy();
  });
});
