const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
const PORT = 5000;

// Middleware
app.use(cors({
  origin: 'https://localhost:3000', // Adjust as needed
  credentials: true,
}));
app.use(express.json());

app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", 
      "default-src 'self'; " +
      "script-src 'self' https://apis.google.com https://www.gstatic.com 'unsafe-inline'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "img-src 'self' data: https://firebasestorage.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "connect-src 'self' https://identitytoolkit.googleapis.com https://firestore.googleapis.com wss://localhost:3000; " +
      "frame-src https://*.firebaseapp.com https://accounts.google.com; " +
      "object-src 'none';"
    );
    next();
  });
  

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // your existing fetch‑directives
          defaultSrc:   ["'self'"],
          scriptSrc:    ["'self'", /* etc… */],
          styleSrc:     ["'self'", /* etc… */],
          imgSrc:       ["'self'", /* etc… */],
          connectSrc:   ["'self'", /* etc… */],
          fontSrc:      ["'self'", /* etc… */],
          workerSrc:    ["'self'", "blob:"],
  
          // add every “no‑fallback” directive:
          baseUri:        ["'self'"],        // only allow <base> from self
          formAction:     ["'self'"],        // only allow form submits back to self
          frameAncestors: ["'self'"],        // only allow being framed by self
          pluginTypes:    ["'none'"],        // disallow all plugins
          // either report‑only or reporting endpoint:
          // reportTo:       "csp-collector",
          reportUri:      "/csp-violation-endpoint", 
  
          // if you aren’t sandboxing, explicitly disable:
          sandbox:        []                // empty = no sandbox flags, but defined
        },
        // reportOnly: true   // ← use this while you tune
      }
    })
  );
  
  
app.disable('x-powered-by');

// Initialize Gemini client
const client = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
console.log("API Key:", process.env.REACT_APP_GEMINI_API_KEY); // Debugging line

// AI function (adapted from your React code)
async function run(input, task, isImage = false, mimeType = "image/jpeg") {
  const model = client.getGenerativeModel({
    model: isImage ? "gemini-pro-vision" : "gemini-2.0-flash",
  });

  const prompt =
    isImage && task === "describe"
      ? "Describe the image content."
      : isImage && task === "objects"
      ? "Identify key objects or elements in the image."
      : task === "summarize"
      ? `${input}\nSummarize the content of the file.`
      : `${input}\nExtract the main keywords from the file content.`;

  try {
    if (isImage) {
      const imagePart = {
        inlineData: {
          mimeType,
          data: input, // base64 without data:image/...;base64,
        },
      };

      const result = await model.generateContent({
        contents: [{ parts: [prompt, imagePart] }],
      });

      const response = await result.response;
      return await response.text();
    } else {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return await response.text();
    }
  } catch (error) {
    console.error("Error generating AI content:", error);
    return "Error processing content with AI.";
  }
}

// Route to handle AI interaction
app.post('/ai', async (req, res) => {
  const { input, task, isImage = false, mimeType = "image/jpeg" } = req.body;

  if (!input || !task) {
    return res.status(400).json({ error: 'Missing input or task' });
  }

  try {
    const result = await run(input, task, isImage, mimeType);
    res.json({ result });
  } catch (err) {
    console.error("Error interacting with AI:", err);
    res.status(500).json({ error: 'AI processing failed' });
  }
});

// Chatbot route using the same client
app.post("/chatbot", async (req, res) => {
  const { input } = req.body;

  if (!input) {
    return res.status(400).json({ error: "Input is required" });
  }

  try {
    const model = client.getGenerativeModel({
      model: 'gemini-2.0-flash', // Use Gemini 2.0 Flash model
    });

    const result = await model.generateContent(input);
    const response = await result.response;
    res.json({ result: await response.text() });
  } catch (error) {
    console.error("Error with AI API:", error);
    res.status(500).json({ error: "Error processing request" });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
