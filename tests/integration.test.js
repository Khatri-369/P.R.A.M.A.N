import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  writeFile,
  unlink,
  rm,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
let mongo,
  directory,
  app,
  Evidence,
  User,
  CustodyLog,
  AuditLog,
  tokens = {},
  users = {},
  evidence;
const source = Buffer.from(
  "%PDF-1.4\nPRAMAN sample evidence for integration testing.\n%%EOF",
);
function as(role, method, route) {
  return request(app)
    [method](route)
    .set("Authorization", `Bearer ${tokens[role]}`);
}
before(
  async () => {
    directory = await mkdtemp(path.join(tmpdir(), "praman-test-"));
    process.env.UPLOAD_DIR = directory;
    process.env.JWT_SECRET = "integration-test-secret-at-least-32-characters";
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri("test"));
    ({ default: Evidence } = await import("../backend/models/Evidence.js"));
    ({ default: User } = await import("../backend/models/User.js"));
    ({ default: CustodyLog } = await import("../backend/models/CustodyLog.js"));
    ({ default: AuditLog } = await import("../backend/models/AuditLog.js"));
    const { seed } = await import("../backend/seed.js");
    await seed();
    await seed();
    app = (await import("../backend/app.js")).createApp();
  },
  { timeout: 300000 },
);
after(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("complete demo scenario and security boundaries", async (t) => {
  await t.test("seed is idempotent and passwords are hashed", async () => {
    assert.equal(await User.countDocuments(), 3);
    const user = await User.findOne({ role: "admin" }).select("+password");
    assert.match(user.password, /^\$2[ab]\$/);
  });
  await t.test("authentication, inactive and malformed tokens", async () => {
    assert.equal((await request(app).get("/api/evidence")).status, 401);
    assert.equal(
      (
        await request(app)
          .get("/api/evidence")
          .set("Authorization", "Bearer invalid")
      ).status,
      401,
    );
    assert.equal(
      (
        await request(app)
          .post("/api/auth/login")
          .send({ email: "admin@praman.com", password: "bad" })
      ).status,
      401,
    );
    for (const [role, password] of [
      ["admin", "Admin@123"],
      ["investigator", "Investigator@123"],
      ["forensic", "Forensic@123"],
    ]) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: `${role}@praman.com`, password });
      assert.equal(res.status, 200);
      tokens[role] = res.body.data.token;
      users[role] = res.body.data.user;
      assert.equal(res.body.data.user.password, undefined);
    }
  });
  let newUser;
  await t.test("admin creates investigator; permissions enforced", async () => {
    const body = {
      name: "Case Investigator",
      email: "case@example.com",
      password: "Case@12345",
      role: "investigator",
    };
    assert.equal(
      (await as("forensic", "post", "/api/users").send(body)).status,
      403,
    );
    const created = await as("admin", "post", "/api/users").send(body);
    assert.equal(created.status, 201);
    newUser = created.body.data;
    assert.equal(created.body.data.password, undefined);
    assert.equal(
      (await as("admin", "post", "/api/users").send(body)).status,
      409,
    );
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: body.email, password: body.password });
    tokens.case = res.body.data.token;
    users.case = res.body.data.user;
    assert.equal((await as("investigator", "get", "/api/audit")).status, 403);
    assert.equal((await as("forensic", "get", "/api/users")).status, 403);
  });
  await t.test(
    "upload validates content and cleans rejected files",
    async () => {
      const upload = (role, buffer, filename, type) =>
        as(role, "post", "/api/evidence")
          .field("title", "Sample <report> & evidence")
          .field("caseNumber", "CASE-001")
          .field("evidenceType", "Document")
          .field("description", "Case demo")
          .attach("file", buffer, { filename, contentType: type });
      assert.equal(
        (await upload("admin", source, "sample.pdf", "application/pdf")).status,
        403,
      );
      assert.equal(
        (
          await upload(
            "case",
            Buffer.from("fake PDF"),
            "fake.pdf",
            "application/pdf",
          )
        ).status,
        400,
      );
      assert.equal(
        (await upload("case", source, "fake.exe", "application/pdf")).status,
        400,
      );
      assert.equal(
        (
          await upload(
            "case",
            Buffer.alloc(10 * 1024 * 1024 + 1),
            "large.pdf",
            "application/pdf",
          )
        ).status,
        413,
      );
      assert.equal((await readdir(directory)).length, 0);
      const res = await upload(
        "case",
        source,
        "sample-evidence.pdf",
        "application/pdf",
      );
      assert.equal(res.status, 201);
      evidence = res.body.data;
      assert.match(evidence.evidenceId, /^EV-\d{4}-\d{4,}$/);
      assert.equal(
        evidence.sha256Hash,
        createHash("sha256").update(source).digest("hex"),
      );
      assert.equal(evidence.filePath, undefined);
      assert.equal(evidence.storedFilename, undefined);
      assert.equal(
        await CustodyLog.countDocuments({
          evidence: evidence._id,
          action: "UPLOADED",
        }),
        1,
      );
    },
  );
  await t.test(
    "listing, literal search, pagination, filters, object IDs and file privacy",
    async () => {
      assert.equal(
        (
          await as(
            "case",
            "get",
            "/api/evidence?search=Sample&type=Document&caseNumber=CASE-001",
          )
        ).body.data.total,
        1,
      );
      assert.equal(
        (await as("case", "get", "/api/evidence?search=%5B")).body.data.total,
        0,
      );
      assert.equal(
        (await as("case", "get", "/api/evidence?page=-1")).status,
        400,
      );
      assert.equal(
        (await as("case", "get", "/api/evidence?status=unknown")).status,
        400,
      );
      assert.equal(
        (await as("case", "get", "/api/evidence/invalid")).status,
        400,
      );
      assert.equal(
        (await as("case", "get", "/api/evidence/000000000000000000000000"))
          .status,
        404,
      );
      assert.equal(
        (await as("forensic", "get", `/api/evidence/${evidence._id}`)).status,
        404,
      );
      assert.equal(
        (await as("forensic", "get", "/api/evidence")).body.data.total,
        0,
      );
      assert.equal(
        (await request(app).get("/uploads/sample-evidence.pdf")).status,
        404,
      );
      assert.equal(
        (await as("case", "get", `/api/evidence/${evidence._id}/download`))
          .status,
        200,
      );
    },
  );
  await t.test(
    "verification preserves original hash; tampering and missing files fail",
    async () => {
      const route = `/api/evidence/${evidence._id}/verify`;
      assert.equal((await as("admin", "post", route)).status, 403);
      let res = await as("case", "post", route);
      assert.equal(res.body.data.status, "Verified");
      const stored = await Evidence.findById(evidence._id).select("+filePath");
      await writeFile(stored.filePath, "modified bytes");
      res = await as("case", "post", route);
      assert.equal(res.body.data.status, "Failed");
      assert.notEqual(res.body.data.currentHash, evidence.sha256Hash);
      assert.equal(
        (await Evidence.findById(evidence._id)).sha256Hash,
        evidence.sha256Hash,
      );
      await unlink(stored.filePath);
      res = await as("case", "post", route);
      assert.equal(res.body.data.status, "Failed");
      assert.equal(res.body.data.missing, true);
      assert.equal(
        (await as("case", "get", `/api/evidence/${evidence._id}/download`))
          .status,
        404,
      );
      await writeFile(stored.filePath, source);
      assert.equal(
        (await as("case", "post", route)).body.data.status,
        "Verified",
      );
    },
  );
  await t.test(
    "only current holder or admin can transfer; forensic access follows assignment",
    async () => {
      const body = {
        evidenceId: evidence._id,
        toUserId: users.forensic.id,
        remarks: "Assign for forensic review <A & B>",
      };
      assert.equal(
        (await as("investigator", "post", "/api/custody/transfer").send(body))
          .status,
        403,
      );
      assert.equal(
        (
          await as("case", "post", "/api/custody/transfer").send({
            ...body,
            toUserId: users.case.id,
          })
        ).status,
        400,
      );
      const res = await as("case", "post", "/api/custody/transfer").send(body);
      assert.equal(res.status, 200);
      assert.equal(res.body.data.currentHolder, users.forensic.id);
      assert.equal(
        (await as("forensic", "get", "/api/evidence")).body.data.total,
        1,
      );
      assert.equal(
        (await as("forensic", "post", `/api/evidence/${evidence._id}/verify`))
          .body.data.status,
        "Verified",
      );
      assert.equal(
        (await as("case", "post", "/api/custody/transfer").send(body)).status,
        403,
      );
      assert.equal(
        (await as("forensic", "post", "/api/custody/transfer").send(body))
          .status,
        403,
      );
    },
  );
  await t.test("forensic notes/status and append-only custody", async () => {
    assert.equal(
      (
        await as(
          "forensic",
          "post",
          `/api/evidence/${evidence._id}/notes`,
        ).send({ text: "Reviewed <tag> & contents" })
      ).status,
      200,
    );
    assert.equal(
      (
        await as(
          "forensic",
          "patch",
          `/api/evidence/${evidence._id}/status`,
        ).send({ status: "Under Review" })
      ).status,
      200,
    );
    assert.equal(
      (
        await as(
          "forensic",
          "patch",
          `/api/evidence/${evidence._id}/status`,
        ).send({ status: "Verified" })
      ).status,
      200,
    );
    assert.equal(
      (
        await as("case", "patch", `/api/evidence/${evidence._id}/status`).send({
          status: "Archived",
        })
      ).status,
      403,
    );
    const res = await as("forensic", "get", `/api/custody/${evidence._id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.logs[0].action, "UPLOADED");
    assert.ok(res.body.data.logs.some((l) => l.action === "TRANSFERRED"));
    assert.equal(
      (await as("admin", "delete", `/api/custody/${evidence._id}`)).status,
      404,
    );
  });
  await t.test(
    "dashboard, audit filters, and XML escaping/export permissions",
    async () => {
      const dashboard = await as("admin", "get", "/api/dashboard/stats");
      assert.equal(dashboard.body.data.totalEvidence, 1);
      assert.equal(dashboard.body.data.verifiedEvidence, 1);
      const logs = await as(
        "admin",
        "get",
        "/api/audit?action=EVIDENCE_TRANSFERRED",
      );
      assert.equal(logs.body.data.total, 1);
      assert.equal(
        (
          await as(
            "admin",
            "get",
            `/api/audit?evidenceId=${evidence.evidenceId}`,
          )
        ).body.data.total > 0,
        true,
      );
      assert.equal(
        (await as("admin", "get", "/api/audit?evidenceId=missing")).body.data
          .total,
        0,
      );
      assert.equal(
        (await as("admin", "get", "/api/audit?startDate=wrong")).status,
        400,
      );
      const xml = await as("admin", "get", "/api/audit/export/xml");
      assert.equal(xml.status, 200);
      assert.match(xml.text, /<AuditLogs>/);
      assert.match(xml.text, /&lt;A &amp; B&gt;/);
      assert.match(xml.headers["content-disposition"], /attachment/);
      assert.equal(
        (await as("forensic", "get", "/api/audit/export/xml")).status,
        403,
      );
      const custody = await as(
        "admin",
        "get",
        `/api/custody/${evidence._id}/export/xml`,
      );
      assert.match(custody.text, /<ChainOfCustody/);
      assert.ok(await AuditLog.exists({ action: "XML_EXPORTED" }));
    },
  );
  await t.test(
    "deactivation blocks login and existing JWT; holder deactivation is blocked",
    async () => {
      assert.equal(
        (
          await as(
            "admin",
            "patch",
            `/api/users/${users.forensic.id}/status`,
          ).send({ isActive: false })
        ).status,
        409,
      );
      assert.equal(
        (
          await as(
            "admin",
            "patch",
            `/api/users/${users.admin.id}/status`,
          ).send({ isActive: false })
        ).status,
        400,
      );
      assert.equal(
        (
          await as("admin", "patch", `/api/users/${newUser.id}/status`).send({
            isActive: false,
          })
        ).status,
        200,
      );
      assert.equal((await as("case", "get", "/api/evidence")).status, 401);
      assert.equal(
        (
          await request(app)
            .post("/api/auth/login")
            .send({ email: "case@example.com", password: "Case@12345" })
        ).status,
        401,
      );
      assert.equal(
        (
          await as("admin", "patch", `/api/users/${newUser.id}/status`).send({
            isActive: true,
          })
        ).status,
        200,
      );
      assert.equal((await as("case", "post", "/api/auth/logout")).status, 200);
    },
  );
  await t.test(
    "all frontend pages, scripts, and styles are served",
    async () => {
      for (const page of [
        "",
        "dashboard",
        "evidence",
        "evidence-details",
        "upload",
        "custody",
        "audit",
        "users",
      ]) {
        const res = await request(app).get(page ? `/${page}.html` : "/");
        assert.equal(res.status, 200);
        for (const match of res.text.matchAll(
          /(?:src|href)="(\/(?:js|css)\/[^\"]+)"/g,
        ))
          assert.equal((await request(app).get(match[1])).status, 200);
      }
    },
  );
});

test("competing transfers commit only one handover for the current investigator", async () => {
  const reassigned = await as("admin", "post", "/api/custody/transfer").send({
    evidenceId: evidence._id,
    toUserId: users.case.id,
    remarks: "Return for concurrency test",
  });
  assert.equal(reassigned.status, 200);
  const beforeCount = await CustodyLog.countDocuments({
    evidence: evidence._id,
    action: "TRANSFERRED",
  });
  const results = await Promise.all(
    [users.investigator.id, users.forensic.id].map((toUserId) =>
      as("case", "post", "/api/custody/transfer").send({
        evidenceId: evidence._id,
        toUserId,
        remarks: "Concurrent handover test",
      }),
    ),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 403]);
  assert.equal(
    await CustodyLog.countDocuments({
      evidence: evidence._id,
      action: "TRANSFERRED",
    }),
    beforeCount + 1,
  );
  const winner = results.find((r) => r.status === 200).body.data.currentHolder;
  assert.equal(
    String((await Evidence.findById(evidence._id)).currentHolder),
    winner,
  );
});

test("failed history write rolls back evidence changes", async () => {
  const beforeEvidence = await Evidence.findById(evidence._id);
  const beforeCount = await CustodyLog.countDocuments({
    evidence: evidence._id,
  });
  const originalCreate = AuditLog.create;
  AuditLog.create = async function (documents, options) {
    if (documents[0]?.action === "NOTE_ADDED")
      throw Object.assign(new Error("Simulated history storage failure"), {
        status: 503,
      });
    return originalCreate.call(this, documents, options);
  };
  try {
    const response = await as(
      "investigator",
      "post",
      `/api/evidence/${evidence._id}/notes`,
    ).send({ text: "This note must roll back." });
    assert.equal(response.status, 503);
  } finally {
    AuditLog.create = originalCreate;
  }
  assert.equal(
    (await Evidence.findById(evidence._id)).notes.length,
    beforeEvidence.notes.length,
  );
  assert.equal(
    await CustodyLog.countDocuments({ evidence: evidence._id }),
    beforeCount,
  );
});
