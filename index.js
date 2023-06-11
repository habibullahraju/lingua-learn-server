const express = require("express");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KAY);

const port = process.env.PORT || 5000;
const cors = require("cors");

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({error: true, message: "unauthorized access"});
  }

  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({error: true, message: "unauthorized access"});
    }
    req.decoded = decoded;
    next();
  });
};

const {MongoClient, ServerApiVersion, ObjectId} = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3f1y3cg.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
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
    // await client.connect();
    const classesCollection = client.db("linguaLearnDB").collection("classes");
    const usersCollection = client.db("linguaLearnDB").collection("users");
    const cartsCollection = client.db("linguaLearnDB").collection("carts");
    const paymentCollection = client.db("linguaLearnDB").collection("payment");
    const enrolledCollection = client
      .db("linguaLearnDB")
      .collection("enrolled");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({token});
    });
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res.status(403).send({error: true, message: "forbidden access"});
      }
      next();
    };
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const user = await usersCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res.status(403).send({error: true, message: "forbidden access"});
      }
      next();
    };

    //user related apis
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = {email: user.email};
      const existsUser = await usersCollection.findOne(query);
      if (existsUser) {
        return res.send({message: "user already exists!"});
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    app.get("/all-users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({admin: false});
      }
      const query = {email: email};
      const user = await usersCollection.findOne(query);
      const result = {admin: user?.role === "admin"};
      res.send(result);
    });
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decoded.email !== email) {
        res.send({instructor: false});
      }
      const query = {email: email};
      const user = await usersCollection.findOne(query);
      const result = {instructor: user?.role === "instructor"};
      res.send(result);
    });

    app.get("/instructor", async (req, res) => {
      const query = {role: "instructor"};
      const result = await usersCollection.find(query).limit(6).toArray();
      res.send(result);
    });
    app.get("/all-instructors", async (req, res) => {
      const query = {role: "instructor"};
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    });
    //classes related apis
    app.get("/popular-classes", async (req, res) => {
      const query = {status: "approved"};
      const result = await classesCollection
        .find(query)
        .sort({enrolled: -1})
        .toArray();
      res.send(result);
    });
    //add approved classes apis
    app.get("/all-classes", async (req, res) => {
      const query = {status: "approved"};
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });
    //instructor apis
    app.post("/add-class", verifyJWT, verifyInstructor, async (req, res) => {
      const newClass = req.body;
      const result = await classesCollection.insertOne(newClass);
      res.send(result);
    });
    app.get(
      "/my-classes/:email",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        const query = {email: email};
        const result = await classesCollection.find(query).toArray();
        res.send(result);
      }
    );
    app.get(
      "/see-feedback/:id",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await classesCollection.findOne(query);

        res.send(result);
      }
    );
    //admin apis
    app.get("/manage-classes", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });
    app.put("/approved-deny/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = req.body;
      const filter = {_id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          status: query.status,
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.put("/feedback/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = req.body;
      const filter = {_id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          feedback: query.feedback,
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    app.put("/change-role/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = req.body;
      const filter = {_id: new ObjectId(id)};
      const updateDoc = {
        $set: {
          role: query.role,
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // user card related apis
    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartsCollection.insertOne(item);
      res.send(result);
    });
    app.get("/carts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(401).send({error: true, message: "forbidden access"});
      }
      const query = {email: email};
      const result = await cartsCollection.find(query).toArray();
      res.send(result);
    });
    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await cartsCollection.deleteOne(query);
      res.send(result);
    });
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const {price} = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({clientSecret: paymentIntent.client_secret});
    });
    // payments api and delete post and update
    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      // const query = {_id: {$in: payment.classId.map(id => new ObjectId(id))}}
      const enrollClass = {
        email: payment.email,
        enrolledClassesId: payment.classId,
      };
      const queryDelete = {
        _id: {$in: payment.itemsId.map((id) => new ObjectId(id))},
      };

      // const updateDoc = {
      //   $set: {
      //     availableSeat: payment.availableSeat.map(st => st),
      //   },
      // };
      const enrolledResult = await enrolledCollection.insertOne(enrollClass);
      // const updateResult = await classesCollection.updateMany(query,updateDoc)
      const result = await paymentCollection.insertOne(payment);
      const deleteResult = await cartsCollection.deleteMany(queryDelete);
      res.send({result, enrolledResult, deleteResult});
    });
    app.get("/enrolled-classes/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = {email: email};
      const result = await enrolledCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/payment-history/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = {email: email};
      const result = await paymentCollection
        .find(query)
        .sort({price: -1})
        .toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ping: 1});
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Lingua learn server is running");
});
app.listen(port, () => {
  console.log(`Lingua learn server is running on port: ${port}`);
});
