import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, vehiclesTable } from "@workspace/db";
import {
  ListVehiclesQueryParams,
  CreateVehicleBody,
  GetVehicleParams,
  UpdateVehicleBody,
  UpdateVehicleParams,
  DeleteVehicleParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/vehicles", async (req, res): Promise<void> => {
  const query = ListVehiclesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { driverId, routeId, status, type } = query.data;
  const conditions = [];
  if (driverId) conditions.push(eq(vehiclesTable.driverId, driverId));
  if (routeId) conditions.push(eq(vehiclesTable.routeId, routeId));
  if (status) conditions.push(eq(vehiclesTable.status, status));
  if (type) conditions.push(eq(vehiclesTable.type, type));

  const vehicles = await db
    .select()
    .from(vehiclesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(vehiclesTable.createdAt);

  res.json(vehicles);
});

router.post("/vehicles", async (req, res): Promise<void> => {
  const parsed = CreateVehicleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select()
    .from(vehiclesTable)
    .where(eq(vehiclesTable.plate, parsed.data.plate));
  if (existing.length > 0) {
    res.status(409).json({ error: "License plate already registered" });
    return;
  }

  const [vehicle] = await db
    .insert(vehiclesTable)
    .values(parsed.data)
    .returning();

  res.status(201).json(vehicle);
});

router.get("/vehicles/:id", async (req, res): Promise<void> => {
  const params = GetVehicleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [vehicle] = await db
    .select()
    .from(vehiclesTable)
    .where(eq(vehiclesTable.id, params.data.id));

  if (!vehicle) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  res.json(vehicle);
});

router.patch("/vehicles/:id", async (req, res): Promise<void> => {
  const params = UpdateVehicleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateVehicleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [vehicle] = await db
    .update(vehiclesTable)
    .set(parsed.data)
    .where(eq(vehiclesTable.id, params.data.id))
    .returning();

  if (!vehicle) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  res.json(vehicle);
});

router.delete("/vehicles/:id", async (req, res): Promise<void> => {
  const params = DeleteVehicleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [vehicle] = await db
    .delete(vehiclesTable)
    .where(eq(vehiclesTable.id, params.data.id))
    .returning();

  if (!vehicle) {
    res.status(404).json({ error: "Vehicle not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
