<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1DUb-Oz6ml0z4wfsPWJEyyGJoGofSHJu0

## Run Locally

**Prerequisites:** Node.js

1.  Install dependencies:
    `npm install`
2.  Set the `GEMINI_API_KEY` in `.env` to your Gemini API key.
3.  Ensure your `DATABASE_URL` in `.env` is correctly configured for your PostgreSQL database.
4.  Run the app:
    `npm run dev`

## Populate with Test Data (Optional)

To quickly test the application with a full set of sample data, you can run the seeding script. This will create a sample event named "Festival Gastronómico 2024" and populate it with staff, products, customers, and transactions.

**Note:** Make sure you have run `npm install` before seeding.

Run the seed command:
`npm run seed`

This will give you a rich dataset to explore in the dashboard immediately.
