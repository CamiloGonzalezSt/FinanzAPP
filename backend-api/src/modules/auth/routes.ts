import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { runQuery } from "../../db/pool";
import { env } from "../../config/env";
import { requireAuth } from "../../middleware/requireAuth";
import { sendPasswordResetEmail } from "../../lib/mailer";

export const authRouter = Router();

// Username rules: 3-30 chars, only letters, numbers, dots, underscores, hyphens. No spaces.
const usernameSchema = z
  .string()
  .min(3, "El usuario debe tener al menos 3 caracteres.")
  .max(30, "El usuario no puede tener más de 30 caracteres.")
  .regex(/^[a-zA-Z0-9._-]+$/, "Solo letras, números, puntos, guiones y guiones bajos.");

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
  username: usernameSchema.optional(),
});

const loginSchema = z.object({
  // Accepts: email (has "@"), username (no spaces, no "@"), or full name (has spaces)
  identifier: z.string().min(2),
  password: z.string().min(8),
});

const googleSchema = z
  .object({
    idToken: z.string().min(20).optional(),
    accessToken: z.string().min(20).optional(),
  })
  .refine((data) => Boolean(data.idToken || data.accessToken), {
    message: "idToken or accessToken is required",
  });

const googleClient = new OAuth2Client(env.googleOAuthClientIds[0] ?? env.googleClientId ?? undefined);

type UserRow = { id: string; email: string; full_name: string | null; username: string | null };

function buildAuthResponse(user: UserRow) {
  const accessToken = jwt.sign({ sub: user.id, email: user.email }, env.jwtSecret, { expiresIn: "2h" });
  const refreshToken = jwt.sign({ sub: user.id, type: "refresh" }, env.jwtSecret, { expiresIn: "30d" });
  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name ?? "Usuario",
      username: user.username ?? null,
    },
  };
}

// ─── Register ──────────────────────────────────────────────────────────────────

authRouter.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  try {
    const existingEmail = await runQuery<{ id: string }>(`select id from users where email = $1 limit 1`, [parsed.data.email]);
    if (existingEmail.rows.length > 0) {
      return res.status(409).json({ error: { message: "Este correo ya está registrado." } });
    }

    if (parsed.data.username) {
      const existingUsername = await runQuery<{ id: string }>(
        `select id from users where lower(username) = lower($1) limit 1`,
        [parsed.data.username]
      );
      if (existingUsername.rows.length > 0) {
        return res.status(409).json({ error: { message: "Ese nombre de usuario ya está en uso." } });
      }
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const userResult = await runQuery<UserRow>(
      `insert into users (email, full_name, username)
       values ($1, $2, $3)
       returning id, email, full_name, username`,
      [parsed.data.email, parsed.data.fullName, parsed.data.username ?? null]
    );
    const user = userResult.rows[0];

    await runQuery(
      `insert into auth_identities (user_id, provider, provider_user_id, password_hash)
       values ($1, 'manual', $2, $3)`,
      [user.id, parsed.data.email, passwordHash]
    );

    return res.status(201).json(buildAuthResponse(user));
  } catch {
    return res.status(500).json({ error: { message: "Could not register user" } });
  }
});

// ─── Login ────────────────────────────────────────────────────────────────────

