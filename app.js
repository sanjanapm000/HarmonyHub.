const express = require('express');
const db = require('./config/db');
const path = require("node:path");
const userRouter = require('./routes/userRouter')
const session = require('express-session')
const passport = require('./config/passport');
const adminRouter = require('./routes/adminRouter');
const bodyParser = require('body-parser');

require('dotenv').config();
const app = express();
db();

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:72*60*60*1000
    }
}))

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;  // Add the user session data to res.locals
    next();
  });

app.use((req,res,next)=>{
    res.set('cache-control','no-store');
    next();
})

app.set('view engine','ejs');
app.set('views',[path.join(__dirname,'views/user'),path.join(__dirname,'views/admin')]);
app.use(express.static(path.join(__dirname,'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/',userRouter);
app.use('/admin',adminRouter);

app.use("/*", async (req, res) => {
  try {
   

    res.render("page-404");
  } catch (error) {
    console.error("Error occurred while fetching cart data:", error);
   
  }
});
app.listen(process.env.PORT,()=>{
  console.log(`Server running on http://localhost:${process.env.PORT}`);
  
})