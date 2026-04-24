import { Router } from "express";
import { z } from "zod";
import { runQuery } from "../../db/pool";

export const categoriesRouter = Router();

const DEFAULT_CATEGORIES: Array<{ name: string; colorHex: string; icon: string; subs: string[] }> = [
  { name: "Alimentación", colorHex: "#F59E0B", icon: "🍔", subs: ["Restaurantes", "Supermercado", "Delivery", "Cafetería"] },
  { name: "Transporte", colorHex: "#3B82F6", icon: "🚗", subs: ["Bencina", "Metro / Bus", "Taxi / Uber", "Peaje"] },
  { name: "Vivienda", colorHex: "#8B5CF6", icon: "🏠", subs: ["Arriendo", "Dividendo", "Electricidad", "Agua / Gas", "Condominio"] },
  { name: "Salud", colorHex: "#EF4444", icon: "💊", subs: ["Médico", "Farmacia", "Exámenes", "Seguro médico"] },
  { name: "Entretención", colorHex: "#EC4899", icon: "🎮", subs: ["Streaming", "Salidas", "Hobbies", "Deportes"] },
  { name: "Vestuario", colorHex: "#14B8A6", icon: "👔", subs: ["Ropa", "Calzado", "Accesorios"] },
  { name: "Educación", colorHex: "#6366F1", icon: "📚", subs: ["Colegio / Universidad", "Cursos", "Libros"] },
  { name: "Tecnología", colorHex: "#0EA5E9", icon: "💻", subs: ["Suscripciones", "Hardware", "Software"] },
  { name: "Ingresos", colorHex: "#22C55E", icon: "💰", subs: ["Sueldo", "Honorarios / Boleta", "Arriendo recibido", "Otro ingreso"] },
  { name: "Ahorro", colorHex: "#A78BFA", icon: "🏦", subs: ["Fondo emergencia", "Inversión", "AFP / Pensión"] },
  { name: "Deudas", colorHex: "#F97316", icon: "💳", subs: ["Tarjeta de crédito", "Crédito bancario", "DICOM"] },
  { name: "Otros", colorHex: "#6B7280", icon: "🔧", subs: [] },
];

/** Crea las categorías por defecto si el usuario aún no tiene ninguna. */
categoriesRouter.post("/seed-defaults", async (req, res) => {
  const userId = req.authUser?.id;
  if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

  try {
    const existing = await runQuery<{ count: string }>(
      `select count(*)::text as count from categories where user_id = $1`,
      [userId]
    );
    if (Number(existing.rows[0]?.count ?? 0) > 0) {
      return res.status(200).json({ created: 0, message: "already_seeded" });
    }

    let created = 0;
    for (const cat of DEFAULT_CATEGORIES) {
      const parent = await runQuery<{ id: string }>(
        `insert into categories (user_id, name, color_hex, icon, is_system)
         values ($1, $2, $3, $4, true)
         returning id`,
        [userId, cat.name, cat.colorHex, cat.icon]
      );
      const parentId = parent.rows[0].id;
      created += 1;

      for (const subName of cat.subs) {
        await runQuery(
          `insert into categories (user_id, name, color_hex, icon, parent_id, is_system)
           values ($1, $2, $3, $4, $5, true)`,
          [userId, subName, cat.colorHex, cat.icon, parentId]
        );
        created += 1;
      }
    }

    return res.status(201).json({ created });
  } catch {
    return res.status(500).json({ error: { message: "Could not seed categories" } });
  }
});

categoriesRouter.get("/", async (req, res) => {
  const userId = req.authUser?.id;
  if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

  try {
    const result = await runQuery<{
      id: string;
      name: string;
      color_hex: string | null;
      icon: string | null;
      parent_id: string | null;
    }>(
      `select id, name, color_hex, icon, parent_id
       from categories
       where user_id = $1 and is_active = true
       order by is_system desc, name asc`,
      [userId]
    );

    const parents = result.rows.filter((r) => !r.parent_id);
    const children = result.rows.filter((r) => r.parent_id);

    const items = parents.map((p) => ({
      id: p.id,
      name: p.name,
      colorHex: p.color_hex,
      icon: p.icon,
      subcategories: children
        .filter((c) => c.parent_id === p.id)
        .map((c) => ({ id: c.id, name: c.name, colorHex: c.color_hex, icon: c.icon })),
    }));

    return res.status(200).json({ items });
  } catch {
    return res.status(200).json({ items: [] });
  }
});

categoriesRouter.post("/", async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    colorHex: z.string().optional(),
    icon: z.string().optional(),
    parentId: z.string().uuid().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ error: parsed.error.flatten() });

  const userId = req.authUser?.id;
  if (!userId) return res.status(401).json({ error: { message: "Unauthorized" } });

  try {
    const result = await runQuery<{ id: string; name: string; color_hex: string | null; parent_id: string | null }>(
      `insert into categories (user_id, name, color_hex, icon, parent_id, is_system)
       values ($1, $2, $3, $4, $5, false)
       returning id, name, color_hex, parent_id`,
      [userId, parsed.data.name, parsed.data.colorHex ?? null, parsed.data.icon ?? null, parsed.data.parentId ?? null]
    );
    return res.status(201).json({
      id: result.rows[0].id,
      name: result.rows[0].name,
      colorHex: result.rows[0].color_hex,
      parentId: result.rows[0].parent_id,
    });
  } catch {
    return res.status(500).json({ error: { message: "Could not create category" } });
  }
});
