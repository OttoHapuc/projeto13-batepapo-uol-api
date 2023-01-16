import cors from 'cors';
import express from 'express';
import Joi from "joi";
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
dotenv.config()
const app = express();
app.use(express.json());
app.use(cors());
const PORT = 5000;

const mongoClient = new MongoClient(process.env.DATABASE_URL);
let db;
await mongoClient.connect();
db = mongoClient.db();

setTimeout(removeOldUser, 15000);

async function removeOldUser() {
    const users = await db.collection("participants").find().toArray();

    users.forEach(user => {
        if ((Date.now() - user.lastStatus) > 10000) {
            db.collection("participants").deleteOne({ name: user.name });
            db.collection("messages").insertOne({
                from: user.name,
                to: "todos",
                text: "sai da sala...",
                type: "status",
                time: dayjs().format("HH:mm:ss")
            })
        }
    })
}

app.get('/participants', (req, res) => {
    db.collection("participants")
        .find()
        .toArray()
        .then(dados => res.send(dados))
        .catch(err => res.status(500).send(err));
});

app.get("/messages", async (req, res) => {    
    if (req.query.limit) {
        if(Number(req.query.limit) === 0 || req.query.limit < 0 || isNaN(req.query.limit)) return res.status(422).send("Value of limit is invalid")
        const {user} = req.headers;
        const messages = await db.collection("messages").find({ $or: [{ to: user, type: "private_message" }, { type: "message" }, { type: "status" }] }).toArray();
        const limitMessages = messages.reverse().slice(0, req.query.limit);
        return res.status(201).send(limitMessages);
    }
    const messages = await db.collection("messages").find().toArray();
    res.send(messages);
});

app.post("/participants", async (req, res) => {
    const { name } = req.body;

    const userExist = await db.collection("participants").find({ name }).toArray();

    if (userExist.length !== 0) return res.status(409).send("user already exists");

    const schema = Joi.object({
        name: Joi.string().min(3).required()
    });

    const validation = await schema.validate({ name }, { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    try {
        const userExist = await db.collection("participants").findOne({ name });
        if (userExist) return res.status(409).send("user conflict");
        db.collection("participants").insertOne({ name, lastStatus: Date.now() });
        await db.collection("messages").insertOne({ from: name, to: "Todos", text: "entra na sala...", type: "status", time: dayjs().format("HH:mm:ss") });
        res.status(201).send("OK");
    } catch (err) { res.status(500) };
});

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers;

    const userExist = await db.collection("participants").find({ name: user }).toArray();
    if (userExist.length === 0) return res.status(422).send("user not found");
    if (to === "" || to !== "Todos" && to !== user) return res.status(422).send("to: is empty");
    if (type !== "private_message" && type !== "message") return res.status(422).send("duty type private_message or message");

    const schema = Joi.object({
        text: Joi.string().min(1).required()
    });
    const validation = await schema.validate({ text }, { abortEarly: false });
    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    try {
        await db.collection("messages").insertOne({ from: user, to, text, type, time: dayjs().format("HH:mm:ss") })
        res.status(201).send("OK")
    } catch (err) { res.status(500) };
});

app.post("/status", async (req, res) => {
    const { user } = req.headers;
    const userExist = await db.collection("participants").find({ name: user }).toArray();
    if (userExist.length == 0) return res.status(404).send("user already exists or not registered");

    try {
        await db.collection("participants").updateOne({ name: user }, { $set: { lastStatus: Date.now() } });
        res.send("OK");
    } catch (err) { res.status(500) };
})

app.listen(PORT);