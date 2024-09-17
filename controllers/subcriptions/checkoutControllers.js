require("dotenv").config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const Institutions = require("../../models/Institutions");
const Payments = require("../../models/Payments");
const ServicePlans = require("../../models/ServicePlans");
const Subscriptions = require("../../models/Subscriptions");

const AppError = require("../../utils/appError");
const catchAsync = require("../../utils/catchAsync");

// POST request to create Stripe Checkout session
exports.createCheckoutSession = catchAsync(async (req, res, next) => {
    const { servicePlanId } = req.params;

    //  Fetch the institution from the database
    const institution = await Institutions.findByPk(2);
    if (!institution) {
        return next(new AppError("Institution not found", 404));
    }

    // create a stripe customers to get the id
    const customer = await stripe.customers.create({
        email: institution.email, // Use institution's email or other details
        name: institution.name,
        // Add other customer details if needed
    });
    console.log("Customer object", customer);

    // Store customerId in the Institutions table
    await institution.update({
        stripeCustomerId : customer.id
    });

    // Fetch the service plan from the database
    const servicePlan = await ServicePlans.findByPk(servicePlanId);
    if (!servicePlan) {
        return next(new AppError("Service Plan not found", 404));
    }
    // Get the Price id
    const { stripePriceId } = servicePlan;
    if (!stripePriceId) {
        return next(new AppError("Price ID not found for the service plan", 400));
    }

    // Create a new subscription record with a unpaid status
    const subscription = await Subscriptions.create({
        institutionId: 2 || null,
        servicePlanId,
        startDate: new Date(),
        status: false,
    });

    // Create a new payment record with a unpaid status
    const payment = await Payments.create({
        subscriptionId: subscription.id,
        paymentDate: new Date(),
        amount: 0,
        status: false,
    });


    // Create the Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: stripePriceId, quantity: 1 }],
        success_url: `${process.env.BASE_URL}/dashboard`,
        cancel_url: `${process.env.BASE_URL}/price`,
        metadata: {
            subscriptionId: subscription.id,
            servicePlanId,
            paymentId : payment.id
        },
    });
    console.log("Session created completed : ", session);
    if (!session) {
        return next(new AppError("Failed to create Stripe session", 400));
    }
    console.log("Session created:", session.id);

    // Respond with the session ID
    res.status(200).json({ sessionId: session.id });
});

exports.getCancel = async (req, res) => {
    res.redirect("/");
};

exports.getSuccess = async (req, res) => {
    res.status(200).send("You've successfully subscribed to our plan");
};
