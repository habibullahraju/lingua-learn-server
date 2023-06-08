const express = require("express");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;
const cors = require("cors");

app.use(cors());
app.use(express.json());

const {MongoClient, ServerApiVersion} = require("mongodb");
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
    await client.connect();
    const classesCollection = client.db("linguaLearnDB").collection("classes");
    const usersCollection = client.db("linguaLearnDB").collection("users");
    //user related apis 
    app.post('/users', async(req,res)=>{
        const user = req.body;
        const query ={email: user.email}
        const existsUser = await usersCollection.findOne(query)
        if (existsUser) {
            return res.send({message: "user already exists!"});
        }
        const result = await usersCollection.insertOne(user)
        res.send(result);

    })
    app.get('/instructor',async(req, res)=>{
      const query = {role: 'instructor'};
      const result = await usersCollection.find(query).limit(6).toArray();
      res.send(result);
    })
    app.get('/all-instructors', async(req, res)=>{
      const query = {role: 'instructor'}
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    })
    //classes related apis
    app.get("/popular-classes", async (req, res) => {
      const result = await classesCollection.find().sort({enrolled: -1}).toArray();
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
