const express = require('express');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

const corsOptions = {
    origin: [
        "http://localhost:5173",
        "https://assignment-eleven-d78bd.web.app",
        "https://assignment-eleven-d78bd.firebaseapp.com"
    ],
    credentials: true,
    optionSuccessStatus: 200,

}

//middleware
app.use(cors(corsOptions))
app.use(express.json());
app.use(cookieParser());

// another middleware
// const logger = (req, res, next) => {
//     console.log('log info', req.method, req.url);
//     next();
// }

//jwt verify token middleware
const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;
    console.log(token);
    // console.log('1', token);
    if (!token) return res.status(401).send({ message: 'unauthorized access' })
    if (token) {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                console.log(err);
                return res.status(401).send({ message: 'unauthorized access' })
            }
            // console.log(decoded);
            req.user = decoded;
            next();
        })
    }

}


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


        //jwt generate using (logger)
        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: "1h"
            })
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
            }).send({ success: true })
        })


        //clear cookie on logout user
        app.get('/logout', (req, res) => {
            // const user = req.body;
            // console.log("logging out", user);
            res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
                maxAge: 0,
            }).send({ success: true })
        })



        // app.post('/logout', async (req, res) => {
        //     const user = req.body;
        //     console.log('logging out', user);
        //     res
        //         .clearCookie('token', { maxAge: 0, sameSite: 'none', secure: true })
        //         .send({ success: true })
        // })




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
            const search = req.query.search;
            const sort = req.query.sort;
            // console.log(sort);
            let query = {
                food_name: { $regex: search, $options: 'i' }
            }
            const filter = { food_status: 'available' };
            if (filter) {
                query = { ...query, ...filter };
            }

            // for sorting 
            let sortOptions = {};
            if (sort === 'asc') {
                sortOptions = { expired_date: 1 }; // Ascending order by expired_date
            } else if (sort === 'des') {
                sortOptions = { expired_date: -1 }; // Descending order by expired_date
            }

            const result = await foodsCollection.find(query).sort(sortOptions).toArray();
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

        //update food
        app.put('/update-food/:id', async (req, res) => {
            const id = req.params.id;
            const foodInfo = req.body;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateFood = {
                $set: {
                    ...foodInfo,
                }
            }
            const result = await foodsCollection.updateOne(filter, updateFood, options);
            res.send(result);

        })

        //food request
        app.get("/food-request/:email", verifyToken, async (req, res) => {
            const tokenEmail = req.user.email;
            const email = req.params.email;
            if (tokenEmail !== email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const filter = {
                user_email: email,
                food_status: "Requested"
            };
            const result = await foodsCollection.find(filter).toArray();
            res.send(result);
        })

        //manage my food
        app.get("/manage-food/:email", verifyToken, async (req, res) => {
            const tokenEmail = req?.user?.email;
            const email = req.params.email;
            if (tokenEmail !== email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const filter = {
                donator_email: email,
                food_status: "available"
            };
            const result = await foodsCollection.find(filter).toArray();
            res.send(result);
        })

        //food delete
        app.delete('/remove-food/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await foodsCollection.deleteOne(query);
            res.send(result);
        })



        //add food
        app.post('/add-food', async (req, res) => {
            const foodInfo = req.body;
            const result = await foodsCollection.insertOne(foodInfo);
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
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
    console.log(`Running port is ${port} `);
})