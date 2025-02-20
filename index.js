const validationService = require("./services/validationService");
const express = require("express");
const mongoose = require("mongoose");
const colors = require('colors');
const cors = require("cors");
const nodemailer = require("nodemailer");
const dbConfig = require("./config/dbConfig");
const Users = require("./models/userModel");
const Emails = require("./models/emailModel");
const Order = require("./models/orderModel");
const serverConfig = require("./config/serverConfig");
const products = require("./fakeDb/products.json");
const clients = require("./fakeDb/clients.json");
const Product = require("./models/productModel");
var jwt = require('jsonwebtoken');
const userRoute = require('./routes/userRoute');
const paymentRoute = require('./routes/paymentRoute');
const subscribeRoute = require('./routes/subscribeRoute');
const { json } = require("express");
const fileUpload = require("express-fileupload");
const fs = require("fs");
const adminRoute = require('./routes/adminRoute')
const Comment = require("./models/commentModel");


const app = express();
mongoose
    .connect(dbConfig.MONGODB_URL)
    .then((data) => console.log("MONGO DB is connected."))
    .catch((err) => console.log(`${err}`));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(fileUpload());
// enable CORS - API calls and resource sharing
app.use(cors());
// nodmailer config
// const mailer = mainService.configureMail();

app.use("/api/subscribe", subscribeRoute);
app.use("/api/user", userRoute);

const handleParams = (params) => params?.currentPage ? (params.currentPage < 2 ? 0 : ((params.currentPage - 1) * params.itemsPerPage)) : 0;

//get products
app.get('/shop/products/:itemsPerPage/:currentPage', async (req, res) => {
    const reqParams = req.params;
    console.log('params...', reqParams);

    let allProducts;
    Product.countDocuments({}, function(err, docCount) {
        if (err) { return console.log(err) } //handle possible errors
        allProducts =  docCount;

        Product.find()
            .skip(handleParams(reqParams))
            .limit(isNaN(reqParams?.itemsPerPage) ? 2 : reqParams?.itemsPerPage)
            .exec((error, data) => {
                if (error) {
                    console.log(error);
                    res.send("ERROR. TRY AGAIN.");
                    return;
                }

                if (data) {
                    res.send({ads: data, totalItems: allProducts})
                } else {
                    res.send("Product don't found")
                }
            })
    });
})

// get filtered products
app.get("/api/filteredAds/:price", (req, res) => {
    const price = req.params.price;
    Product.find({ price: { $lt: price } }, (error, data) => {
        if (error) {
            console.log(error);
            res.send(error);
        }
        res.send(data);
    })
})

// get searched products
app.get("/api/product/search/:searchTerm", (req, res) => {
    const searchTerm = req.params.searchTerm;
    Product.find({ title: { $regex: searchTerm, "$options": "i" } }, (error, data) => {
        if (error) {
            console.log(error);
            res.send(error);
        }
        res.send(data);
    })
})

// random  Masonry products
app.get('/api/home/:numberOfAds', (req, res) => {
    let number = req.params.numberOfAds;
    Product.find((error, data) => {
        if (error) {
            console.log(error);
            res.send("ERROR. TRY AGAIN.");
            return;
        }
        if (data) {
            let copyData = [...data];
            let randAds = [];
            for (let i = 0; i < number; i++) {
                let rand = Math.floor(Math.random() * copyData.length);
                randAds.push(copyData[rand]);
                copyData.splice(rand, 1);
            }
            res.send(randAds);
        } else {
            res.send("Product dont found")
        }
    })
})

// getting clients from fakeDb/clients.json
app.get("/api/home", (req, res) => {
    res.send(clients);
});

// get random slider products
app.get('/api/home/slider/:numberAds', (req, res) => {
    const numberAds = parseInt(req.params.numberAds);

    Product.aggregate([{ $sample: { size: numberAds } }])
        .then(response => {
            console.log(res);
            res.send(response);
        })
        .catch(error => {
            console.log(error);
            res.send(error);
        })
})

