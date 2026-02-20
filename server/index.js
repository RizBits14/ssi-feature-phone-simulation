require("dotenv").config();
const crypto = require("crypto");

const AES_SECRET = process.env.AES_SECRET || "fallback_dev_secret_key_32_chars!";
const AES_KEY = crypto.createHash("sha256").update(AES_SECRET).digest();

function encryptData(data) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", AES_KEY, iv);

    const json = JSON.stringify(data);
    let encrypted = cipher.update(json, "utf8", "base64");
    encrypted += cipher.final("base64");

    const authTag = cipher.getAuthTag();

    return {
        iv: iv.toString("base64"),
        content: encrypted,
        tag: authTag.toString("base64"),
    };
}

function decryptData(enc) {
    if (!enc || !enc.iv || !enc.content || !enc.tag) return enc || {};

    const iv = Buffer.from(enc.iv, "base64");
    const tag = Buffer.from(enc.tag, "base64");

    const decipher = crypto.createDecipheriv("aes-256-gcm", AES_KEY, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(enc.content, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return JSON.parse(decrypted);
}


const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));

app.use(
    cors({
        origin: "*",
        credentials: false,
    })
);

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@....mongodb.net/?...`;
// Signin/Login to Mongodb (https://www.mongodb.com/products/platform/atlas-database)
// Left side dashboard > Cluster > Connect > Drivers
// Copy the const uri and replace the const uri in the index.js in the same pattern

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

let db, connectionsCol, credentialsCol, proofReqCol, presentationsCol;

function randId() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function generateInviteCode(length = 5) {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
}


async function initDb() {
    // await client.connect();
    db = client.db(process.env.DB_NAME || "ssi_feature_phone_sim");

    connectionsCol = db.collection("connections");
    credentialsCol = db.collection("credentials");
    proofReqCol = db.collection("proof_requests");
    presentationsCol = db.collection("proof_presentations");

    // await db.command({ ping: 1 });
    console.log("MongoDB connected");
}

app.get("/", (req, res) => {
    res.send("SSI Feature Phone Simulation API running");
});

app.get("/api/health", (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
});

app.post("/api/issuer/create-invitation", async (req, res) => {
    try {
        const label = (req.body?.label || "holder").toString();
        const alias = (req.body?.alias || "holder").toString();

        const invitationId = randId();
        const inviteCode = generateInviteCode(5);

        const doc = {
            invitationId,
            inviteCode,
            label,
            alias,
            status: "invitation-created",
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await connectionsCol.insertOne(doc);

        res.json({ inviteCode });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


app.post("/api/holder/receive-invitation", async (req, res) => {
    try {
        const inviteCode = (req.body?.inviteCode || "").toString().trim();
        if (!inviteCode) {
            return res.status(400).json({ error: "inviteCode is required" });
        }

        const existing = await connectionsCol.findOne({ inviteCode });
        if (!existing) {
            return res.status(404).json({ error: "Invalid invite code" });
        }

        const connectionId = existing.connectionId || randId();

        await connectionsCol.updateOne(
            { inviteCode },
            {
                $set: {
                    connectionId,
                    status: "connected",
                    updatedAt: new Date(),
                },
            }
        );

        res.json({ ok: true, connectionId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


app.post("/api/issuer/issue-credential", async (req, res) => {
    try {
        const connectionId = (req.body?.connectionId || "").toString().trim();
        const claims = req.body?.claims || {};

        if (!connectionId) {
            return res.status(400).json({ error: "connectionId is required" });
        }

        const credentialType =
            (claims.department || "").toString().trim() || "UnknownCredential";

        const encryptedClaims = encryptData(claims);

        const cred = {
            connectionId,
            type: credentialType,
            status: "offered",
            claims: encryptedClaims,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const r = await credentialsCol.insertOne(cred);
        res.json({ ok: true, credentialId: r.insertedId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/holder/accept-credential", async (req, res) => {
    try {
        const credentialId = (req.body?.credentialId || "").toString().trim();
        if (!credentialId) return res.status(400).json({ error: "credentialId is required" });
        if (!ObjectId.isValid(credentialId)) return res.status(400).json({ error: "Invalid credentialId" });

        await credentialsCol.updateOne(
            { _id: new ObjectId(credentialId) },
            { $set: { status: "accepted", updatedAt: new Date() } }
        );

        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/holder/reject-credential", async (req, res) => {
    try {
        const credentialId = (req.body?.credentialId || "").toString().trim();
        if (!credentialId) return res.status(400).json({ error: "credentialId is required" });
        if (!ObjectId.isValid(credentialId)) return res.status(400).json({ error: "Invalid credentialId" });

        await credentialsCol.updateOne(
            { _id: new ObjectId(credentialId) },
            { $set: { status: "rejected", updatedAt: new Date() } }
        );

        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/holder/decline-proof-request", async (req, res) => {
    try {
        const proofRequestId = (req.body?.proofRequestId || "").toString().trim();
        if (!proofRequestId) return res.status(400).json({ error: "proofRequestId is required" });
        if (!ObjectId.isValid(proofRequestId)) return res.status(400).json({ error: "Invalid proofRequestId" });

        await proofReqCol.updateOne(
            { _id: new ObjectId(proofRequestId) },
            { $set: { status: "declined", updatedAt: new Date() } }
        );

        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/verifier/send-proof-request", async (req, res) => {
    try {
        const connectionId = (req.body?.connectionId || "").toString().trim();
        const request = req.body?.request || { ask: ["name", "department"], predicates: [{ field: "age", op: ">=", value: 20 }] };

        if (!connectionId) return res.status(400).json({ error: "connectionId is required" });

        const doc = {
            connectionId,
            request,
            status: "requested",
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const r = await proofReqCol.insertOne(doc);
        res.json({ ok: true, proofRequestId: r.insertedId });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/holder/present-proof", async (req, res) => {
    try {
        const proofRequestId = (req.body?.proofRequestId || "").toString().trim();
        const credentialId = (req.body?.credentialId || "").toString().trim();

        if (!proofRequestId) return res.status(400).json({ error: "proofRequestId is required" });
        if (!credentialId) return res.status(400).json({ error: "credentialId is required" });
        if (!ObjectId.isValid(proofRequestId)) return res.status(400).json({ error: "Invalid proofRequestId" });
        if (!ObjectId.isValid(credentialId)) return res.status(400).json({ error: "Invalid credentialId" });

        const cred = await credentialsCol.findOne({ _id: new ObjectId(credentialId) });
        if (!cred) return res.status(404).json({ error: "Credential not found" });

        const decryptedClaims = decryptData(cred.claims);

        const pres = {
            proofRequestId,
            credentialId,
            revealed: decryptedClaims,
            status: "presented",
            createdAt: new Date(),
        };

        await presentationsCol.insertOne(pres);
        await proofReqCol.updateOne(
            { _id: new ObjectId(proofRequestId) },
            { $set: { status: "presented", updatedAt: new Date() } }
        );

        res.json({ ok: true, verified: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/connections", async (req, res) => {
    const items = await connectionsCol.find({}).sort({ createdAt: -1 }).limit(50).toArray();
    res.json({ items });
});

app.get("/api/credentials", async (req, res) => {
    const items = await credentialsCol.find({}).sort({ createdAt: -1 }).limit(50).toArray();
    res.json({ items });
});

app.get("/api/proof-requests", async (req, res) => {
    try {
        const items = await proofReqCol.find({}).sort({ createdAt: -1 }).limit(50).toArray();
        res.json({ items });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get("/api/presentations", async (req, res) => {
    try {
        const items = await presentationsCol.find({}).sort({ createdAt: -1 }).limit(50).toArray();
        res.json({ items });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

initDb()
    .then(() => {
        app.listen(port, () => console.log(`API listening on port ${port}`));
    })
    .catch((e) => {
        console.error("DB init failed:", e);
        process.exit(1);
    });