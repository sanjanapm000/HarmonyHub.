// utils/reportUtils.js
// const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const pdf = require('pdfkit');
const streamBuffers = require('stream-buffers');

// const generatePDF = (data) => {
//     return new Promise((resolve, reject) => {
//         const doc = new pdf();
//         const writableStream = new streamBuffers.WritableStreamBuffer();

//         doc.pipe(writableStream);

//         // Example PDF content generation
//         doc.text('Sales Report', { align: 'center', fontSize: 18 });
//         doc.moveDown();
//         doc.text(`Total Sales Count: ${data.totalSalesCount}`);
//         doc.text(`Total Order Amount: ${data.totalOrderAmount}`);
//         doc.text(`Total Discount: ${data.totalDiscount}`);
//         doc.text(`Total Coupon Deduction: ${data.totalCouponDeduction}`);

//         // Orders section (example)
//         doc.moveDown();
//         doc.text('Order Details:');
//         data.orders.forEach(order => {
//             doc.text(`Order ID: ${order._id}, Total: ${order.grandTotalCost}`);
//         });

//         doc.end();

//         writableStream.on('finish', () => {
//             resolve(writableStream.getContents());
//         });

//         writableStream.on('error', reject);
//     });
// };


const generatePDF = (data, reportType) => {
    return new Promise((resolve, reject) => {
        const doc = new pdf();
        const writableStream = new streamBuffers.WritableStreamBuffer();

        doc.pipe(writableStream);

        // Set up the page size and margins
        doc.page.margins = { top: 50, left: 50, bottom: 50, right: 50 };

        // Title - Centered
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .text('Sales Report', { align: 'center' });

        // Add a horizontal line after title
        doc.moveDown(1).lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();

        // Add spacing after title
        doc.moveDown(2);

        // Add Report Type and Date to make it unique
        const reportDate = new Date().toLocaleDateString();
        doc.fontSize(12).font('Helvetica').text(`Report Type: ${reportType} | Date: ${reportDate}`, { align: 'center' });

        // Add spacing
        doc.moveDown(2);

        // Total Information Section
        doc.fontSize(12).font('Helvetica');
        doc.text(`Total Sales Count: ${data.totalSalesCount}`, { width: 500, align: 'left' });
        doc.text(`Total Order Amount: INR ${formatCurrency(data.totalOrderAmount)}`, { width: 500, align: 'left' });
        doc.text(`Total Discount: INR ${formatCurrency(data.totalDiscount)}`, { width: 500, align: 'left' });
        doc.text(`Total Coupon Deduction: INR ${formatCurrency(data.totalCouponDeduction)}`, { width: 500, align: 'left' });

        // Add spacing
        doc.moveDown(2);

        // Add Order Details Heading
        doc.fontSize(16).font('Helvetica-Bold').text('Order Details:', { underline: true });

        // Create a table of orders
        const tableTop = doc.y;
        const orderData = data.orders;

        // Table Headers
        const headers = ['Order ID', 'Order Date', 'Grand Total', 'Discount', 'Coupon Deduction'];
        const tableColumnWidth = [100, 100, 100, 100, 100];

        // Draw header row
        doc.fontSize(12).font('Helvetica-Bold');
        headers.forEach((header, i) => {
            doc.text(header, 50 + tableColumnWidth[i] * i, tableTop, { width: tableColumnWidth[i], align: 'center' });
        });

        // Add spacing between header and rows
        doc.moveDown(1);

        // Draw the order rows with more spacing
        doc.fontSize(10).font('Helvetica');
        orderData.forEach((order, index) => {
            const yPosition = tableTop + 30 + (index * 30); // Increased spacing between rows

            doc.text(order._id, 50, yPosition, { width: tableColumnWidth[0], align: 'center' });
            doc.text(new Date(order.orderDate).toLocaleString(), 150, yPosition, { width: tableColumnWidth[1], align: 'center' });
            doc.text(`INR ${formatCurrency(order.grandTotalCost)}`, 250, yPosition, { width: tableColumnWidth[2], align: 'center' });
            doc.text(`INR ${formatCurrency(order.discountAmount)}`, 350, yPosition, { width: tableColumnWidth[3], align: 'center' });
            doc.text(`INR ${formatCurrency(order.couponAmount || 0)}`, 450, yPosition, { width: tableColumnWidth[4], align: 'center' });
        });

        // Finalize PDF
        doc.end();

        writableStream.on('finish', () => {
            // Generate unique filename with the report type and date
            const filename = `sales_report_${reportType}_${reportDate}.pdf`.replace(/\//g, '-'); // Sanitize the date format
            resolve({ pdfBuffer: writableStream.getContents(), filename });
        });

        writableStream.on('error', reject);
    });
};

// Helper function to format numbers in INR with commas
const formatCurrency = (amount) => {
    return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const generateExcel = async (reportData) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    worksheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 30 },
        { header: 'Total Amount', key: 'totalAmount', width: 15 },
        { header: 'Discount', key: 'discount', width: 15 },
    ];

    reportData.orders.forEach(order => {
        worksheet.addRow({
            orderId: order._id,
            totalAmount: order.grandTotalCost,
            discount: order.discountAmount,
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
};

module.exports = { generatePDF , generateExcel,};