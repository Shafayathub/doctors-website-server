const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
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

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).send({ message: 'Unauthorized access' });
  }
  const token = authHeader?.split(' ')[1];
  // verify a token symmetric
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      res.status(403).send({ message: 'Forbidden' });
    }
    req.decoded = decoded;
    next();
  });
};

const run = async () => {
  try {
    await client.connect();
    console.log('db connected');
    const appointmentCollection = client
      .db('doctors_website')
      .collection('appointmentOptions');
    const bookingCollection = client
      .db('doctors_website')
      .collection('booking');
    const userCollection = client.db('doctors_website').collection('users');

    app.get('/appointmentOptions', async (req, res) => {
      const query = {};
      const cursor = appointmentCollection.find(query);
      const appoinmentOptions = await cursor.toArray();
      res.send(appoinmentOptions);
    });

    // Users
    app.get('/user', verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin });
    });
    app.put('/user/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAcc = await userCollection.findOne({ email: requester });
      if (requesterAcc.role === 'admin') {
        const filter = { email: email };

        const updatedDoc = {
          $set: { role: 'admin' },
        };
        const result = await userCollection.updateOne(filter, updatedDoc);

        res.send(result);
      } else {
        res.status(403).send({ message: 'Forbidden' });
      }
    });
    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updatedDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET
        // { expiresIn: '180d' }
      );
      res.send({ result, token });
    });

    // Booking
    app.get('/booking', verifyJWT, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.decoded.email;
      if (patient === decodedEmail) {
        const query = { email: patient };
        const result = await bookingCollection.find(query).toArray();
        res.send(result);
      } else {
        res.status(403).send({ message: 'Forbidden' });
      }
    });

    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        appointmentDate: booking.appointmentDate,
        patientName: booking.patientName,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
    });

    app.get('/available', async (req, res) => {
      const date = req.query.date;

      // Warning: not a proper way. Just practicing JS
      // step 1: get all appointentOptions
      const appoinmentOptions = await appointmentCollection.find({}).toArray();

      // step 2:get all bookings
      const query = { appointmentDate: date };
      const bookings = await bookingCollection.find(query).toArray();

      // Step 3: For each appointmentOption
      appoinmentOptions.forEach((appointment) => {
        // step 4: Find the bookings for that service
        const appoinmentBookings = bookings.filter(
          (booking) => booking.treatment === appointment.name
        );
        // Step 5: Select the appointment booking slots
        const bookedAppointments = appoinmentBookings.map(
          (booked) => booked.slot
        );
        // Step 6: Eleminate the bookedAppointments from appointmentOptions slots
        const available = appointment.slots.filter(
          (slot) => !bookedAppointments.includes(slot)
        );
        // array of booked slot on a particular date
        appointment.booked = bookedAppointments;
        // Return an array with available slots that particular date
        appointment.availableSlots = available;
      });

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
