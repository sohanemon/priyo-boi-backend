require("dotenv").config();
const express = require("express");
const { MongoClient, Timestamp, ObjectId } = require("mongodb");
const cors = require("cors");
const stripe = require("stripe")(process.env.stripe_sk);
const jwt = require("jsonwebtoken");
const app = express();
const port = process.env.PORT || 5000;
// middleware
app.use(cors());
app.use(express.static("public"));
app.use(express.json());
/* ------------------------ database collection ------------------------ */
const client = new MongoClient(process.env.URI);
const db = client.db("priyo-boi");
const userCollection = db.collection("users");
const categoryCollection = db.collection("bookCategories");
const bookCollection = db.collection("books");
const orderCollection = db.collection("orders");

/* ------------------------- JSON web token JWT ------------------------ */

const verifyJWT = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send("Unauthorized");
  const token = auth.split(" ")[1];
  jwt.verify(token, process.env.secret_key, (err, payload) => {
    if (err) return res.status(401).send("Unauthorized");
    else {
      req.email = payload.email.email;
      next();
    }
  });
};

/* --------------------------------------------------------------------- */
try {
  app.post("/jwt", (req, res) => {
    const token = jwt.sign({ email: req.body }, process.env.secret_key);
    res.send({ token });
  });
  app.post("/user", async (req, res) => {
    const result = await userCollection.insertOne(req.body);
    res.send(result);
  });
  app.get("/user/:uid", async (req, res) => {
    const user = await userCollection.findOne({ uid: req.params.uid });
    res.send(user);
  });
  app.put("/user/:uid", async (req, res) => {
    userCollection
      .updateOne(
        { uid: req.params.uid },
        { $set: { verified: true } },
        { upsert: true }
      )
      .then((_) => res.send(_));
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
  app.get("/book/:id", async (req, res) => {
    bookCollection
      .findOne({ _id: ObjectId(req.params.id) })
      .then((_) => res.send(_));
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
  /* ------------------------------ ad items ----------------------------- */
  app.put("/ad/:id", async (req, res) => {
    const data = await bookCollection.updateOne(
      { _id: ObjectId(req.params.id) },
      { $set: { advertise: true } },
      { upsert: true }
    );
    res.send(data);
  });
  app.get("/ad", async (req, res) => {
    const data = await bookCollection
      .find({ advertise: true, available: true })
      .sort({ timestamp: -1 })
      .toArray();
    res.send(data);
  });
  /* ----------------------- get book by categories ---------------------- */
  app.get("/category/:id", async (req, res) => {
    const category = await categoryCollection.findOne({
      _id: ObjectId(req.params.id),
    });
    res.send(category.name);
  });
  app.get("/books/category/:id", async (req, res) => {
    const category = await categoryCollection.findOne({
      _id: ObjectId(req.params.id),
    });
    const data = await bookCollection
      .find({ category_id: req.params.id, available: true })
      .toArray();
    res.send({ category, data });
  });
  /* ----------------------------- get users ----------------------------- */
  app.post("/users", verifyJWT, async (req, res) => {
    console.log(req.email, req.body.email);
    if (req.email !== req.body.email) {
      return res.status(403).send("Forbidden");
    }
    const data = await userCollection
      .find({ typeOfUser: req.query.role })
      .toArray();
    res.send(data);
  });
  app.delete("/user/:uid", async (req, res) => {
    const result = await userCollection.deleteOne({ uid: req.params.uid });
    res.send(result);
  });
  /* --------------------- store and retrieve orders --------------------- */
  app.post("/order", async (req, res) => {
    orderCollection
      .insertOne({
        ...req.body,
        timestamp: new Timestamp(),
      })
      .then((result) => res.send(result));
  });
  app.get("/order", verifyJWT, async (req, res) => {
    if (req.email !== req.query.email) {
      return res.status(403).send("Forbidden");
    }
    const order = await orderCollection
      .find({ buyer: req.query.email })
      .toArray();
    const data = await Promise.all(
      order.map(async (_) => {
        _.bookData = await bookCollection.findOne({ _id: ObjectId(_.book_id) });
        return _;
      })
    );
    res.send(data);
  });
  /* ---------------------------- my wishlist ---------------------------- */
  app.put("/wishlist", verifyJWT, async (req, res) => {
    if (req.email !== req.query.email) {
      return res.status(403).send("Forbidden");
    }
    userCollection
      .updateOne(
        { email: req.query.email },
        { $push: { wishlist: req.body.book_id } },
        { upsert: true }
      )
      .then((_) => res.send(_));
  });
  /* --------------------------- stripe payment -------------------------- */
  app.post("/create-payment-intent", async (req, res) => {
    // Create a PaymentIntent with the order amount and currency
    const amount = req.body?.price && req.body?.price;
    if (amount) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount * 100,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent?.client_secret,
      });
    }
  });
  app.put("/payment-success/:book_id", async (req, res) => {
    bookCollection
      .updateOne(
        { _id: ObjectId(req.params.book_id) },
        { $set: { available: false } }
      )
      .then((_) => res.send(_));
  });
} catch (error) {
  console.log(error);
}

app.listen(port, () => console.log(`App listening on port ${port}!`));
