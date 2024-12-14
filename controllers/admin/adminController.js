const User = require("../../models/userSchema");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const salesService = require('../../utils/saleService');
const Order = require("../../models/orderSchema")

const pageerror = async(req,res)=>{
    res.send("ERROR");
}



const loadLogin = (req,res)=>{
    if(req.session.admin){
        return res.redirect('/admin/dashboard');
    }
    res.render("admin-login",{message:null})
}


const login = async (req,res)=>{
    try {
        const {email,password} = req.body;
        const admin = await User.findOne({email,isAdmin:true});
        if(admin){
            const passwordMatch = await bcrypt.compare(password,admin.password);
            if(passwordMatch){
                req.session.admin=true;
                return res.redirect('/admin')
            }else{
                return res.redirect("/login")
            }
        }else{
            return res.redirect("/login")
        }
    } catch (error) {
        console.log("login error",error);
        return res.redirect("/pageerror")
    }
}



const logout = async(req,res)=>{
    try {
        req.session.destroy(err=>{
            if(err){
                console.log("Error destroying session",err);
                return res.redirect("/pageerror")
            }
            // res.clearCookie('connect.sid');
            res.redirect("/admin/login")
        })
    } catch (error) {
        console.log("Unexpected error during logout",error);
        re.redirect("/pageerror")
    }
}



const getDashboard = async (req,res)=>{
    try {
        const { filter } = req.query; // Get the filter (daily or monthly) from the query
        console.log("req.query",req.query);
        
        let aggregationPipeline;

        if (filter === 'daily') {
            // Daily aggregation
            aggregationPipeline = [

                {
                    $group: {
                        _id: {
                            day: { $dayOfMonth: "$orderDate" },
                            month: { $month: "$orderDate" },
                            year: { $year: "$orderDate" }
                        },
                        totalSales: {
                            $sum: "$grandTotalAfterDiscount" // Sum of finalAmount (after discount)
                        }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } } // Sort by date
            ];
        } else if (filter === 'monthly') {
            // Monthly aggregation
            aggregationPipeline = [
                
                {
                    $group: {
                        _id: {
                            month: { $month: "$orderDate" },
                            year: { $year: "$orderDate" }
                        },
                        totalSales: {
                            $sum: "$grandTotalAfterDiscount" // Sum of finalAmount (after discount)
                        }
                    }
                },
                { $sort: { "_id.year": 1, "_id.month": 1 } } // Sort by year and month
            ];
        } else {

            return res.status(400).json({ success: false, message: "Invalid filter provided" });
        }

        // Execute the aggregation
        const salesData = await Order.aggregate(aggregationPipeline);

        res.status(200).json({ success: true, data: salesData });
    } catch (error) {
        console.error("Error fetching sales data:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
}

const loadDashboard = async (req,res)=>{
try {
    // Fetch the top selling products, categories, and brands
    const topSellingProducts = await salesService.getTopSellingProducts();
    const topSellingCategories = await salesService.getTopSellingCategories();

    // Render the dashboard with the fetched data
    res.render('dashboard', {
        topSellingProducts,
        topSellingCategories,
        
    });
} catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
}
}

module.exports={
    loadLogin,
    login,
    loadDashboard,
    pageerror,
    logout,
    getDashboard,
}