authRouter.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const { identifier, password } = parsed.data;
  const isEmail = identifier.includes("@");
  // A username has no spaces and no "@". A full name usually has at least one space.
  const looksLikeUsername = !isEmail && !identifier.trim().includes(" ");

  try {
    type LoginRow = UserRow & { password_hash: string | null };

    if (isEmail) {
      const result = await runQuery<LoginRow>(
        `select u.id, u.email, u.full_name, u.username, ai.password_hash
         from users u
         join auth_identities ai on ai.user_id = u.id
         where lower(u.email) = lower($1) and ai.provider = 'manual'
         limit 1`,
        [identifier.trim()]
      );
      if (result.rows.length === 0) return res.status(401).json({ error: { message: "No existe una cuenta con ese correo." } });
      const user = result.rows[0];
      if (!user.password_hash) return res.status(401).json({ error: { message: "Esta cuenta usa Google para iniciar sesión." } });
      if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: { message: "Contraseña incorrecta." } });
      return res.status(200).json(buildAuthResponse(user));
    }

    if (looksLikeUsername) {
      // Try username first (exact, case-insensitive)
      const byUsername = await runQuery<LoginRow>(
        `select u.id, u.email, u.full_name, u.username, ai.password_hash
         from users u
         join auth_identities ai on ai.user_id = u.id
         where lower(u.username) = lower($1) and ai.provider = 'manual'
         limit 1`,
        [identifier.trim()]
      );
      if (byUsername.rows.length > 0) {
        const user = byUsername.rows[0];
        if (!user.password_hash) return res.status(401).json({ error: { message: "Esta cuenta usa Google para iniciar sesión." } });
        if (!await bcrypt.compare(password, user.password_hash)) return res.status(401).json({ error: { message: "Contraseña incorrecta." } });
        return res.status(200).json(buildAuthResponse(user));
      }
      // No username match — fall through to full_name search below
    }

    // Search by full_name — compare passwords across all matches to resolve duplicates
    const byName = await runQuery<LoginRow>(
      `select u.id, u.email, u.full_name, u.username, ai.password_hash
       from users u
       join auth_identities ai on ai.user_id = u.id
       where lower(u.full_name) = lower($1) and ai.provider = 'manual'`,
      [identifier.trim()]
    );

    if (byName.rows.length === 0) {
      return res.status(401).json({ error: { message: "No se encontró ninguna cuenta con ese nombre o usuario." } });
    }

    // Find the one whose password matches
    let matched: LoginRow | null = null;
    for (const candidate of byName.rows) {
      if (candidate.password_hash && await bcrypt.compare(password, candidate.password_hash)) {
        if (matched) {
          // Two accounts with same name AND same password — extremely unlikely but handle it
          return res.status(409).json({
            error: { message: "Hay varias cuentas con ese nombre y la misma contraseña. Inicia sesión con tu correo o nombre de usuario." },
          });
        }
        matched = candidate;
      }
    }

    if (!matched) {
      const hint = byName.rows.length > 1
        ? "Hay varias cuentas con ese nombre. Prueba con tu nombre de usuario o correo."
        : "Contraseña incorrecta.";
      return res.status(401).json({ error: { message: hint } });
    }

    return res.status(200).json(buildAuthResponse(matched));
  } catch {
    return res.status(500).json({ error: { message: "Could not login user" } });
  }
});

// ─── Google ───────────────────────────────────────────────────────────────────

authRouter.post("/google", async (req, res) => {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  try {
    if (env.googleOAuthClientIds.length === 0) {
      return res.status(400).json({
        error: { message: "GOOGLE_CLIENT_ID missing in backend env for real Google token validation" },
      });
    }

    let email: string | undefined;
    let fullName: string | undefined;

    if (parsed.data.idToken) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: parsed.data.idToken,
          audience: env.googleOAuthClientIds.length === 1 ? env.googleOAuthClientIds[0]! : env.googleOAuthClientIds,
        });
        const payload = ticket.getPayload();
        email = payload?.email;
        fullName = payload?.name ?? undefined;
      } catch {
        // idToken can fail for non-web clients; try accessToken below
      }
    }
    if (!email && parsed.data.accessToken) {
      const googleResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${parsed.data.accessToken}` },
      });
      if (!googleResponse.ok) {
        return res.status(401).json({
          error: { message: "No se pudo validar la sesión con Google. Revisa que el correo esté habilitado en Google Cloud." },
        });
      }
      const payload = (await googleResponse.json()) as { email?: string; name?: string };
      email = payload.email;
      fullName = payload.name;
    }

    if (!email) {
      return res.status(401).json({ error: { message: "Google no devolvió el correo. Prueba otra vez." } });
    }

    let userResult = await runQuery<UserRow>(
      `select id, email, full_name, username from users where email = $1 limit 1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      userResult = await runQuery<UserRow>(
        `insert into users (email, full_name)
         values ($1, $2)
         returning id, email, full_name, username`,
        [email, fullName ?? "Usuario Google"]
      );
      await runQuery(
        `insert into auth_identities (user_id, provider, provider_user_id)
         values ($1, 'google', $2)
         on conflict (provider, provider_user_id) do nothing`,
        [userResult.rows[0].id, email]
      );
    }

    return res.status(200).json(buildAuthResponse(userResult.rows[0]));
  } catch {
    return res.status(500).json({ error: { message: "Could not authenticate with Google" } });
  }
});

// ─── /me GET ──────────────────────────────────────────────────────────────────

authRouter.get("/me", requireAuth, async (req, res) => {
  const userId = req.authUser?.id;
  if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });
  try {
    const result = await runQuery<UserRow>(
      `select id, email, full_name, username from users where id = $1`,
      [userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: { message: "User not found" } });
    const u = result.rows[0];
    return res.status(200).json({ user: { id: u.id, email: u.email, fullName: u.full_name ?? "", username: u.username ?? null } });
  } catch {
    return res.status(200).json({ user: { id: req.authUser?.id, email: req.authUser?.email } });
  }
});

// ─── /me PATCH ────────────────────────────────────────────────────────────────

