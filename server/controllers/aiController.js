import { GoogleGenerativeAI } from "@google/generative-ai";
import sql from "../configs/db.js";
import { callOpenRouterImageChatCompletions } from "../configs/openrouter.js";

import axios from "axios";
import FormData from "form-data";
import fs from "fs";

// =====================================================
// GEMINI SETUP
// =====================================================

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

// =====================================================
// GET GEMINI MODEL
// =====================================================

const getGeminiModel = () => {
  const modelName =
    process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!process.env.GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY is not configured in .env"
    );
  }

  return genAI.getGenerativeModel({
    model: modelName,
  });
};

// =====================================================
// GENERATE ARTICLE
// =====================================================

export const generateArticle = async (req, res) => {
  try {
    const auth = req.auth?.();
    const userId = auth?.userId;

    const { prompt } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required",
      });
    }

    const model = getGeminiModel();

    const result = await model.generateContent(
      prompt.trim()
    );

    const content = result?.response?.text?.();

    if (!content) {
      throw new Error(
        "Gemini did not return any content"
      );
    }

    // SAVE ARTICLE TO DATABASE
    await sql`
      INSERT INTO creations
      (user_id, prompt, content, type)
      VALUES (
        ${userId},
        ${prompt},
        ${content},
        'article'
      )
    `;

    return res.status(200).json({
      success: true,
      content,
    });
  } catch (error) {
    console.error(
      "ARTICLE ERROR:",
      error?.response?.data ||
        error?.message ||
        error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to generate article",
    });
  }
};

// =====================================================
// GENERATE BLOG TITLE
// =====================================================

export const generateBlogTitle = async (req, res) => {
  try {
    const auth = req.auth?.();
    const userId = auth?.userId;

    const { prompt } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required",
      });
    }

    const model = getGeminiModel();

    const result = await model.generateContent(
      prompt.trim()
    );

    const content = result?.response?.text?.();

    if (!content) {
      throw new Error(
        "Gemini did not return any content"
      );
    }

    // SAVE BLOG TITLE TO DATABASE
    await sql`
      INSERT INTO creations
      (user_id, prompt, content, type)
      VALUES (
        ${userId},
        ${prompt},
        ${content},
        'blog-title'
      )
    `;

    return res.status(200).json({
      success: true,
      content,
    });
  } catch (error) {
    console.error(
      "BLOG TITLE ERROR:",
      error?.response?.data ||
        error?.message ||
        error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to generate blog title",
    });
  }
};

// =====================================================
// GENERATE IMAGE
// =====================================================

export const generateImage = async (req, res) => {
  try {
    const auth = req.auth?.();
    const userId = auth?.userId;

    const { prompt, publish } = req.body || {};

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required",
      });
    }

    const imageUrl =
      `https://image.pollinations.ai/prompt/` +
      encodeURIComponent(prompt.trim());

    // SAVE IMAGE TO DATABASE
    await sql`
      INSERT INTO creations
      (user_id, prompt, content, type, publish)
      VALUES (
        ${userId},
        ${prompt},
        ${imageUrl},
        'image',
        ${publish === true}
      )
    `;

    return res.status(200).json({
      success: true,
      content: imageUrl,
    });
  } catch (error) {
    console.error(
      "IMAGE ERROR:",
      error?.message || error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to generate image",
    });
  }
};

// =====================================================
// HELPER - READ FILE AS BASE64
// =====================================================

const getBase64FromFile = (filePath) => {
  if (!filePath) {
    throw new Error("File path is missing");
  }

  if (!fs.existsSync(filePath)) {
    throw new Error("File does not exist");
  }

  return fs
    .readFileSync(filePath)
    .toString("base64");
};

// =====================================================
// OPENROUTER IMAGE EDIT
// =====================================================

