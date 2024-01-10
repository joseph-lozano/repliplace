import { PrismaClient } from "@prisma/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";

const Pull = z.object({
  clientGroupID: z.string(),
  cookie: z.number().nullable(),
  pullVersion: z.literal(1),
});

const db = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const spaceID = "default";
  if (!spaceID) {
    res.status(400);
    res.json({ message: "spaceID is required" });
    return res;
  }
  const pull = Pull.parse(req.body);
  const fromVersion = pull.cookie ?? 0;
  try {
    const { lastMutationIDChanges, changed, currentVersion } =
      await db.$transaction(
        async (tx) => {
          const { version: currentVersion } = await tx.replicacheSpace.upsert({
            where: { id: spaceID },
            create: { id: spaceID, version: 0 },
            update: {},
          });

          if (fromVersion > currentVersion) {
            throw new Error(
              `fromVersion ${fromVersion} is from the future - aborting. This can happen in development if the server restarts. In that case, clear appliation data in browser and refresh.`,
            );
          }

          const lastMutationIDChanges: Record<string, number> = {};
          await tx.replicacheClient
            .findMany({
              where: {
                lastMutationID: { gt: fromVersion },
              },
              select: { id: true, lastMutationID: true },
            })
            .then((clients) => {
              clients.forEach(
                ({ id, lastMutationID }) =>
                  (lastMutationIDChanges[id] = lastMutationID),
              );
            });

          const changed = await tx.placeCell.findMany({
            where: { spaceID, lastModifiedVersion: { gt: fromVersion } },
          });

          return { lastMutationIDChanges, changed, currentVersion };
        },
        { isolationLevel: "Serializable" },
      );
    return res.json({
      cookie: currentVersion,
      lastMutationIDChanges,
      patch: changed.map((change) => {
        return {
          op: "put",
          key: `cell/${spaceID}/${change.cell}`,
          value: { i: change.cell, color: change.color },
        };
      }),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ message: "Something went wrong" });
  }
}
