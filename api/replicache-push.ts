import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PrismaClient } from "@prisma/client";
import z from "zod";
import Pusher from "pusher";

const Color = z.enum([
  "White",
  "Black",
  "Slate",
  "Gray",
  "Zinc",
  "Neutral",
  "Stone",
  "Red",
  "Orange",
  "Amber",
  "Yellow",
  "Lime",
  "Green",
  "Emerald",
  "Teal",
  "Cyan",
  "Sky",
  "Blue",
  "Indigo",
  "Violet",
  "Purple",
  "Fuchsia",
  "Pink",
  "Rose",
]);

const Mutation = z.object({
  id: z.number(),
  name: z.string(),
  args: z.object({ i: z.number(), color: Color }),
  timestamp: z.number(),
  clientID: z.string().uuid(),
});

const Push = z.object({
  profileID: z.string(),
  clientGroupID: z.string(),
  mutations: z.array(Mutation),
  pushVersion: z.literal(1),
});

type Push = z.infer<typeof Push>;
type Mutation = z.infer<typeof Mutation>;

const db = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const spaceID = "default";
  if (!spaceID) {
    res.status(400);
    res.json({ message: "spaceID is required" });
    return res;
  }
  const push = Push.parse(req.body);
  try {
    const mutations = push.mutations;
    for (const mutation of mutations) {
      try {
        await db.$transaction(
          async (tx) =>
            await processMutation(tx, push.clientGroupID, spaceID, mutation),
          { isolationLevel: "Serializable" },
        );
      } catch (e) {
        console.error(e);
        console.log("Failed to apply mutation", mutation.id, mutation);
      }
    }
  } catch {
    console.log("Failed to apply push");
  }
  await sendPoke(spaceID);
  return res.json({});
}
type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function processMutation(
  tx: Tx,
  clientGroupID: string,
  spaceID: string,
  mutation: Mutation,
  error?: string,
) {
  console.log("Processing mutation", mutation.id);

  const client = await tx.replicacheClient.upsert({
    where: { id: mutation.clientID },
    create: {
      id: mutation.clientID,
      lastMutationID: 0,
      lastModifiedVerson: 0,
    },
    update: {},
  });

  const lastMutationID = client.lastMutationID;
  const nextMuationID = lastMutationID + 1;

  if (mutation.id < nextMuationID) {
    console.log("Mutation already processed, skipping", mutation.id);
    return;
  }

  if (mutation.id > nextMuationID) {
    throw new Error(
      `Mutation ${mutation.id} is from the future - aborting. This can happen in development if the server restarts. In that case, clear appliation data in browser and refresh.`,
    );
  }

  const space = await tx.replicacheSpace.upsert({
    where: { id: spaceID },
    create: { id: spaceID, version: 1 },
    update: { version: { increment: 1 } },
  });

  if (error === undefined) {
    switch (mutation.name) {
      case "setCell":
        await tx.placeCell.upsert({
          where: {
            spaceID_cell: { spaceID: spaceID, cell: mutation.args.i },
          },
          create: {
            spaceID: spaceID,
            cell: mutation.args.i,
            color: mutation.args.color,
            lastModifiedVersion: space.version,
          },
          update: {
            color: mutation.args.color,
            lastModifiedVersion: space.version,
          },
        });
        await tx.replicacheClient.update({
          where: { id: mutation.clientID },
          data: {
            lastMutationID: mutation.id,
            lastModifiedVerson: space.version,
          },
        });
        console.log("done", mutation.id);
        break;
      default:
        throw new Error(`Unknown mutation ${mutation.name}`);
    }
  }
}

async function sendPoke(spaceID: string) {
  const pusher = new Pusher({
    appId: process.env.REPLICHAT_PUSHER_APP_ID,
    key: process.env.VITE_REPLICHAT_PUSHER_KEY,
    secret: process.env.REPLICHAT_PUSHER_SECRET,
    cluster: process.env.VITE_REPLICHAT_PUSHER_CLUSTER,
    useTLS: true,
  });
  await pusher.trigger(spaceID, "poke", {});
}
