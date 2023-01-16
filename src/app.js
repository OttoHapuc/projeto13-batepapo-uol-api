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
db = mongoClient.db("trabalhoUOL");

setTimeout(removeOldUser, 15000);

async function removeOldUser(){
    const users = await db.collection("users").find().toArray();

    users.forEach(user => {
        if((Date.now() - user.lastStatus) > 10000){
            db.collection("users").deleteOne({name: user.name});
            db.collection("messages").insertOne({
                from: user.name,
                to:"todos",
                text: "sai da sala...",
                type: "status",
                time: dayjs().format("HH:mm:ss")
            })
        }
    })
}

app.get('/participants', (req, res) => {
    db.collection("users")
        .find()
        .toArray()
        .then(dados => res.send(dados)
            .catch(err => res.status(500).send(err)));
});

app.get("/messages", async(req, res) => {
    const messages = await db.collection("messages").find().toArray();
    res.send(messages);
});

app.get("/messages/?:limit", async(req, res) => {
    const {user} = req.headers;
    const messages = await db.collection("messages").find({$or:[{to: user, type:"private_message"},{type:"message"}]}).toArray();
    const limitMessages = messages.slice(0, req.query.limit);
    res.send(limitMessages);
});

app.post("/participants", async (req, res) => {
    const { name } = req.body;
    console.log(name);

    const userExist = await db.collection("users").find({ name }).toArray();

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
        const userExist = await db.collection("users").findOne({ name });
        if (userExist) return res.status(409).send("user conflict");
        db.collection("users").insertOne({ name, lastStatus: Date.now() });
        res.status(201).send("OK");
    } catch (err) { res.status(500) };
});

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const { user } = req.headers;

    const userExist = await db.collection("users").find({ name: user }).toArray();
    if(userExist.length === 0) return res.status(422).send("user not found");
    if(to === "") return res.status(422).send("to: is empty");
    if(type !== "private_message" && type !== "message") return res.status(422).send("duty type private_message or message");

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

app.post("/status", async(req, res) => {
    const {user} = req.headers;
    const userExist = await db.collection("users").find({ name: user }).toArray();
    if (userExist.length !== 0) return res.status(404).send("user already exists");

    try{
        await db.collection("users").updateOne({ name: user},{$set: {lastStatus: Date.now()} });
        res.send("OK");
    } catch (err) { res.status(500) };
})

app.listen(PORT);