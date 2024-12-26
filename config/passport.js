const passport = require('passport');
const googleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/userSchema');
require('dotenv').config();


passport.use(new googleStrategy({
    clientID:process.env.GOOGLE_CLIENT_ID,
    clientSecret:process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:'/auth/google/callback',
    scope:['profile','email']
},
async (accessToken,refreshToken,profile,done)=>{
    console.log("Google Profile:", profile); 

    try {
        let user = await User.findOne({googleId:profile.id});
        if(user){
            return done(null,user)
        }else{
            user = new User({
                name:profile.displayName,
                email:profile.emails[0].value,
                googleId:profile.id,
                phone:7878909282,
            });
            await user.save();
            return done(null,user);
        }
    } catch (error) {
        console.error("Error during Google authentication:", error); 

        return done(error,null);
    }
}
))


passport.serializeUser((user,done)=>{
    done(null,user.id)
});

passport.deserializeUser((id,done)=>{
    User.findById(id)
    .then(user=>{
        done(null,user)
    })
    .catch(err =>{
        done(error,null)
    })
})




passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID, 
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: '/auth/facebook/callback',
    profileFields: ['id', 'displayName', 'emails'], 
},
async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ facebookId: profile.id });
        if (user) {
            return done(null, user);
        } else {
            user = new User({
                name: profile.displayName,
                email: profile.emails[0].value,
                facebookId: profile.id, 
            });
            await user.save();
            return done(null, user);
        }
    } catch (error) {
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id)
        .then(user => {
            done(null, user);
        })
        .catch(err => {
            done(err, null);
        });
});


module.exports = passport;