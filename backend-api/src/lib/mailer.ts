import nodemailer from "nodemailer";
import { env } from "../config/env";

function createTransporter() {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) return null;
  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: { user: env.smtpUser, pass: env.smtpPass },
  });
}

const transporter = createTransporter();

export async function sendPasswordResetEmail(to: string, resetUrl: string, name: string) {
  if (!transporter) {
    // Dev mode: print to console instead of sending email
    console.log("\n====================================================");
    console.log(`[PASSWORD RESET] Para: ${to}`);
    console.log(`[PASSWORD RESET] Link: ${resetUrl}`);
    console.log("====================================================\n");
    return;
  }

  const fromAddress = env.smtpFrom || env.smtpUser;
  await transporter.sendMail({
    from: `"Finanzas App" <${fromAddress}>`,
    to,
    subject: "Restablecer tu contraseña",
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#060A18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="100%" style="max-width:480px;background:#0D1426;border-radius:20px;border:1px solid #1A2744;overflow:hidden;">
          <tr>
            <td style="padding:32px 32px 0;text-align:center;">
              <div style="font-size:44px;margin-bottom:12px;">💰</div>
              <h1 style="color:#F1F5F9;font-size:24px;font-weight:800;margin:0 0 8px;">Finanzas App</h1>
              <p style="color:#64748B;font-size:14px;margin:0;">Restablecer contraseña</p>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px;">
              <p style="color:#94A3B8;font-size:15px;margin:0 0 16px;">Hola <strong style="color:#F1F5F9;">${name}</strong>,</p>
              <p style="color:#94A3B8;font-size:15px;margin:0 0 28px;">Recibiste este correo porque solicitaste restablecer tu contraseña. El enlace es válido por <strong style="color:#F1F5F9;">1 hora</strong>.</p>
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${resetUrl}" style="display:inline-block;background:#6366F1;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:12px;">Restablecer contraseña</a>
              </div>
              <p style="color:#475569;font-size:13px;margin:0 0 8px;">Si no solicitaste esto, ignora este correo.</p>
              <p style="color:#475569;font-size:13px;margin:0;">O copia este enlace en tu navegador:<br>
                <span style="color:#6366F1;word-break:break-all;">${resetUrl}</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px;border-top:1px solid #1A2744;margin-top:20px;">
              <p style="color:#475569;font-size:12px;margin:20px 0 0;text-align:center;">
                Finanzas App — Tu dinero, bajo control
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  });
}
