import { clerkClient } from "@clerk/express";

export const auth = async (req, res, next) => {
  try {
    const { userId, sessionClaims } = req.auth(); // ✅ FIXED

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = await clerkClient.users.getUser(userId);

    const plan =
      user?.privateMetadata?.plan ||
      user?.publicMetadata?.plan ||
      "free";

    const currentFreeUsageRaw = user?.privateMetadata?.free_usage;

    const currentFreeUsage = Number.isFinite(Number(currentFreeUsageRaw))
      ? Number(currentFreeUsageRaw)
      : 0;

    if (plan !== "premium") {
      req.free_usage = currentFreeUsage;
      req.plan = "free";
      return next();
    }

    await clerkClient.users.updateUserMetadata(userId, {
      privateMetadata: {
        free_usage: 0,
      },
    });

    req.free_usage = 0;
    req.plan = "premium";

    next();
  } catch (error) {
    console.log("AUTH ERROR:", error);

    return res.status(401).json({
      success: false,
      message: error?.message || "Unauthorized",
    });
  }
};