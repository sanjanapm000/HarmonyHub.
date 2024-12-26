const User = require("../../models/userSchema");



const customerInfo = async(req,res)=>{
    try {
        let search ="";
        if(req.query.search){
            search=req.query.search;
        }
        let page=1;
        if(req.query.page){
            page=req.query.page
        }
        const limit=3;
        const userData = await User.find({
            isAdmin:false,
            $or:[
                
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ]
        })
        .limit(limit*1)
        .skip((page-1)*limit)
        .exec();

        const count = await User.find({
            isAdmin:false,
            $or:[
                
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}}
            ]
        }).countDocuments();

        const totalPages = Math.ceil(count / limit);
        res.render('customers', {
            data: userData,
            currentPage: page,
            totalPages: totalPages,
            search: search
        });
    } catch (error) {
        console.error("Error fetching customer info:", error);
        res.status(500).send("An error occurred while fetching customer data.");
    }
}

const customerBlocked = async (req, res) => {
    try {
        const userId = req.query.id;

        // Update the user's 'isBlocked' status
        await User.updateOne({ _id: userId }, { $set: { isBlocked: true } });

        // Check if the blocked user is the currently logged-in user
        if (req.session.user && req.session.user._id.toString() === userId) {
            // If the logged-in user is the one being blocked, destroy the session
            req.session.destroy((err) => {
                if (err) {
                    console.error("Error destroying session:", err);
                    return res.status(500).send("Error logging out user");
                }

                // Clear the session cookie
                res.clearCookie('connect.sid');

                // Redirect to the homepage (or login page) since the user is logged out
                // return res.redirect('/');
            });
        } else {
            // Redirect to the admin users page if the logged-in user is not the one being blocked
            return res.redirect("/admin/users");
        }
    } catch (error) {
        console.error("Error blocking user:", error);
        res.redirect("/pageerror");  // Redirect to a page error view if any error occurs
    }
};


const customerunBlocked=async(req,res)=>{
    try {
        let id=req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}});
        res.redirect("/admin/users");
    } catch (error) {
        res.redirect("/pageerror")
    }
}




module.exports={
    customerInfo,
    customerBlocked,
    customerunBlocked
}