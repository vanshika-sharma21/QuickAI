import { GoogleGenerativeAI } from "@google/generative-ai";
import sql from "../configs/db.js";
import { callOpenRouterImageChatCompletions } from "../configs/openrouter.js";

import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// =====================================================
// GEMINI MODEL
// =====================================================

const getGeminiModel = async () => {
  const preferred = process.env.GEMINI_MODEL;

  const candidates = preferred
    ? [preferred]
    : ["gemini-2.5-flash"];

  for (const modelName of candidates) {
    try {
      return genAI.getGenerativeModel({
        model: modelName,
      });
    } catch (err) {
      console.log(
        `Gemini model ${modelName} unavailable:`,
        err.message
      );
    }
  }

  throw new Error("No Gemini model available");
};

// =====================================================
// GENERATE ARTICLE
// =====================================================

export const generateArticle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required",
      });
    }

    const model = await getGeminiModel();

    const result = await model.generateContent(prompt);

    const content = result.response.text();

    await sql`
      INSERT INTO creations
      (user_id, prompt, content, type)
      VALUES
      (${userId}, ${prompt}, ${content}, 'article')
    `;

    return res.json({
      success: true,
      content,
    });
  } catch (error) {
    console.log("ARTICLE ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================================
// GENERATE BLOG TITLE
// =====================================================

export const generateBlogTitle = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required",
      });
    }

    const model = await getGeminiModel();

    const result = await model.generateContent(prompt);

    const content = result.response.text();

    await sql`
      INSERT INTO creations
      (user_id, prompt, content, type)
      VALUES
      (${userId}, ${prompt}, ${content}, 'blog-title')
    `;

    return res.json({
      success: true,
      content,
    });
  } catch (error) {
    console.log("BLOG TITLE ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================================
// IMAGE GENERATION
// =====================================================

export const generateImage = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { prompt, publish } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required",
      });
    }

    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(
      prompt
    )}`;

    await sql`
      INSERT INTO creations
      (user_id, prompt, content, type, publish)
      VALUES
      (
        ${userId},
        ${prompt},
        ${imageUrl},
        'image',
        ${publish ?? false}
      )
    `;

    return res.json({
      success: true,
      content: imageUrl,
    });
  } catch (error) {
    console.log("IMAGE ERROR:", error.message);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// =====================================================
// HELPER - GET BASE64 FROM FILE
// =====================================================

const getBase64FromFile = (filePath) => {
  const buffer = fs.readFileSync(filePath);

  return buffer.toString("base64");
};

// =====================================================
// OPENROUTER IMAGE EDIT
// =====================================================

const callOpenRouterImageEdit = async ({
  imageBase64,
  mimeType,
  instruction,
}) => {
  const model =
    process.env.OPENROUTER_IMAGE_EDIT_MODEL ||
    "openai/gpt-image-1";

  const payload = {
    model,

    messages: [
      {
        role: "user",

        content: [
          {
            type: "text",
            text: instruction,
          },

          {
            type: "image_url",

            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
        ],
      },
    ],

    temperature: 0.2,
  };

  const data =
    await callOpenRouterImageChatCompletions({
      payload,
    });

  console.log(
    "OPENROUTER RESPONSE:",
    JSON.stringify(data, null, 2)
  );

  const content =
    data?.choices?.[0]?.message?.content;

  let text = "";

  // ---------------------------------------------------
  // STRING RESPONSE
  // ---------------------------------------------------

  if (typeof content === "string") {
    text = content.trim();
  }

  // ---------------------------------------------------
  // ARRAY RESPONSE
  // ---------------------------------------------------

  else if (Array.isArray(content)) {
    text = content
      .map((item) => item?.text || "")
      .join("")
      .trim();
  }

  // ---------------------------------------------------
  // TRY JSON
  // ---------------------------------------------------

  let parsed = null;

  try {
    parsed = JSON.parse(text);
  } catch (error) {
    parsed = null;
  }

  // ---------------------------------------------------
  // POSSIBLE URL FIELDS
  // ---------------------------------------------------

  const candidateUrl =
    parsed?.url ||
    parsed?.image_url ||
    parsed?.secure_url;

  if (candidateUrl) {
    return {
      content: candidateUrl,
    };
  }

  // ---------------------------------------------------
  // POSSIBLE BASE64 FIELDS
  // ---------------------------------------------------

  const candidateB64 =
    parsed?.base64 ||
    parsed?.image_base64 ||
    parsed?.image;

  if (candidateB64) {
    return {
      content: candidateB64.startsWith("data:")
        ? candidateB64
        : `data:${mimeType};base64,${candidateB64}`,
    };
  }

  // ---------------------------------------------------
  // MARKDOWN IMAGE URL
  // ---------------------------------------------------

  const markdownMatch = text.match(
    /!\[[^\]]*\]\((https?:\/\/[^)]+)\)/
  );

  if (markdownMatch) {
    return {
      content: markdownMatch[1],
    };
  }

  // ---------------------------------------------------
  // DIRECT DATA URL
  // ---------------------------------------------------

  if (text.startsWith("data:image")) {
    return {
      content: text,
    };
  }

  // ---------------------------------------------------
  // DIRECT URL
  // ---------------------------------------------------

  if (/^https?:\/\//i.test(text)) {
    return {
      content: text,
    };
  }

  throw new Error(
    "OpenRouter image edit did not return an image URL/base64"
  );
};

// =====================================================
// REMOVE IMAGE BACKGROUND
// =====================================================

export const removeImageBackground = async (req, res) => {
  let filePath = null;

  try {
    const { userId } = req.auth();

    const file = req.file;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Image file required",
      });
    }

    filePath = file.path;

    // -------------------------------------------------
    // CHECK API KEY
    // -------------------------------------------------

    if (!process.env.REMOVE_BG_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "REMOVE_BG_API_KEY is not configured",
      });
    }

    // -------------------------------------------------
    // FORM DATA
    // -------------------------------------------------

    const formData = new FormData();

    formData.append(
      "image_file",
      fs.createReadStream(filePath)
    );

    formData.append("size", "auto");

    // -------------------------------------------------
    // API REQUEST
    // -------------------------------------------------

    const response = await axios.post(
      "https://api.remove.bg/v1.0/removebg",
      formData,
      {
        responseType: "arraybuffer",

        headers: {
          ...formData.getHeaders(),

          "X-Api-Key":
            process.env.REMOVE_BG_API_KEY,
        },
      }
    );

    // -------------------------------------------------
    // CONVERT IMAGE TO BASE64
    // -------------------------------------------------

    const base64Image =
      `data:image/png;base64,${Buffer.from(
        response.data,
        "binary"
      ).toString("base64")}`;

    // -------------------------------------------------
    // SAVE TO DATABASE
    // -------------------------------------------------

    await sql`
      INSERT INTO creations
      (user_id, prompt, content, type)
      VALUES
      (
        ${userId},
        'Remove background',
        ${base64Image},
        'image'
      )
    `;

    return res.json({
      success: true,
      content: base64Image,
    });
  } catch (error) {
    console.log(
      "REMOVE BG ERROR:",
      error?.response?.data || error.message
    );

    return res.status(500).json({
      success: false,

      message:
        error?.response?.data?.errors?.[0]?.title ||
        error.message,
    });
  } finally {
    // -------------------------------------------------
    // DELETE TEMP FILE
    // -------------------------------------------------

    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.log(
          "TEMP FILE DELETE ERROR:",
          err.message
        );
      }
    }
  }
};

// =====================================================
// REMOVE IMAGE OBJECT
// =====================================================

export const removeImageObject = async (req, res) => {
  let filePath = null;

  try {
    const { userId } = req.auth();

    const { object } = req.body;

    const file = req.file;

    // -------------------------------------------------
    // AUTH
    // -------------------------------------------------

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // -------------------------------------------------
    // FILE CHECK
    // -------------------------------------------------

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Image required",
      });
    }

    filePath = file.path;

    // -------------------------------------------------
    // OBJECT CHECK
    // -------------------------------------------------

    if (!object) {
      return res.status(400).json({
        success: false,
        message: "Object is required",
      });
    }

    // -------------------------------------------------
    // READ IMAGE
    // -------------------------------------------------

    const mimeType =
      file.mimetype || "image/png";

    const imageBase64 =
      fs.readFileSync(filePath, {
        encoding: "base64",
      });

    // -------------------------------------------------
    // INSTRUCTION
    // -------------------------------------------------

    const instruction = `
