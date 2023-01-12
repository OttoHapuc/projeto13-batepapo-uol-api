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
mongoClient.connect()
    .then(() => {
        db = mongoClient.db("trabalhoUOL");
    })
    .catch(() => {
        console.log("error connecting to MongoDB server")
    });

app.get('/participants', (req, res) => {
    db.collection("users")
        .find()
        .toArray()
        .then(dados => res.send(dados)
            .catch(err => res.status(500).send(err)));
})

app.post("/participants", (req, res) => {
    const { name } = req.body;
    console.log(name);

    try {
        const userExist = db.collection("users").findOne({name})
        if(userExist) return res.status(409).send("user conflict")
        db.collection("users").insertOne({ name, lastStatus: Date.now() })
        res.status(201).send("OK")
    } catch (err){ res.status(500)};
});

app.post("/messages", (req,res) => {
    const {to, text, type} = req.body;
    const {from} = req.headers;

    try {
        db.collection("messages").insertOne({ from,to,text,type, time: dayjs().format("HH:mm:ss") })
        res.status(201).send("OK")
    } catch (err){ res.status(500)};
})

app.listen(PORT);