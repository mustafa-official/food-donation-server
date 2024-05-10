const express = require('express');
require('dotenv').config();
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

const corsOptions = {
    origin: [
        'http://localhost:5173'
    ],
    credentials: true,
    optionSuccessStatus: 200,

}

//middleware
app.use(cors(corsOptions))
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.elzgrcu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const foodsCollection = client.db('foodDB').collection('foods');
        //get foods in for featured section
        app.get('/featured-foods', async (req, res) => {
            const highestQuantityFoods = await foodsCollection.aggregate([
                { $sort: { food_quantity: -1 } }, // Sort by quantity in descending order
                { $limit: 6 } // Limit to 6 documents
            ]).toArray();

            res.send(highestQuantityFoods);
        })

        //get specific foods
        app.get("/details/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await foodsCollection.findOne(query);
            res.send(result)
        })

        //get available food status
        app.get('/available', async (req, res) => {
            const query = { food_status: 'available' };
            const result = await foodsCollection.find(query).toArray();
            res.send(result);
        })

        //update and request food
        app.put('/update-status/:id', async (req, res) => {
            const id = req.params.id;
            const newStatus = req.body;
            // console.log(newStatus);
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateStatus = {
                $set: {
                    additional_notes: newStatus.additional_notes,
                    food_status: newStatus.food_status,
                    request_date: newStatus.request_date,
                    user_email: newStatus.user_email,
                }
            }
            const result = await foodsCollection.updateOne(filter, updateStatus, options);
            res.send(result);
        })

        //food request
        app.get("/food-request/:email", async (req, res) => {
            const email = req.params.email;
            const filter = {
                user_email: email,
                food_status: "Requested"
            };
            const result = await foodsCollection.find(filter).toArray();
            res.send(result);
        })

        //manage my food
        app.get("/manage-food/:email", async (req, res) => {
            const email = req.params.email;
            const filter = {
                donator_email: email,
                food_status: "available"
            };
            const result = await foodsCollection.find(filter).toArray();
            res.send(result);
        })

        //add food
        app.post('/add-food', async (req, res) => {
            const foodInfo = req.body;
            const result = await foodsCollection.insertOne(foodInfo);
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Assignment eleven running')
})

app.listen(port, () => {
    console.log(`Running port is ${port}`);
})