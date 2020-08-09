require('dotenv').config()
const bodyParser = require("body-parser");
const ejs = require("ejs");
const express = require("express");
const app = express();
const mongoose = require("mongoose");
// const encrypt = require("mongoose-encryption");
const session = require('express-session');
const passport = require('passport');
const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');
const FacebookStrategy = require('passport-facebook').Strategy;


app.set('view engine', 'ejs');

app.use(express.static("public"));
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

//Initializing passport and session dependncies
app.use(passport.initialize());
app.use(passport.session());

// mongoose.connect("mongodb://localhost:27017/userDB", {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//     useFindAndModify: false
// });
mongoose.connect("mongodb+srv://secretuser:secretuser@cluster0.nrh8d.azure.mongodb.net/secretuser?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false
})
// mongoose.set("useCreateIndex", true);

//Schema comes from up mongoose.Schema
const userSchema = new Schema({
    username: String,
    email: String,
    password: String,
    googleId: String,
    secret: String,
    facebookId: String
}, {
    sparse: true
});

//Initialzing passport local mongoose
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// userSchema.plugin(encrypt, {
//     secret: process.env.SECRET,
//     encryptedFields: ['password']
// });

const User = new mongoose.model("User", userSchema);

//Passport local configuration strategy
passport.use(User.createStrategy());

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user);
    });
});

//put it after all setup and before routes so it stores session and gets initialized
passport.use(new GoogleStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: "https://secret-posts.herokuapp.com/auth/google/secrets",
        userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",

    },
    (accessToken, refreshToken, profile, cb) => {
        //install and require find or create to make following fuction work
        User.findOrCreate({
            googleId: profile.id,
            email: profile.emails[0].value,
            username: 'Google'
            // email: profile.emails[0].value
        }, (err, user) => {
            return cb(err, user);
        });
    }
));



//for popup
app.get("/auth/google",
    passport.authenticate('google', {
        scope: ['profile', 'email']
    }));

//Once the user sign up with google next middleware
app.get("/auth/google/secrets",
    passport.authenticate("google", {
        failureRedirect: "/login"
    }),
    (req, res) => {
        // Successful authentication, redirect secret.
        res.redirect("/secrets");
    });

/*------------------------------------------------
facebook passport
------------------------------------------------ */


passport.use(new FacebookStrategy({
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: "https://secret-posts.herokuapp.com/auth/facebook/secrets",
        profileFields: ['id', 'emails', 'name'] //This
    },
    (accessToken, refreshToken, profile, done) => {
        console.log(profile.emails[0].value);
        User.findOrCreate({
            facebookId: profile.id,
            email: profile.emails[0].value,
            username: 'Facebook'
        }, {
            sparse: true
        }, (err, user) => {
            if (err) {
                return done(err);
            }
            done(null, user);
        });
    }
));

app.get('/auth/facebook',
    passport.authenticate('facebook', {
        scope: ['public_profile', 'email']
    }))

app.get('/auth/facebook/secrets',
    passport.authenticate('facebook', {
        successRedirect: '/secrets',
        failureRedirect: '/login'
    }));
//or scope can be email, user_friends etc
/*------------------------------------------------
facebook passport End
------------------------------------------------ */

app.get("/", (req, res) => {
    res.render("home");
});



app.get("/login", (req, res) => {
    res.render("login");
});

app.get("/register", (req, res) => {
    res.render("register");
})

app.get("/logout", (req, res) => {
    req.logout();
    res.redirect("/");
})

app.post("/login", async (req, res) => {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    //login method comes from passport
    await req.login(user, err => {
        if (err) {
            res.redirect("/login");
        } else {
            passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets");
            })
        }
    })
});

app.get("/secrets", (req, res) => {
    User.find({
        "secret": {
            $ne: null
        }
    }, (err, foundSecrets) => {
        if (err) {
            console.log(err);
        } else {
            if (foundSecrets) {
                res.render("secrets", {
                    usersWithSecrets: foundSecrets
                })
            }
        }
    });
})

app.get("/submit", (req, res) => {
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
})

app.post("/submit", (req, res) => {
    const subittedSecret = req.body.secret;

    User.findById(req.user.id, async (err, foundUser) => {
        if (err) {
            console.log(err);
        } else {
            foundUser.secret = subittedSecret;
            await foundUser.save(() => {
                res.redirect("/secrets");
            });
        }
    })
})

//Register method comes from passport
app.post("/register", (req, res) => {
    User.register({
        username: req.body.username
    }, req.body.password, async (err, user) => {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            await passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets");
            })
        }
    })

})

let port = process.env.PORT;
if (port == null || port == "") {
    port = 3000;
}
app.listen(port, function () {
    console.log("Server started successfully");
});