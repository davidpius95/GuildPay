import { Router, Response, NextFunction } from "express";
import { prisma } from "../config/db";
import { AuthRequest } from "../middleware/auth";

export const notificationRouter = Router();

// GET / — List notifications with unread count
notificationRouter.get("/", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user!.id, read: false },
    });
    res.json({ notifications, unreadCount });
  } catch (err) { next(err); }
});

// PUT /:id/read — Mark single notification as read
notificationRouter.put("/:id/read", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.id },
      data: { read: true, readAt: new Date() },
    });
    res.json({ read: true });
  } catch (err) { next(err); }
});

// PUT /read-all — Mark all notifications as read
notificationRouter.put("/read-all", async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true, readAt: new Date() },
    });
    res.json({ marked: result.count });
  } catch (err) { next(err); }
});