authRouter.patch("/me", requireAuth, async (req, res) => {
  const schema = z.object({
    fullName: z.string().min(2).optional(),
    username: usernameSchema.optional().nullable(),
    currentPassword: z.string().min(8).optional(),
    newPassword: z.string().min(8).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    // Return the first meaningful error message
    const firstMsg = Object.values(parsed.error.flatten().fieldErrors ?? {})[0]?.[0];
    return res.status(422).json({ error: { message: firstMsg ?? "Datos inválidos." } });
  }

  const userId = req.authUser?.id;
  if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

  try {
    if (parsed.data.fullName) {
      await runQuery(`update users set full_name = $1, updated_at = now() where id = $2`, [parsed.data.fullName, userId]);
    }

    if (parsed.data.username !== undefined) {
      if (parsed.data.username !== null) {
        const existing = await runQuery<{ id: string }>(
          `select id from users where lower(username) = lower($1) and id != $2 limit 1`,
          [parsed.data.username, userId]
        );
        if (existing.rows.length > 0) {
          return res.status(409).json({ error: { message: "Ese nombre de usuario ya está en uso." } });
        }
      }
      await runQuery(`update users set username = $1, updated_at = now() where id = $2`, [parsed.data.username, userId]);
    }

    if (parsed.data.currentPassword && parsed.data.newPassword) {
      const ai = await runQuery<{ password_hash: string | null }>(
        `select password_hash from auth_identities where user_id = $1 and provider = 'manual' limit 1`,
        [userId]
      );
      const hash = ai.rows[0]?.password_hash;
      if (!hash) return res.status(400).json({ error: { message: "Esta cuenta no tiene contraseña manual." } });
      if (!await bcrypt.compare(parsed.data.currentPassword, hash)) {
        return res.status(400).json({ error: { message: "La contraseña actual es incorrecta." } });
      }
      const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
      await runQuery(
        `update auth_identities set password_hash = $1 where user_id = $2 and provider = 'manual'`,
        [newHash, userId]
      );
    }

    const updated = await runQuery<UserRow>(`select id, email, full_name, username from users where id = $1`, [userId]);
    const u = updated.rows[0];
    return res.status(200).json({ user: { id: u.id, email: u.email, fullName: u.full_name ?? "", username: u.username ?? null } });
  } catch {
    return res.status(500).json({ error: { message: "No se pudo actualizar el perfil." } });
  }
});

// ─── Forgot / Reset password ─────────────────────────────────────────────────

authRouter.post("/refresh", async (req, res) => {
  const { refreshToken } = req.body as { refreshToken?: string };
  if (!refreshToken) return res.status(400).json({ error: { message: "refreshToken requerido" } });
  try {
    const payload = jwt.verify(refreshToken, env.jwtSecret) as { sub: string; type?: string };
    if (payload.type !== "refresh") return res.status(401).json({ error: { message: "Token inválido" } });
    const result = await runQuery<UserRow>(
      `select id, email, full_name, username from users where id = $1 limit 1`,
      [payload.sub]
    );
    if (result.rows.length === 0) return res.status(401).json({ error: { message: "Usuario no encontrado" } });
    return res.status(200).json(buildAuthResponse(result.rows[0]));
  } catch {
    return res.status(401).json({ error: { message: "Token expirado o inválido. Inicia sesión nuevamente." } });
  }
});

authRouter.post("/forgot-password", async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: { message: "Ingresa un correo válido." } });

  // Always respond 200 to avoid user enumeration
  res.status(200).json({ message: "Si existe una cuenta con ese correo, recibirás el enlace en breve." });

  try {
    const result = await runQuery<{ id: string; email: string; full_name: string | null }>(
      `select id, email, full_name from users where lower(email) = lower($1) limit 1`,
      [parsed.data.email.trim()]
    );
    if (result.rows.length === 0) return; // silently skip

    const user = result.rows[0];
    // JWT as reset token — 1 hour expiry
    const token = jwt.sign(
      { sub: user.id, email: user.email, purpose: "password_reset" },
      env.jwtSecret,
      { expiresIn: "1h" }
    );
    const resetUrl = `${env.publicUrl}/v1/auth/reset-password?token=${encodeURIComponent(token)}`;
    await sendPasswordResetEmail(user.email, resetUrl, user.full_name?.split(" ")[0] ?? "Usuario");
  } catch {
    // swallow errors silently (already responded 200)
  }
});

/** Serve the reset password HTML form */
authRouter.get("/reset-password", (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  const error = typeof req.query.error === "string" ? req.query.error : "";
  const done = req.query.done === "1";

  if (done) {
    return res.send(resetHtml("", "", true));
  }
  if (!token) {
    return res.status(400).send(resetHtml("", "Enlace inválido o expirado. Solicita uno nuevo desde la app.", false));
  }
  return res.send(resetHtml(token, error, false));
});

