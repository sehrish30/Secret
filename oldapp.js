require('dotenv').config()
const bodyParser = require("body-parser");
const ejs = require("ejs");
const express = require("express");
const app = express();
const mongoose = require("mongoose");
// const encrypt = require("mongoose-encryption");
const md5 = require("md5");
const Schema = mongoose.Schema;
const bcrypt = require('bcrypt');
const saltRounds = 10;

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({
    extended: true
}));

mongoose.connect("mongodb://localhost:27017/userDB", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
});

//Schema comes from up mongoose.Schema
const userSchema = new Schema({
    email: String,
    password: String
});


// userSchema.plugin(encrypt, {
//     secret: process.env.SECRET,
//     encryptedFields: ['password']
// });

const User = new mongoose.model("User", userSchema);



app.use(express.static("public"));

app.get("/", (req, res) => {
    res.render("home");
});

app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
})

app.post("/login", async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    await User.findOne({
        email: username
    }, (err, foundUser) => {
        if (err) {
            console.log(err);
        } else {
            if (foundUser) {
                // Load hash from your password DB.
                bcrypt.compare(password, foundUser.password, (err, result) => {
                    // result == true
                    if (result === true) {
                        res.render("secrets");
                    }
                });
            }
        }
    });
});

app.post("/register", (req, res) => {
    bcrypt.hash(req.body.password, saltRounds, async (err, hash) => {
        // Store hash in your password DB.
        const newUser = new User({
            email: req.body.username,
            password: hash
        })
        await newUser.save(err => {
            if (err) {
                console.log(err);
            } else {
                res.render("secrets");
            }
        })
    });

})

app.listen(3000, () => {
    console.log("Server started on port 3000");
});