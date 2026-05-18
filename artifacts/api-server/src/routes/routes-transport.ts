import { Router, type IRouter } from "express";
import { eq, ilike, count, sum, and } from "drizzle-orm";
import { db, routesTable, tripsTable, tripPaymentsTable } from "@workspace/db";
import {
  ListRoutesQueryParams,
  CreateRouteBody,
  GetRouteParams,
  UpdateRouteBody,
  UpdateRouteParams,
  DeleteRouteParams,
  GetRouteStatsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/routes", async (req, res): Promise<void> => {
  const query = ListRoutesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { status, search } = query.data;
  const conditions = [];
  if (status) conditions.push(eq(routesTable.status, status));
  if (search) conditions.push(ilike(routesTable.name, `%${search}%`));

  const { and } = await import("drizzle-orm");
  const routes = await db
    .select()
    .from(routesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(routesTable.name);

  res.json(
    routes.map((r) => ({
      ...r,
      fare: parseFloat(r.fare),
      distanceKm: r.distanceKm != null ? parseFloat(r.distanceKm) : null,
    })),
  );
});

router.post("/routes", async (req, res): Promise<void> => {
  const parsed = CreateRouteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [route] = await db
    .insert(routesTable)
    .values({
      ...parsed.data,
      fare: String(parsed.data.fare),
      distanceKm: parsed.data.distanceKm != null ? String(parsed.data.distanceKm) : undefined,
    })
    .returning();

  res.status(201).json({
    ...route,
    fare: parseFloat(route.fare),
    distanceKm: route.distanceKm != null ? parseFloat(route.distanceKm) : null,
  });
});

router.get("/routes/:id", async (req, res): Promise<void> => {
  const params = GetRouteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [route] = await db
    .select()
    .from(routesTable)
    .where(eq(routesTable.id, params.data.id));

  if (!route) {
    res.status(404).json({ error: "Route not found" });
    return;
  }

  res.json({
    ...route,
    fare: parseFloat(route.fare),
    distanceKm: route.distanceKm != null ? parseFloat(route.distanceKm) : null,
  });
});

router.patch("/routes/:id", async (req, res): Promise<void> => {
  const params = UpdateRouteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateRouteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.fare != null) updateData.fare = String(parsed.data.fare);
  if (parsed.data.distanceKm != null) updateData.distanceKm = String(parsed.data.distanceKm);

  const [route] = await db
    .update(routesTable)
    .set(updateData)
    .where(eq(routesTable.id, params.data.id))
    .returning();

  if (!route) {
    res.status(404).json({ error: "Route not found" });
    return;
  }

  res.json({
    ...route,
    fare: parseFloat(route.fare),
    distanceKm: route.distanceKm != null ? parseFloat(route.distanceKm) : null,
  });
});

router.delete("/routes/:id", async (req, res): Promise<void> => {
  const params = DeleteRouteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [route] = await db
    .delete(routesTable)
    .where(eq(routesTable.id, params.data.id))
    .returning();

  if (!route) {
    res.status(404).json({ error: "Route not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/routes/:id/stats", async (req, res): Promise<void> => {
  const params = GetRouteStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [route] = await db
    .select()
    .from(routesTable)
    .where(eq(routesTable.id, params.data.id));

  if (!route) {
    res.status(404).json({ error: "Route not found" });
    return;
  }

  const [tripStats] = await db
    .select({
      totalTrips: count(),
      completedTrips: count(
        and(eq(tripsTable.routeId, params.data.id), eq(tripsTable.status, "completed")),
      ),
    })
    .from(tripsTable)
    .where(eq(tripsTable.routeId, params.data.id));

  const completedTripIds = await db
    .select({ id: tripsTable.id, passengerCount: tripsTable.passengerCount })
    .from(tripsTable)
    .where(and(eq(tripsTable.routeId, params.data.id), eq(tripsTable.status, "completed")));

  const [revenueRow] = await db
    .select({ total: sum(tripPaymentsTable.amount) })
    .from(tripPaymentsTable)
    .where(eq(tripPaymentsTable.status, "completed"));

  const totalPassengers = completedTripIds.reduce(
    (acc, t) => acc + t.passengerCount,
    0,
  );
  const completedCount = completedTripIds.length;

  res.json({
    routeId: params.data.id,
    totalTrips: tripStats?.totalTrips ?? 0,
    completedTrips: completedCount,
    totalRevenue: parseFloat(revenueRow?.total ?? "0"),
    totalPassengers,
    avgPassengersPerTrip:
      completedCount > 0
        ? Math.round((totalPassengers / completedCount) * 100) / 100
        : 0,
  });
});

export default router;
