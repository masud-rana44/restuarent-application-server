const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();

// middlewares
app.use(cors());
app.use(express.json());

const uri = process.env.MONGO_URL;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("bistroDB");

    // Users Collection
    const usersCollection = db.collection("users");

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find({}).toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const body = req.body;

      const isAlreadyExist = await usersCollection.findOne({
        email: body.email,
      });
      if (isAlreadyExist) {
        return res.send({ message: "User already exists" });
      }

      const result = await usersCollection.insertOne(body);
      res.send(result);
    });

    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // Menus Collection
    const menusCollection = db.collection("menus");

    app.get("/menus", async (req, res) => {
      const result = await menusCollection.find({}).toArray();
      res.send(result);
    });

    // Reviews Collection
    const reviewsCollection = db.collection("reviews");

    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection.find({}).toArray();
      res.send(result);
    });

    // Cart Collection
    const cartCollection = db.collection("cart");

    app.get("/cart", async (req, res) => {
      const email = req.query.email;
      const query = { email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/cart", async (req, res) => {
      const body = req.body;

      const result = await cartCollection.insertOne(body);
      res.send(result);
    });

    app.delete("/cart/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
