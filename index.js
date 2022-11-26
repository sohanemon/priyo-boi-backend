require("dotenv").config();
const express = require("express");
const { MongoClient, Timestamp, ObjectId } = require("mongodb");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
// middleware
app.use(cors());
app.use(express.json());
/* ------------------------ database collection ------------------------ */
const client = new MongoClient(process.env.URI);
const db = client.db("priyo-boi");
const userCollection = db.collection("users");
const categoryCollection = db.collection("bookCategories");
const bookCollection = db.collection("books");
/* --------------------------------------------------------------------- */
try {
  app.get("/", (req, res) => {
    res.send("Data");
  });
  app.post("/user", async (req, res) => {
    const result = await userCollection.insertOne(req.body);
    res.send(result);
  });
  app.get("/user/:uid", async (req, res) => {
    const user = await userCollection.findOne({ uid: req.params.uid });
    res.send(user);
  });
  /* -------------------------- book categories -------------------------- */
  app.get("/categories", async (req, res) => {
    const data = await categoryCollection.find({}).toArray();
    res.send(data);
  });
  /* -------------------------- books operation -------------------------- */
  app.post("/books", async (req, res) => {
    const result = await bookCollection.insertOne({
      timestamp: new Timestamp(),
      ...req.body,
    });
    res.send(result);
  });
  app.get("/books", async (req, res) => {
    const data = await bookCollection
      .find({ addedBy: req.query.email })
      .toArray();
    res.send(data);
  });
  app.delete("/book/:id", async (req, res) => {
    const result = await bookCollection.deleteOne({
      _id: ObjectId(req.params.id),
    });
    res.send(result);
  });
  app.get("/ad/:id", async (req, res) => {
    console.log(req.params.id);
    const data = await bookCollection.updateOne(
      { _id: ObjectId(req.params.id) },
      { $set: { advertise: true } },
      { upsert: true }
    );
    res.send(data);
  });
  /* ----------------------- get book by categories ---------------------- */
  app.get("/books/category/:id", async (req, res) => {
    const category = await categoryCollection.findOne({
      _id: ObjectId(req.params.id),
    });
    const data = await bookCollection
      .find({ category_id: req.params.id })
      .toArray();
    res.send({ category, data });
  });
} catch (error) {
  console.log(error);
}

app.listen(port, () => console.log(`App listening on port ${port}!`));
