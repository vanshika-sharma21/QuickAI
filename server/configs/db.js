import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";

dotenv.config();

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  throw new Error(
    "Missing DATABASE_URL. Add it to server/.env (e.g., DATABASE_URL=postgres://... )"
  );
}

const sql = neon(DATABASE_URL);

export default sql;

