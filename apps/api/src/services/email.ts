// Envío de facturas por email desde la cuenta de Gmail del emisor (SMTP con contraseña de aplicación).
import { WorkerMailer } from "worker-mailer";
import { DomainError } from "./errors";

export type MailConfig = { GMAIL_USER?: string; GMAIL_APP_PASSWORD?: string };

export const isMailConfigured = (env: MailConfig) => !!env.GMAIL_USER && !!env.GMAIL_APP_PASSWORD;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export async function sendInvoiceEmail(
  env: MailConfig,
  mail: {
    to: string;
    fromName: string;
    replyTo?: string | null;
    subject: string;
    body: string;
    attachment: { filename: string; bytes: Uint8Array };
  },
) {
  if (!isMailConfigured(env)) {
    throw new DomainError("El envío por email no está configurado (faltan GMAIL_USER y GMAIL_APP_PASSWORD).", 400);
  }
  try {
    await WorkerMailer.send(
      {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        authType: "plain",
        credentials: { username: env.GMAIL_USER!, password: env.GMAIL_APP_PASSWORD! },
      },
      {
        from: { name: mail.fromName, email: env.GMAIL_USER! },
        to: mail.to,
        reply: mail.replyTo ?? undefined,
        subject: mail.subject,
        text: mail.body,
        html: `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#111">${escapeHtml(mail.body).replace(/\n/g, "<br>")}</div>`,
        attachments: [{ filename: mail.attachment.filename, content: toBase64(mail.attachment.bytes), mimeType: "application/pdf" }],
      },
    );
  } catch (e) {
    console.error("Error enviando email", e);
    throw new DomainError("No se pudo enviar el email. Revisa la dirección y la configuración de Gmail.", 400);
  }
}
