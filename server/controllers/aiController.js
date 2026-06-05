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

// ================= GEMINI MODEL =================

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
    } catch (err) {}
  }

  throw new Error("No Gemini model available");
};

// ================= ARTICLE =================

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

    res.json({
      success: true,
      content,
    });

  } catch (error) {
    console.log("ARTICLE ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= BLOG TITLE =================

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

    res.json({
      success: true,
      content,
    });

  } catch (error) {
    console.log("BLOG TITLE ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= IMAGE GENERATION =================

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

    const imageUrl =
      `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;

    await sql`
      INSERT INTO creations
      (user_id, prompt, content, type, publish)
      VALUES
      (${userId}, ${prompt}, ${imageUrl}, 'image', ${publish ?? false})
    `;

    res.json({
      success: true,
      content: imageUrl,
    });

  } catch (error) {
    console.log("IMAGE ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= HELPERS =================

const getBase64FromFile = (filePath) => {
  const buffer = fs.readFileSync(filePath);
  return buffer.toString("base64");
};

// ================= OPENROUTER IMAGE EDIT =================

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

  // STRING RESPONSE
  if (typeof content === "string") {
    text = content;
  }

  // ARRAY RESPONSE
  else if (Array.isArray(content)) {
    text = content
      .map((item) => item?.text || "")
      .join("");
  }

  let parsed = null;

  // TRY PARSING JSON
  try {
    parsed = JSON.parse(text);
  } catch (e) {}

  // POSSIBLE URL FIELDS
  const candidateUrl =
    parsed?.url ||
    parsed?.image_url ||
    parsed?.secure_url;

  // POSSIBLE BASE64 FIELDS
  const candidateB64 =
    parsed?.base64 ||
    parsed?.image_base64 ||
    parsed?.image;

  // RETURN IMAGE URL
  if (candidateUrl) {
    return {
      content: candidateUrl,
    };
  }

  // RETURN BASE64
  if (candidateB64) {
    return {
      content: candidateB64.startsWith("data:")
        ? candidateB64
        : `data:${mimeType};base64,${candidateB64}`,
    };
  }

  // MARKDOWN IMAGE URL SUPPORT
  const markdownMatch =
    text.match(/\((https?:\/\/.*?)\)/);

  if (markdownMatch) {
    return {
      content: markdownMatch[1],
    };
  }

  // DIRECT DATA URL
  if (text.startsWith("data:")) {
    return {
      content: text,
    };
  }

  // DIRECT URL
  if (/^https?:\/\//i.test(text.trim())) {
    return {
      content: text.trim(),
    };
  }

  throw new Error(
    "OpenRouter image edit did not return an image URL/base64"
  );
};

// ================= REMOVE BACKGROUND =================

export const removeImageBackground = async (req, res) => {
  try {

    const { userId } = req.auth()

    const file = req.file

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      })
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Image file required",
      })
    }

    // FORM DATA
    const formData = new FormData()

    formData.append(
      "image_file",
      fs.createReadStream(file.path)
    )

    formData.append("size", "auto")

    // API REQUEST
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
    )

    // CONVERT IMAGE TO BASE64
    const base64Image =
      `data:image/png;base64,${Buffer.from(
        response.data,
        "binary"
      ).toString("base64")}`

    // DELETE TEMP FILE
    fs.unlinkSync(file.path)

    // SAVE TO DB
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
    `

    res.json({
      success: true,
      content: base64Image,
    })

  } catch (error) {

    console.log(
      "REMOVE BG ERROR:",
      error?.response?.data ||
      error.message
    )

    res.status(500).json({
      success: false,

      message:
        error?.response?.data?.errors?.[0]?.title ||
        error.message,
    })
  }
}

// ================= REMOVE OBJECT =================

export const removeImageObject = async (req, res) => {
  try {
    const { userId } = req.auth();
    const { object } = req.body;
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
        message: "Image required",
      });
    }

    if (!object) {
      return res.status(400).json({
        success: false,
        message: "Object is required",
      });
    }

    const mimeType = file.mimetype || "image/png";

    const imageBase64 = fs.readFileSync(file.path, {
      encoding: "base64",
    });

    fs.unlinkSync(file.path);

    const instruction = `
Remove "${object}" from the image.
Fill the empty area naturally.
Do not change anything else.
Return only the final edited image.
`;

    const { content } = await callOpenRouterImageEdit({
      imageBase64,
      mimeType,
      instruction,
    });

    if (!content) {
      return res.status(500).json({
        success: false,
        message: "No image returned from OpenRouter",
      });
    }

    await sql`
      INSERT INTO creations
      (user_id, prompt, content, type)
      VALUES
      (${userId}, ${`Removed ${object}`}, ${content}, 'image')
    `;

    return res.json({
      success: true,
      content,
    });

  } catch (error) {
    console.log(
      "REMOVE OBJECT ERROR:",
      error?.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ================= RESUME REVIEW =================

export const resumeReview = async (req, res) => {
  try {
    const { userId } = req.auth();
    const resume = req.file;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!resume) {
      return res.status(400).json({
        success: false,
        message: "Resume file is required",
      });
    }

    const formData = new FormData();

    formData.append(
      "file",
      fs.createReadStream(resume.path)
    );

    // CVParse endpoint can differ by API/version. Using the base parse route.
    // If your CVParse account expects a different path, update the URL here.
    const response = await axios.post(
      "https://api.cvparse.io/v1/parse",
      formData,
      {
        headers: {
          Authorization: `Bearer ${process.env.RESUME}`,
          ...formData.getHeaders(),
        },
      }
    );


    const parsedResume = response.data;

    if (fs.existsSync(resume.path)) {
      fs.unlinkSync(resume.path);
    }

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

    res.json({
      success: true,
      content: parsedResume,
    });

  } catch (error) {
    console.log(
      "CVPARSE ERROR:",
      error.response?.data || error.message
    );

    res.status(500).json({
      success: false,
      message:
        error.response?.data?.message ||
        error.message,
    });
  }
};