const callOpenRouterImageEdit = async ({
  imageBase64,
  mimeType,
  instruction,
}) => {
  if (!imageBase64) {
    throw new Error("Image data is missing");
  }

  if (!instruction) {
    throw new Error(
      "Image edit instruction is missing"
    );
  }

  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured in .env"
    );
  }

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
  };

  const data =
    await callOpenRouterImageChatCompletions({
      payload,
    });

  console.log(
    "OPENROUTER RESPONSE:",
    JSON.stringify(data, null, 2)
  );

  const message =
    data?.choices?.[0]?.message;

  if (!message) {
    throw new Error(
      "Invalid response from OpenRouter"
    );
  }

  // ===================================================
  // CONTENT
  // ===================================================

  const content = message.content;

  // ===================================================
  // STRING RESPONSE
  // ===================================================

  if (typeof content === "string") {
    const text = content.trim();

    // Direct data URL
    if (text.startsWith("data:image")) {
      return {
        content: text,
      };
    }

    // Direct URL
    if (/^https?:\/\//i.test(text)) {
      return {
        content: text,
      };
    }

    // Markdown image
    const markdownMatch = text.match(
      /!\[[^\]]*\]\((https?:\/\/[^)]+)\)/
    );

    if (markdownMatch) {
      return {
        content: markdownMatch[1],
      };
    }

    // JSON response
    try {
      const parsed = JSON.parse(text);

      const url =
        parsed?.url ||
        parsed?.image_url ||
        parsed?.secure_url;

      if (url) {
        return {
          content: url,
        };
      }

      const base64 =
        parsed?.base64 ||
        parsed?.image_base64 ||
        parsed?.image;

      if (base64) {
        return {
          content: base64.startsWith("data:")
            ? base64
            : `data:${mimeType};base64,${base64}`,
        };
      }
    } catch {
      // Not JSON
    }
  }

  // ===================================================
  // ARRAY RESPONSE
  // ===================================================

  if (Array.isArray(content)) {
    for (const item of content) {
      if (!item) continue;

      // URL
      if (item.url) {
        return {
          content: item.url,
        };
      }

      if (item.image_url?.url) {
        return {
          content: item.image_url.url,
        };
      }

      // Base64
      if (item.base64) {
        return {
          content: item.base64.startsWith("data:")
            ? item.base64
            : `data:${mimeType};base64,${item.base64}`,
        };
      }

      if (item.image_base64) {
        return {
          content: item.image_base64.startsWith(
            "data:"
          )
            ? item.image_base64
            : `data:${mimeType};base64,${item.image_base64}`,
        };
      }
    }
  }

  // ===================================================
  // POSSIBLE MESSAGE IMAGE FIELDS
  // ===================================================

  if (message.image_url) {
    return {
      content: message.image_url,
    };
  }

  if (message.url) {
    return {
      content: message.url,
    };
  }

  if (message.base64) {
    return {
      content:
        message.base64.startsWith("data:")
          ? message.base64
          : `data:${mimeType};base64,${message.base64}`,
    };
  }

  throw new Error(
    "OpenRouter image edit did not return an image URL/base64"
  );
};

// =====================================================
// REMOVE IMAGE BACKGROUND
// =====================================================