/** Process the reset password form */
authRouter.post("/reset-password", async (req, res) => {
  const { token, password } = req.body as { token?: string; password?: string };

  if (!token || !password || password.length < 8) {
    const msg = !password || password.length < 8
      ? "La contraseña debe tener al menos 8 caracteres."
      : "Token faltante.";
    return res.redirect(`/v1/auth/reset-password?token=${encodeURIComponent(token ?? "")}&error=${encodeURIComponent(msg)}`);
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub?: string; purpose?: string; email?: string };
    if (payload.purpose !== "password_reset" || !payload.sub) {
      return res.redirect(`/v1/auth/reset-password?token=&error=${encodeURIComponent("Enlace inválido o expirado.")}`);
    }

    const newHash = await bcrypt.hash(password, 10);
    // Update password in auth_identities (manual provider)
    const result = await runQuery(
      `update auth_identities set password_hash = $1
       where user_id = $2 and provider = 'manual'`,
      [newHash, payload.sub]
    );

    if ((result.rowCount ?? 0) === 0) {
      return res.redirect(`/v1/auth/reset-password?token=&error=${encodeURIComponent("Esta cuenta no tiene contraseña manual.")}`);
    }

    return res.redirect("/v1/auth/reset-password?done=1");
  } catch {
    return res.redirect(`/v1/auth/reset-password?token=&error=${encodeURIComponent("El enlace expiró o es inválido. Solicita uno nuevo.")}`);
  }
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function resetHtml(token: string, error: string, done: boolean): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Restablecer contraseña · Finanzas</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#060A18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
    .card{background:#0D1426;border:1px solid #1A2744;border-radius:20px;padding:36px 32px;width:100%;max-width:420px}
    .logo{text-align:center;margin-bottom:24px}
    .logo-icon{font-size:40px}
    .logo-title{color:#F1F5F9;font-size:22px;font-weight:800;margin-top:8px}
    h2{color:#F1F5F9;font-size:20px;font-weight:700;margin-bottom:8px;text-align:center}
    p{color:#94A3B8;font-size:14px;text-align:center;line-height:1.5;margin-bottom:24px}
    label{display:block;color:#94A3B8;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px}
    input[type=password]{width:100%;background:#131E38;border:1px solid #1A2744;border-radius:12px;color:#F1F5F9;font-size:15px;padding:13px 14px;outline:none;margin-bottom:16px}
    input[type=password]:focus{border-color:#6366F1}
    button{width:100%;background:#6366F1;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:800;padding:15px;cursor:pointer;margin-top:4px}
    button:active{opacity:0.85}
    .error{color:#EF4444;font-size:13px;text-align:center;margin-bottom:16px;background:rgba(239,68,68,0.1);border-radius:8px;padding:10px}
    .success-icon{font-size:52px;text-align:center;margin-bottom:16px}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">💰</div>
      <div class="logo-title">Finanzas App</div>
    </div>
    ${done ? `
      <div class="success-icon">✅</div>
      <h2>¡Contraseña actualizada!</h2>
      <p>Tu contraseña se cambió correctamente. Vuelve a la app e inicia sesión con tu nueva contraseña.</p>
    ` : `
      <h2>Nueva contraseña</h2>
      <p>Ingresa tu nueva contraseña. Debe tener al menos 8 caracteres.</p>
      ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
      <form method="POST" action="/v1/auth/reset-password">
        <input type="hidden" name="token" value="${token.replace(/"/g, "&quot;")}">
        <label>Nueva contraseña</label>
        <input type="password" name="password" placeholder="Mínimo 8 caracteres" required minlength="8" autofocus>
        <label>Confirmar contraseña</label>
        <input type="password" name="password2" placeholder="Repite la contraseña" required minlength="8"
          oninput="document.getElementById('sbtn').disabled=this.value!==this.form.password.value">
        <button id="sbtn" type="submit">Guardar nueva contraseña</button>
      </form>
      <script>
        document.querySelector('form').onsubmit=function(e){
          if(this.password.value!==this.password2.value){e.preventDefault();alert('Las contraseñas no coinciden.');}
        };
      </script>
    `}
  </div>
</body>
</html>`;
}

// ─── Check username availability ──────────────────────────────────────────────

authRouter.get("/check-username/:username", async (req, res) => {
  const { username } = req.params;
  const validation = usernameSchema.safeParse(username);
  if (!validation.success) {
    return res.status(200).json({ available: false, error: validation.error.issues[0]?.message });
  }
  try {
    const result = await runQuery<{ count: string }>(
      `select count(*)::text as count from users where lower(username) = lower($1)`,
      [username]
    );
    const taken = Number(result.rows[0]?.count ?? 0) > 0;
    return res.status(200).json({ available: !taken });
  } catch {
    return res.status(500).json({ available: false, error: "Error al verificar disponibilidad." });
  }
});