Remove "${object}" from the image.

Fill the empty area naturally.

Keep the original background, lighting,
shadows, colors, composition and other objects unchanged.

Do not modify anything else.

Return only the final edited image.
`;

    // -------------------------------------------------
    // OPENROUTER
    // -------------------------------------------------

    const { content } =
      await callOpenRouterImageEdit({
        imageBase64,
        mimeType,
        instruction,
      });

    if (!content) {
      return res.status(500).json({
        success: false,
        message:
          "No image returned from OpenRouter",
      });
    }

    // -------------------------------------------------
    // SAVE TO DATABASE
    // -------------------------------------------------

    await sql`
      INSERT INTO creations
      (user_id, prompt, content, type)
      VALUES
      (
        ${userId},
        ${`Removed ${object}`},
        ${content},
        'image'
      )
    `;

    return res.json({
      success: true,
      content,
    });
  } catch (error) {
    console.log(
      "REMOVE OBJECT ERROR:",
      error?.response?.data ||
        error.message
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    // -------------------------------------------------
    // DELETE TEMP FILE
    // -------------------------------------------------

    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.log(
          "TEMP FILE DELETE ERROR:",
          err.message
        );
      }
    }
  }
};

// =====================================================
// RESUME REVIEW
// =====================================================

export const resumeReview = async (req, res) => {
  let filePath = null;

  try {
    const { userId } = req.auth();

    const resume = req.file;

    // -------------------------------------------------
    // AUTH
    // -------------------------------------------------

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // -------------------------------------------------
    // FILE CHECK
    // -------------------------------------------------

    if (!resume) {
      return res.status(400).json({
        success: false,
        message: "Resume file is required",
      });
    }

    filePath = resume.path;

    // -------------------------------------------------
    // CHECK RESUME API KEY
    // -------------------------------------------------

    if (!process.env.RESUME) {
      return res.status(500).json({
        success: false,
        message:
          "RESUME API key is not configured",
      });
    }

    // -------------------------------------------------
    // CREATE FORM DATA
    // -------------------------------------------------

    const formData = new FormData();

    formData.append(
      "file",
      fs.createReadStream(filePath)
    );

    // -------------------------------------------------
    // CVPARSE API
    // -------------------------------------------------

    const response = await axios.post(
      "https://api.cvparse.io/v1/parse",
      formData,
      {
        headers: {
          Authorization:
            `Bearer ${process.env.RESUME}`,

          ...formData.getHeaders(),
        },

        timeout: 60000,
      }
    );

    const parsedResume = response.data;

    // -------------------------------------------------
    // SAVE TO DATABASE
    // -------------------------------------------------

    await sql`
      INSERT INTO creations
      (user_id, prompt, content, type)
      VALUES
      (
        ${userId},
        'Resume Review',
        ${JSON.stringify(parsedResume)},
        'resume-review'
      )
    `;

    // -------------------------------------------------
    // RESPONSE
    // -------------------------------------------------

    return res.json({
      success: true,
      content: parsedResume,
    });
  } catch (error) {
    console.log(
      "CVPARSE ERROR:",
      error?.response?.data ||
        error.message
    );

    return res.status(500).json({
      success: false,

      message:
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error.message,
    });
  } finally {
    // -------------------------------------------------
    // DELETE TEMP RESUME
    // -------------------------------------------------

    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.log(
          "RESUME FILE DELETE ERROR:",
          err.message
        );
      }
    }
  }
};