const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eeyf9xb.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const run = async () => {
  try {
    await client.connect();
    console.log('db connected');
    const appointmentCollection = client
      .db('doctors_website')
      .collection('appointmentOptions');

    app.get('/appoinmentOptions', async (req, res) => {
      const query = {};
      const cursor = appointmentCollection.find(query);
      const appoinmentOptions = await cursor.toArray();
      res.send(appoinmentOptions);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
};
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