// GET COMMENTS
app.get("/shop/product/comments/:commentId", (req, res) => {
    const commentId = req.params.commentId;
    Comment.find({comment_product_id: commentId, comment_status: true}, (error, data) => {
        if (error) {
            console.log(error);
            res.send("ERROR. Try Again.")
        }
        if (data) {
            console.log(data)
            res.send(data);
        } else {
            res.send("Comments dont found");
        }
    })
})

//ADD COMMENT
app.post("/shop/product/comments", async (req, res) => {
    const reqBody = req.body;
    const newComment = new Comment(reqBody);
    const saveNewComment = await newComment.save();
    res.send(saveNewComment || 'Comment not saved');
})

//get product
app.get("/shop/product/:productId", (req, res) => {
    const productId = req.params.productId;
    Product.findOne({ _id: productId }, (error, data) => {
        if (error) {
            console.log(error);
            res.send("ERROR. Try Again.")
        }

        if (data) {
            res.send(data);
        } else {
            res.send("Product dont found");
        }
    })
})


//add myProduct

app.post("/product/add", (req, res) => {
    const product = JSON.parse(req.body.product);
    console.log(product);
    const file = req.files.file;
    const fileName = `${new Date().getTime()}_${file.name}`;
    const path = `${__dirname}/files/`;
    const filePath = `${path}${fileName}`;
    file.mv(filePath, err => {
        if (err) return res.status(420).send('error on upload file');
        Product.findOne(product, async (err, data) => {
            // console.log(data);
            if (err) {
                const errorMsg = `Error on register user: ${err}`;
                console.log(errorMsg);
                res.status(421).send(errorMsg);
                return;
            }

            if (data) res.send(`Product already exist`);
            else {
                const newProduct = new Product({...product, imgUrl: fileName});
                const saveNewProduct = await newProduct.save();
                res.send(saveNewProduct || 'Product not saved');
            }
        });
    })
});

app.get('/files/:imageName', (req,res) => {
    fs.readFile(__dirname + "/files/" + req.params.imageName, (err, data) => {
        if (err) return res.send('no file');
        res.setHeader('Content-Type', 'image/jpg');
        res.setHeader('Content-Length', ''); // Image size here
        res.setHeader('Access-Control-Allow-Origin', '*'); // If needs to be public
        res.send(data);
    })
})
//delete myAd
app.delete("/product/delete/:myAdId", (req, res) => {
    const myAdId = req.params.myAdId;
    Product.deleteOne({ _id: myAdId }, async (error) => {
        if (error) throw error
        await res.send("Product deleted")
    })
})

//getMyAd

app.get("/product/getMyAd/:myAdId", (req, res) => {
    const myAdId = req.params.myAdId;

    Product.findOne({ _id: myAdId }, (error, data) => {

        if (error) {
            console.log(error);
            res.send(error)
        }
        res.send(data)

    })
})

//update myAd

app.put("/product/save/:myAdId", (req, res) => {
    const params = req.params.myAdId;

    Product.updateOne({ "_id": params }, req.body, null, (error, result) => {
        if (error) throw error;
        res.send(result)
    })

})


// user routes
app.use("/api/user", userRoute);

// * CONTACT MESSAGE API CALL
app.post('/api/send-message', async (req, res) => {
    const reqBody = req.body;

    // * ADD TO DATABASE
    const newMessage = new Emails(reqBody);
    const saveNewMessage = await newMessage.save();
    // console.log(saveNewMessage);

    // * NODEMAILER
    let testAccount = await nodemailer.createTestAccount();

    let transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
            user: testAccount.user, // generated ethereal user
            pass: testAccount.pass, // generated ethereal password
        },
    });

    // send mail with defined transport object
    let info = await transporter.sendMail({
        from: `${reqBody.firstName} ${reqBody.lastName} <${reqBody.email}>`, // sender address
        to: "onlineShop, office@onlineShop.com", // list of receivers
        // subject: "", // Subject line
        // text: "Hello world?", // plain text body
        html: `
        <p>
            ${reqBody.message}
        </p>
        `, // html body

    });

    // Preview only available when sending through an Ethereal account
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));

    res.send();
});

