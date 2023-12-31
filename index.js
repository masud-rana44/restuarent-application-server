const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
// const formData = require("form-data");
// const Mailgun = require("mailgun.js");
// const mailgun = new Mailgun(formData);
// const mg = mailgun.client({
//   username: "api",
//   key: process.env.MAILGUN_API_KEY,
// });

const sgMail = require("@sendgrid/mail");
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

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

    // AUTHENTICATION

    // generate a new token
    app.post("/jwt", async (req, res) => {
      const body = req.body;
      const token = jwt.sign(body, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // verify the token
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "Unauthorized Access" });
      }

      const token = req.headers["authorization"].split(" ")[1] || null;
      if (!token) {
        return res.status(401).send({ message: "Unauthorized Access" });
      }

      // If there is a token, verify it
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized Access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // verify the admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email };
      const result = await usersCollection.findOne(query);
      const isAdmin = result && result.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      next();
    };

    // payment
    app.post("/create-payment-intend", async (req, res) => {
      const { total } = req.body;

      // create a payment intent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: parseInt(total * 100),
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Users Collection
    const usersCollection = db.collection("users");

    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find({}).toArray();
      res.send(result);
    });

    // check admin
    app.get("/users/admin", verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email };
      const result = await usersCollection.findOne(query);
      let isAdmin = false;
      if (result && result.role === "admin") {
        isAdmin = true;
      }
      res.send({ isAdmin });
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

    app.patch("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const query = { _id: new ObjectId(id) };
      const update = { $set: body };
      const options = { upsert: false };
      const result = await usersCollection.updateOne(query, update, options);
      res.send(result);
    });

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // Menus Collection
    const menusCollection = db.collection("menus");

    // get all menus
    app.get("/menus", async (req, res) => {
      const result = await menusCollection.find({}).toArray();
      res.send(result);
    });

    // get a single menu
    app.get("/menus/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menusCollection.findOne(query);
      res.send(result);
    });

    // add a menu
    app.post("/menus", verifyToken, verifyAdmin, async (req, res) => {
      const item = req.body;
      const { name, price, image, category, recipe } = item;

      // check all fields are filled
      if (!name || !price || !image || !category || !recipe) {
        return res.status(400).send({ message: "Please fill all the fields" });
      }

      // check if the item already exists
      const isAlreadyExist = await menusCollection.findOne({ name });
      if (isAlreadyExist) {
        return res.status(400).send({ message: "Item already exists" });
      }

      const result = await menusCollection.insertOne({
        name,
        price,
        image,
        category,
        recipe,
      });
      res.send(result);
    });

    // update a menu
    app.patch("/menus/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const updatedItem = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: updatedItem };
      const options = { upsert: false };
      const result = await menusCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    // delete a menu
    app.delete("/menus/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await menusCollection.deleteOne(query);
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

    // Order Collection
    const orderCollection = db.collection("order");

    app.get("/orders", verifyToken, verifyAdmin, async (req, res) => {
      const result = await orderCollection.find({}).toArray();
      res.send(result);
    });

    app.get("/orders/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = { email };
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/orders", verifyToken, async (req, res) => {
      const order = req.body;
      const resultOrder = await orderCollection.insertOne(order);

      // delete the cart items
      // const query = {
      //   email: order.email,
      // };

      const query = {
        _id: {
          $in: order.cartIds.map((id) => new ObjectId(id)),
        },
      };

      const resultDelete = await cartCollection.deleteMany(query);

      // Send the confirmation email to the customer
      // const messageData = {
      //   from: "Bistro Boss <me@sandboxb4885b95f4d74159a01abd30d2001a26.mailgun.org>",
      //   to: "mdmasudrana4488@gmail.com",
      //   subject: "Thank You For Your Order",
      //   html: `<div>Congratulations! Your order is successful. Transaction id: <strong>${order.paymentId}</strong> <p>Feel free to put a reviews, Thank you.</p></div>`,
      // };

      // mg.messages
      //   .create(process.env.MAILGUN_DOMAIN, messageData)
      //   .then((res) => {
      //     console.log(res);
      //   })
      //   .catch((err) => {
      //     console.error(err);
      //   });

      const msg = {
        to: "mdmasudrana4488@gmail.com",
        from: "mdmasudrana4488@gmail.com",
        subject: "Sending with SendGrid is Fun",
        text: "and easy to do anywhere, even with Node.js",
        html: "<strong>and easy to do anywhere, even with Node.js</strong>",
      };

      sgMail
        .send(msg)
        .then(() => {
          console.log("Email sent");
        })
        .catch((error) => {
          console.error(error);
        });

      res.send({ resultOrder, resultDelete });
    });

    // -------------------------
    // Stats
    // -------------------------
    app.get("/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      const usersQuery = { role: "user" };
      const users = await usersCollection.estimatedDocumentCount(usersQuery);
      const orders = await orderCollection.estimatedDocumentCount();
      const menus = await menusCollection.estimatedDocumentCount();
      const revenues = await orderCollection
        .aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: "$total" },
            },
          },
        ])
        .toArray();

      res.send({ users, orders, menus, revenues: revenues[0].total });
    });

    app.get("/orders-stats", async (req, res) => {
      const result = await orderCollection
        .aggregate([
          {
            $unwind: "$menuIds",
          },
          {
            $lookup: {
              from: "menus",
              localField: "menuIds",
              foreignField: "_id",
              as: "menu",
            },
          },
          // {
          //   $group: {
          //     _id: null,
          //     total: { $sum: "$total" },
          //   },
          // },
        ])
        .toArray();

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
