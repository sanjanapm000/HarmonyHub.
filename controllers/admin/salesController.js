const Order = require("../../models/orderSchema");
const { generatePDF, generateExcel } = require('../../utils/reportUtils.js');
const salesService = require('../../utils/saleService.js');
const { jsPDF } = require("jspdf");
require("jspdf-autotable");





const generateSalesReport = async (req, res) => {
    const { reportType, startDate, endDate, downloadFormat } = req.body;
    console.log("req.body from salescontroller", req.body);

    try {
        let query = { orderStatus: 'Delivered' }; // Add condition for delivered orders

        // Apply date filters based on the selected report type
        if (reportType === 'custom') {
            query.orderDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
        } else if (reportType === 'daily') {
            const today = new Date();
            query.orderDate = { $gte: new Date(today.setHours(0, 0, 0, 0)) };
        } else if (reportType === 'weekly') {
            const weekStart = new Date();
            weekStart.setDate(weekStart.getDate() - 7);
            query.orderDate = { $gte: weekStart };
        } else if (reportType === 'monthly') {
            const monthStart = new Date();
            monthStart.setMonth(monthStart.getMonth() - 1);
            query.orderDate = { $gte: monthStart };
        } else if (reportType === 'yearly') {
            const yearStart = new Date();
            yearStart.setFullYear(yearStart.getFullYear() - 1);
            query.orderDate = { $gte: yearStart };
        }

        // Fetch orders based on the query
        const orders = await Order.find(query);
        console.log("orders",orders);
        

        // Calculate total sales count, total order amount, and total discount
        const totalSalesCount = orders.length;
        const totalOrderAmount = orders.reduce((sum, order) => sum + order.grandTotalCost, 0);
        const totalDiscount = orders.reduce((sum, order) => sum + order.discountAmount, 0);
        const totalCouponDeduction = orders.reduce((sum, order) => sum + (order.couponAmount || 0), 0);

        // Prepare the report data
        const reportData = {
            totalSalesCount,
            totalOrderAmount,
            totalDiscount,
            totalCouponDeduction,
            orders,
        };

        if (downloadFormat === 'pdf') {
            // Generate and download PDF if requested
            const { pdfBuffer, filename } = await generatePDF(reportData, reportType);
            res.set({
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename=${filename}`,
            });
            res.send(pdfBuffer);
        } else if (downloadFormat === 'excel') {
            // Generate and download Excel if requested
            const excelBuffer = await generateExcel(reportData);
            res.set({
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename=sales_report.xlsx',
            });
            res.send(excelBuffer);
        } else {
            // Return report data as JSON for rendering in the frontend
            res.json(reportData);
        }
    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).send('Error generating report');
    }
};









const getReport = async(req,res)=>{
    try {
      res.render('sales')
    } catch (error) {
      console.log(error);
      
    }
}




const generateLedger = async (req,res)=>{
    try {
        // Fetch data (you can adjust the query as needed)
        const orders = await Order.aggregate([
            { $unwind: '$cartData' },
            
            {
                $group: {
                    _id: '$cartData.productId._id',
                    totalSold: { $sum: '$cartData.productQty' },
                    totalRevenue: { $sum: { $multiply: ['$cartData.productQty', '$cartData.productId.salePrice'] } }
                }
            },
            { $sort: { totalSold: -1 } }
        ]);
       console.log("orders from ledger book",orders);
       
        // Initialize jsPDF instance
        const doc = new jsPDF();

        // Add title and date
        doc.setFontSize(16);
        doc.text('Ledger Book - Sales Report', 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 30);

        // Prepare table data
        const tableHeaders = [['Product', 'Total Sold', 'Total Revenue (INR)']];
        const tableData = orders.map(order => [
            order._id, // Product name
            order.totalSold, // Total sold
            order.totalRevenue.toFixed(2), // Total revenue
        ]);

        // Use autoTable for creating a better-looking table
        doc.autoTable({
            head: tableHeaders,
            body: tableData,
            startY: 40, // Start position for the table
            theme: 'grid', // Table style
            headStyles: {
                fillColor: [22, 160, 133], // Header background color (RGB)
                textColor: [255, 255, 255], // Header text color
                fontStyle: 'bold',
            },
            bodyStyles: {
                fillColor: [245, 245, 245], // Row background color for zebra striping
            },
            alternateRowStyles: {
                fillColor: [255, 255, 255], // Alternate row background color
            },
            margin: { top: 40 },
        });

        // Send the PDF as a response with correct headers
        const pdfOutput = doc.output('arraybuffer'); // Use arraybuffer format to send the PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=ledger-book.pdf');
        res.send(Buffer.from(pdfOutput));
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send('Error generating PDF');
    }
};









module.exports={
    getReport,
    generateSalesReport,
    generateLedger,
}