export const removeImageBackground = async (
  req,
  res
) => {
  let filePath = null;

  try {
    const auth = req.auth?.();
    const userId = auth?.userId;

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

    if (!process.env.REMOVE_BG_API_KEY) {
      return res.status(500).json({
        success: false,
        message:
          "REMOVE_BG_API_KEY is not configured in .env",
      });
    }

    const formData = new FormData();

    formData.append(
      "image_file",
      fs.createReadStream(filePath)
    );

    formData.append("size", "auto");

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

        timeout: 60000,
      }
    );

    if (!response.data) {
      throw new Error(
        "Remove.bg returned empty response"
      );
    }

    const base64Image =
      `data:image/png;base64,` +
      Buffer.from(response.data).toString(
        "base64"
      );

    // SAVE RESULT TO DATABASE
    await sql`
      INSERT INTO creations
      (user_id, prompt, content, type)
      VALUES (
        ${userId},
        'Remove background',
        ${base64Image},
        'image'
      )
    `;

    return res.status(200).json({
      success: true,
      content: base64Image,
    });
  } catch (error) {
    let message =
      error?.message ||
      "Failed to remove image background";

    // Axios error from Remove.bg
    if (error?.response?.data) {
      try {
        const errorText =
          Buffer.from(
            error.response.data
          ).toString("utf8");

        const parsed =
          JSON.parse(errorText);

        message =
          parsed?.errors?.[0]?.title ||
          parsed?.message ||
          message;
      } catch {
        // Ignore parsing error
      }
    }

    console.error(
      "REMOVE BG ERROR:",
      message
    );

    return res.status(500).json({
      success: false,
      message,
    });
  } finally {
    if (
      filePath &&
      fs.existsSync(filePath)
    ) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(
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

export const removeImageObject = async (
  req,
  res
) => {
  let filePath = null;

  try {
    const auth = req.auth?.();
    const userId = auth?.userId;

    const { object } = req.body || {};
    const file = req.file;

    // =================================================
    // AUTH
    // =================================================

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // =================================================
    // FILE
    // =================================================

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Image required",
      });
    }

    filePath = file.path;

    // =================================================
    // OBJECT
    // =================================================

    if (!object || !object.trim()) {
      return res.status(400).json({
        success: false,
        message: "Object is required",
      });
    }

    // =================================================
    // OPENROUTER KEY
    // =================================================

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({
        success: false,
        message:
          "OPENROUTER_API_KEY is not configured in .env",
      });
    }

    // =================================================
    // READ IMAGE
    // =================================================

    const mimeType =
      file.mimetype || "image/png";

    const imageBase64 =
      getBase64FromFile(filePath);

    // =================================================
    // INSTRUCTION
    // =================================================

    const instruction = `
Remove "${object.trim()}" from the image.

Fill the empty area naturally.

Keep the original background, lighting,
shadows, colors, composition and all
other objects unchanged.

Do not modify anything else.

Return only the final edited image.
`;

    // =================================================
    // OPENROUTER
    // =================================================

    const result =
      await callOpenRouterImageEdit({
        imageBase64,
        mimeType,
        instruction,
      });

    const content = result?.content;

    if (!content) {
      throw new Error(
        "No image returned from OpenRouter"
      );
    }

    // =================================================
    // SAVE
    // =================================================

    await sql`
      INSERT INTO creations
      (user_id, prompt, content, type)
      VALUES (
        ${userId},
        ${`Removed ${object.trim()}`},
        ${content},
        'image'
      )
    `;

    return res.status(200).json({
      success: true,
      content,
    });
  } catch (error) {
    console.error(
      "REMOVE OBJECT ERROR:",
      error?.response?.data ||
        error?.message ||
        error
    );

    return res.status(500).json({
      success: false,
      message:
        error?.message ||
        "Failed to remove object",
    });
  } finally {
    if (
      filePath &&
      fs.existsSync(filePath)
    ) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(
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

export const resumeReview = async (
  req,
  res
) => {
  let filePath = null;

  try {
    const auth = req.auth?.();
    const userId = auth?.userId;

    const resume = req.file;

    // =================================================
    // AUTH
    // =================================================

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // =================================================
    // FILE
    // =================================================

    if (!resume) {
      return res.status(400).json({
        success: false,
        message: "Resume file is required",
      });
    }

    filePath = resume.path;

    // =================================================
    // API KEY
    // =================================================

    if (!process.env.RESUME) {
      return res.status(500).json({
        success: false,
        message:
          "RESUME API key is not configured in .env",
      });
    }

    // =================================================
    // CHECK FILE
    // =================================================

    if (
      !filePath ||
      !fs.existsSync(filePath)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Uploaded resume file not found",
      });
    }

    // =================================================
    // FORM DATA
    // =================================================

    const formData = new FormData();

    formData.append(
      "file",
      fs.createReadStream(filePath)
    );

    // =================================================
    // CVPARSE API
    // =================================================

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

        maxContentLength:
          Infinity,

        maxBodyLength:
          Infinity,
      }
    );

    const parsedResume =
      response?.data;

    if (!parsedResume) {
      throw new Error(
        "CVParse returned empty response"
      );
    }

    // =================================================
    // SAVE TO DATABASE
    // =================================================

    await sql`
      INSERT INTO creations
      (user_id, prompt, content, type)
      VALUES (
        ${userId},
        'Resume Review',
        ${JSON.stringify(parsedResume)},
        'resume-review'
      )
    `;

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      success: true,
      content: parsedResume,
    });
  } catch (error) {
    console.error(
      "CVPARSE ERROR:",
      error?.response?.data ||
        error?.message ||
        error
    );

    let message =
      error?.message ||
      "Failed to parse resume";

    if (error?.response?.data) {
      if (
        typeof error.response.data ===
        "string"
      ) {
        message =
          error.response.data;
      } else {
        message =
          error.response.data?.message ||
          error.response.data?.error ||
          error.response.data?.errors?.[0]
            ?.message ||
          message;
      }
    }

    return res.status(500).json({
      success: false,
      message,
    });
  } finally {
    // =================================================
    // DELETE TEMP RESUME
    // =================================================

    if (
      filePath &&
      fs.existsSync(filePath)
    ) {
      try {
        fs.unlinkSync(filePath);
      } catch (err) {
        console.error(
          "RESUME FILE DELETE ERROR:",
          err.message
        );
      }
    }
  }
};