app.get("/", (req, res) => {
    res.send("Welcome to server");
})

// * ORDER SAVED TO DB
app.post('/api/ordered', async (req, res) => {
    let reqBody = req.body;

    const newOrder = new Order(reqBody);
    const saveNewOrder = await newOrder.save();
    res.send(saveNewOrder);
});


// get my ads
app.get("/product/my-adds", validationService.authValidation, (req, res) => {
    var decoded = jwt.verify(JSON.parse(req.headers.authorization), 'shhhhh')
    const userId = decoded._doc._id;
    Product.find({ userId: userId }, (error, data) => {
        if (error) {
            res.send(error);
        }

        if (data) {
            res.send(data);
        } else {
            res.send("No products jet.");
        }
    })
});

//get one user by username
app.get("/api/user/:username", (req, res) => {
    const param = req.params.username;
    Users.find({ username: param }, (error, result) => {
        if (error) throw error;
        res.send(result);
    });
});

//update user email by username
app.put("/api/user/:username", (req, res) => {
    const param = req.params.username;
    const query = req.query;

    Users.updateOne(
        { username: param },
        { email: query.email, isAdmin: query.admin },
        null,
        (error, result) => {
            if (error) throw error;
            res.send(result);
        }
    );
});


app.get("/api/products", (req, res) => {
    res.send(products);
});

app.get("/api/products/:id", (req, res) => {
    const productId = req.params.id;
    const findedProduct = products.find(
        (product) => product.id === parseInt(productId)
    );
    res.send(findedProduct);
});

app.get("/api/top-products/:top", (req, res) => {
    let topNumber = req.params.top
    let copyProduct = [...products]
    let sorted = copyProduct.sort((a, b) => {
        return b.rating.rate - a.rating.rate
    }
    )

    res.send(sorted.splice(0, topNumber))
});


app.use('/api/payment', paymentRoute)


// get all email admin
app.use('/api/admin', adminRoute)

app.delete('/api/admin/delete-msg/:id', (req, res) => {
    let idMsg = req.params.id;
    Emails.deleteOne({ _id: idMsg }, (err, data) => {
        if (data) {
            res.send("Uspjesno izbrisano")
        }
        if (err) {
            res.send("errror ")
        }
    })
})

app.put('/shop/products/set-rating', (req, res) => {
    const allRatings = req.body.allRatings;
    const averageRating = req.body.averageRating;
    const id = req.body.id;

    Product.updateOne(
        { _id: id }, { allRatings: [...allRatings], rating: averageRating },
        null, (error, data) => {
            if (error) throw error;
            res.send(data);
        })
})
//
app.get('/shop/products/get-rating/:id', (req, res) => {
    const id = req.params.id;
    Product.find({ _id: id }, (error, data) => {
        if (error) {
            console.log(error);
            res.send(error)
        }
        res.send({ allRatings: data[0].allRatings, rating: data[0].rating })
    })
})


// * RESET
app.put('/shop/product/reset', (req, res) => {
    console.log(req.body);
    // const id = req.body.id
    Users.updateMany({}, { $set: {votedFor: []} }, null, (err, data) => {
        if (err) {
            console.log(err)
            res.send('error je')
        }
        res.send('uspesno')
    })
})

// * DELETE
// app.put('/shop/product/delete', (req, res) => {
//     console.log(req.body);
//     // const id = req.body.id
//     Product.updateMany({}, {$unset: {'rate': ''}}, null, (err, data) => {
//         if (err) {
//             console.log(err)
//             res.send('error je')
//         }
//         res.send('uspesno')
//     })
// })

app.listen(serverConfig.port, (err) => {
    if (err) {
        console.log(err);
    } else {
        console.log(serverConfig.serverRunningMsg);
        console.log(serverConfig.serverLink);
    }
});
