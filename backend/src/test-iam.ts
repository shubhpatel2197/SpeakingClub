import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import type { AssumeRoleCommandOutput } from "@aws-sdk/client-sts";

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

// ─── CONFIG FROM ENV ──────────────────────────────────
const ROLE_ARN = process.env.ROLE_ARN!;
const BUCKET_NAME = process.env.BUCKET_NAME!;
const REGION = process.env.AWS_REGION!;

// Validate env vars
function validateEnv() {
  const required = [
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_REGION",
    "ROLE_ARN",
    "BUCKET_NAME",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing env variables: ${missing.join(", ")}`);
  }

  console.log("✅ Env variables loaded");
}
// ──────────────────────────────────────────────────────

interface BugReport {
  bug_id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: string;
  description: string;
}

// Step 1 — Assume Role in Account B
async function assumeRole() {
  const stsClient = new STSClient({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });

  const command = new AssumeRoleCommand({
    RoleArn: ROLE_ARN,
    RoleSessionName: "bug-storage-poc-session",
    DurationSeconds: 3600,
  });

  const response: AssumeRoleCommandOutput = await stsClient.send(command);

  if (!response.Credentials) {
    throw new Error("Failed to get credentials");
  }

  console.log("✅ Role assumed successfully");
  console.log(`   Access Key : ${response.Credentials.AccessKeyId}`);
  console.log(`   Expires At : ${response.Credentials.Expiration}`);

  return response.Credentials;
}

// Step 2 — Create S3 Client with temp credentials
function createS3Client(credentials: {
  AccessKeyId?: string;
  SecretAccessKey?: string;
  SessionToken?: string;
}) {
  return new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: credentials.AccessKeyId!,
      secretAccessKey: credentials.SecretAccessKey!,
      sessionToken: credentials.SessionToken!,
    },
  });
}

// Step 3 — Write bug to S3
async function writeBug(s3Client: S3Client, bug: BugReport) {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: `bugs/${bug.bug_id}.json`,
    Body: JSON.stringify(bug, null, 2),
    ContentType: "application/json",
  });

  await s3Client.send(command);
  console.log(`✅ Bug written : bugs/${bug.bug_id}.json`);
}

// Step 4 — Read bug from S3
async function readBug(s3Client: S3Client, bugId: string) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: `bugs/${bugId}.json`,
  });

  const response = await s3Client.send(command);
  const body = await response.Body?.transformToString();
  const bug = JSON.parse(body!);

  console.log(`✅ Bug read back:`, bug);
  return bug;
}

// Step 5 — List all bugs
async function listBugs(s3Client: S3Client) {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: "bugs/",
  });

  const response = await s3Client.send(command);
  const files = response.Contents?.map((obj) => obj.Key) ?? [];

  console.log(`✅ All bugs in S3:`, files);
  return files;
}

// ─── MAIN ─────────────────────────────────────────────
async function main() {
  console.log("\n🚀 Starting Cross-Account S3 POC\n");

  try {
    // 0. Validate env
    validateEnv();

    // Debug — print config
    console.log("→ Using Bucket:", process.env.BUCKET_NAME);
    console.log("→ Using Region:", process.env.AWS_REGION);
    console.log("→ Using Role  :", process.env.ROLE_ARN);

    // 1. Assume role
    const credentials = await assumeRole();

    // 2. Create S3 client with temp creds
    const s3Client = createS3Client(credentials);

    // 3. List first (simplest operation)
    console.log("\n→ Trying ListBucket first...");
    await listBugs(s3Client);

    // 4. Write a test bug
    console.log("\n→ Trying PutObject...");
    const testBug: BugReport = {
      bug_id: "BUG-001",
      title: "Login button not working",
      severity: "critical",
      timestamp: new Date().toISOString(),
      description: "Users cannot log in on mobile devices",
    };
    await writeBug(s3Client, testBug);

    // 5. Read it back
    console.log("\n→ Trying GetObject...");
    await readBug(s3Client, "BUG-001");

    console.log("\n✅ POC Complete — Cross account S3 access working!\n");

  } catch (error: any) {
    console.error("\n❌ Error    :", error.message);
    console.error("❌ Code     :", error.name);
    console.error("❌ HTTP     :", error.$metadata?.httpStatusCode);
    console.error("❌ RequestId:", error.$metadata?.requestId);
  }
}

main();