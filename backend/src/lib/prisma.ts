import { PrismaClient } from "@prisma/client";

declare global {
  // Reuse the client across ts-node-dev reloads in development.
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

function buildPrismaUrl() {
  const rawUrl = process.env.DATABASE_URL;

  if (!rawUrl) {
    return undefined;
  }

  const isSupabasePooler = rawUrl.includes("pooler.supabase.com");
  if (!isSupabasePooler) {
    return rawUrl;
  }

  const url = new URL(rawUrl);

  // Prisma works best with the Supabase pooler when connections are short-lived.
  if (!url.searchParams.has("pgbouncer")) {
    url.searchParams.set("pgbouncer", "true");
  }

  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "1");
  }

  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", "20");
  }

  return url.toString();
}

const prismaUrl = buildPrismaUrl();

const prismaClientSingleton = () =>
  new PrismaClient(
    prismaUrl
      ? {
          datasources: {
            db: {
              url: prismaUrl,
            },
          },
        }
      : undefined
  );

const prisma = globalThis.__prisma__ ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma__ = prisma;
}

export default prisma;
