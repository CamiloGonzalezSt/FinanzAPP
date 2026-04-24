import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: { message: "Missing bearer token" } });
  }

  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string; email: string };
    req.authUser = { id: payload.sub, email: payload.email };
    return next();
  } catch {
    return res.status(401).json({ error: { message: "Invalid token" } });
  }
}
