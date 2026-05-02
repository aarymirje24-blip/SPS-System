# SecureShare (SPS-System)

SecureShare is a secure, cloud-based enterprise file management and sharing system built with Node.js and Express. It is designed to handle organizational file storage securely, offering features like role-based access control, file tracking, secure sharing, and detailed audit logging.

## Features

- **🏢 Organization Management**: Create and manage isolated organization workspaces.
- **🔐 Role-Based Access Control (RBAC)**: Distinct permissions for `super_admin`, `admin`, and `user` roles.
- **📂 Secure File Storage**: Direct and secure file uploads stored via **Cloudinary**.
- **🔗 File Sharing**: Generate expiring, secure shareable links to share files internally or externally.
- **✉️ Email Notifications**: Automated email invites and password reset functionality using SMTP (Nodemailer).
- **📋 Audit Logging**: Comprehensive tracking of all file, user, and organization activities.
- **🎨 Modern UI**: Server-side rendered views using EJS with a clean, responsive CSS design.

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL (Serverless via Neon DB)
- **Templating Engine**: EJS (Embedded JavaScript)
- **Storage**: Cloudinary
- **Email Service**: Nodemailer (SMTP)
- **Security**: Bcrypt, JWT (JSON Web Tokens), Helmet, Express Rate Limit, Csurf

---

## Getting Started

### Prerequisites
Make sure you have the following installed and set up:
- Node.js (v16+)
- A Cloudinary Account
- A PostgreSQL Database (e.g., Neon DB)
- An SMTP server (e.g., SendGrid, Gmail, Mailtrap) for email delivery

### Installation

1. **Clone the repository and navigate into it:**
   ```bash
   git clone <repository-url>
   cd SPS-System
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Copy the example environment file and fill in your credentials.
   ```bash
   cp .env.example .env
   ```
   **Required `.env` Variables:**
   - `DATABASE_URL`: Your PostgreSQL connection string.
   - `JWT_SECRET` & `JWT_REFRESH_SECRET`: Secure random strings for tokens.
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: From your Cloudinary dashboard.
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`: Your email provider details.
   - `COOKIE_SECRET`: Secure string for signing cookies.

4. **Initialize the Database:**
   Run the migration script to create the necessary tables, enums, and triggers.
   ```bash
   node migrations/runMigration.js
   ```

5. **Run the Application:**
   ```bash
   # Development mode with hot-reloading
   npm run dev

   # Production mode
   npm start
   ```

   The server will start on `http://localhost:3001` (or your configured `PORT`).

---

## Folder Structure

```text
SPS-System/
├── migrations/       # Database migration scripts
├── src/
│   ├── config/       # App config (DB, Cloudinary, Env)
│   ├── controllers/  # Route logic and handlers
│   ├── middleware/   # Express middlewares (Auth, Rate Limiting)
│   ├── models/       # Database models
│   ├── public/       # Static files (CSS, JS, Images)
│   ├── routes/       # API and View routes
│   ├── services/     # External integrations (Cloudinary, Nodemailer)
│   ├── utils/        # Helper functions (JWT)
│   ├── views/        # EJS templates
│   ├── app.js        # Express app configuration
│   └── server.js     # Entry point
├── .env.example      # Example environment variables
└── package.json      # Dependencies and scripts
```

## Contributing
If you'd like to contribute, please fork the repository and use a feature branch. Pull requests are warmly welcome.

## License
ISC