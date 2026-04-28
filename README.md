# Express HTML Server

This project is a simple Node.js and Express server that serves HTML files based on defined API routes. It is structured to separate concerns, making it easy to manage and extend.

## Project Structure

```
express-html-server
├── src
│   ├── app.js               # Initializes the Express application and middleware
│   ├── server.js            # Entry point for starting the server
│   ├── routes               # Contains route definitions
│   │   ├── index.js         # Main application routes
│   │   └── api.js           # API routes for future endpoints
│   ├── controllers          # Contains controller logic
│   │   └── pageController.js # Handles rendering of HTML pages
│   ├── views                # HTML files for rendering
│   │   ├── home.html        # Home page HTML
│   │   ├── about.html       # About page HTML
│   │   └── 404.html         # 404 error page HTML
│   └── public               # Static files
│       ├── css              # CSS styles
│       │   └── styles.css    # Styles for the application
│       └── js               # Client-side JavaScript
│           └── main.js      # JavaScript for client-side functionality
├── package.json             # npm configuration file
├── .gitignore               # Files and directories to ignore by Git
└── README.md                # Project documentation
```

## Getting Started

1. **Clone the repository:**
   ```
   git clone <repository-url>
   cd express-html-server
   ```

2. **Install dependencies:**
   ```
   npm install
   ```

3. **Run the server:**
   ```
   npm start
   ```

4. **Access the application:**
   Open your browser and navigate to `http://localhost:3000` to view the home page.

## Features

- Renders HTML pages for home and about sections.
- Handles 404 errors with a dedicated HTML page.
- Modular structure for easy maintenance and scalability.

## Future Enhancements

- Implement additional API endpoints in `src/routes/api.js`.
- Add more pages and corresponding controllers as needed.

## License

This project is licensed under the MIT License.