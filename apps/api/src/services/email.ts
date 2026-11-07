// Envío de emails desde la cuenta de Gmail que el emisor conecta en su perfil
// (SMTP con contraseña de aplicación). Como alternativa, GMAIL_USER / GMAIL_APP_PASSWORD del entorno.
import { eq } from "drizzle-orm";
import { WorkerMailer } from "worker-mailer";
import type { Db } from "../db";
import { schema } from "../db";
import { decrypt, encrypt } from "../lib/secret-box";
import { DomainError } from "./errors";

export type MailEnv = { BETTER_AUTH_SECRET: string; GMAIL_USER?: string; GMAIL_APP_PASSWORD?: string };
export type MailAccount = { user: string; password: string };
type Issuer = typeof schema.issuers.$inferSelect;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** Cuenta con la que enviar: la del perfil o, si no hay, la del entorno. */
export async function mailAccountFor(env: MailEnv, issuer: Issuer): Promise<MailAccount | null> {
  if (issuer.smtpUser && issuer.smtpPasswordEnc) {
    const password = await decrypt(issuer.smtpPasswordEnc, env.BETTER_AUTH_SECRET);
    if (password) return { user: issuer.smtpUser, password };
  }
  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) return { user: env.GMAIL_USER, password: env.GMAIL_APP_PASSWORD };
  return null;
}

export async function sendMail(
  account: MailAccount,
  mail: {
    to: string;
    bcc?: string | null;
    fromName: string;
    replyTo?: string | null;
    subject: string;
    body: string;
    attachment?: { filename: string; bytes: Uint8Array };
  },
) {
  try {
    await WorkerMailer.send(
      {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        authType: "plain",
        credentials: { username: account.user, password: account.password },
      },
      {
        from: { name: mail.fromName, email: account.user },
        to: mail.to,
        bcc: mail.bcc ?? undefined,
        reply: mail.replyTo ?? undefined,
        subject: mail.subject,
        text: mail.body,
        html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">${escapeHtml(mail.body).replace(/\n/g, "<br>")}</div>`,
        attachments: mail.attachment
          ? [{ filename: mail.attachment.filename, content: toBase64(mail.attachment.bytes), mimeType: "application/pdf" }]
          : undefined,
      },
    );
  } catch (e) {
    console.error("Error enviando email", e);
    throw new DomainError(
      "No se pudo enviar el email. Revisa la dirección del destinatario y la cuenta de Gmail conectada en tu perfil.",
      400,
    );
  }
}

export function requireAccount(account: MailAccount | null): MailAccount {
  if (!account) throw new DomainError("Conecta tu cuenta de Gmail en Perfil → Email para enviar facturas.", 400);
  return account;
}

// --- Configuración desde el perfil ---

export async function connectMailAccount(db: Db, env: MailEnv, issuerId: string, user: string, password: string) {
  const clean = password.replace(/\s/g, ""); // Google muestra la contraseña en grupos de 4
  await db
    .update(schema.issuers)
    .set({ smtpUser: user.trim().toLowerCase(), smtpPasswordEnc: await encrypt(clean, env.BETTER_AUTH_SECRET) })
    .where(eq(schema.issuers.id, issuerId));
}

export async function disconnectMailAccount(db: Db, issuerId: string) {
  await db
    .update(schema.issuers)
    .set({ smtpUser: null, smtpPasswordEnc: null, emailCopyToSelf: false })
    .where(eq(schema.issuers.id, issuerId));
}
